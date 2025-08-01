import * as dotenv from 'dotenv';
dotenv.config(); // Load environment variables from .env file

import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import pdf from 'pdf-parse'; // Using 'pdf-parse' for PDF text extraction
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { type Document, DocumentConfig } from '../models/documentModel'; // Changed to relative path, Added DocumentConfig
import { Readable } from 'stream';
import { generateEmbeddings } from './gemini'; // Added import
import { QdrantClient } from '@qdrant/js-client-rest'; // Qdrant client
import { v4 as uuidv4 } from 'uuid'; // UUID generator
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb'; // Added DynamoDB imports
import { dynamoClient } from '../lib/AWS/AWS_CLIENT';
import mammoth from 'mammoth';

/**
 * S3 client for downloading documents from S3.
 * @requires process.env.NEXT_PUBLIC_AWS_REGION, NEXT_PUBLIC_AWS_ACCESS_KEY_ID, NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY
 */
const s3Client = new S3Client({
    region: process.env.NEXT_PUBLIC_AWS_REGION!,
    credentials: {
        accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY!,
    },
});

/**
 * Qdrant client for upserting and searching document embeddings.
 * @requires process.env.QDRANT_HOST, QDRANT_PORT, QDRANT_COLLECTION_NAME
 */
const qdrantClient = new QdrantClient({
    host: process.env.QDRANT_HOST!,
    port: process.env.QDRANT_PORT ? parseInt(process.env.QDRANT_PORT!) : 6333,
});

const COLLECTION_NAME = process.env.QDRANT_COLLECTION_NAME!;
const VECTOR_SIZE = 768; // For Gemini 'embedding-001'
const DISTANCE_METRIC = 'Cosine';

/**
 * DynamoDB DocumentClient for updating document processing status.
 */
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * Ensures that the Qdrant collection exists before processing.
 * Creates the collection with the specified vector size and metric if missing.
 * @throws Error if the collection cannot be created or accessed.
 */
async function ensureCollection() {
    try {
        const collections = await qdrantClient.getCollections();
        const collectionExists = collections.collections.some(c => c.name === COLLECTION_NAME);

        if (!collectionExists) {
            await qdrantClient.createCollection(COLLECTION_NAME, {
                vectors: {
                    size: VECTOR_SIZE,
                    distance: DISTANCE_METRIC,
                },
            });
            // console.log(`Collection '${COLLECTION_NAME}' created successfully.`);
        } 
    } catch (error) {
        console.error('Error ensuring Qdrant collection:', error);
        throw new Error('Failed to ensure Qdrant collection exists. Worker cannot proceed reliably.');
    }
}

// Call ensureCollection once when the worker starts.
// We wrap this in an immediately invoked async function to handle the promise.
(async () => {
    try {
        await ensureCollection();
        // console.log('Qdrant collection ensured successfully at worker startup.');
    } catch (error) {
        console.error('Failed to ensure Qdrant collection at startup. Worker may not function correctly:', error);
        // Decide if you want to exit the process if Qdrant is essential
        // process.exit(1);
    }
})();

// Create a single Redis connection instance matching the queue configuration
const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: null
});
/**
 * Converts a Readable stream into a Buffer.
 * @param stream - Readable stream to read.
 * @returns Buffer containing the stream's data.
 * @throws Error if the stream emits an error.
 */
async function streamToBuffer(stream: Readable): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
}
/**
 * BullMQ worker that processes documents (PDF/DOCX):
 * 1. Downloads file from S3.
 * 2. Extracts text (per page for PDFs, via mammoth for DOCX).
 * 3. Splits text into chunks.
 * 4. Generates embeddings via Gemini.
 * 5. Upserts chunks to Qdrant.
 * 6. Updates processing status in DynamoDB.
 */
const worker = new Worker('documents', async (job: Job<Document>) => {
    const { chatId, uploadedAt, docId, fileName, s3Key, fileType } = job.data;
    // Update status to PROCESSING
    try {
        const updateToProcessingCmd = new UpdateCommand({
            TableName: DocumentConfig.tableName,
            Key: { chatId, uploadedAt },
            UpdateExpression: 'set processingStatus = :status',
            ExpressionAttributeValues: { ':status': 'PROCESSING' },
        });
        await docClient.send(updateToProcessingCmd);
    } catch (statusError) {
        console.error(`Failed to update status to PROCESSING for docId ${docId}:`, statusError);
        // Decide if we should re-throw or attempt to continue. For now, log and continue.
    }

    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 500,
        chunkOverlap: 50,
    });
    let points = [];

    try {
        if (fileType === 'application/pdf') {
            try {
                /**
                 * Extracts and embeds text from each page of the PDF.
                 */
                const getObjectCommand = new GetObjectCommand({
                    Bucket: process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME!,
                    Key: s3Key,
                }); 
                const s3Object = await s3Client.send(getObjectCommand);

                if (!s3Object.Body) {
                    throw new Error('S3 object body is empty.');
                }

                const pdfBuffer = await streamToBuffer(s3Object.Body as Readable);
                // console.log(`PDF downloaded successfully. Size: ${pdfBuffer.length} bytes. Parsing text...`);

                const pageContents: string[] = []; // Initialize for each job

                /**
                 * Custom pagerender to capture text by page.
                 */
                async function customPageRenderer(pageData: any): Promise<string> {
                    // pageData is PDFPageProxy from pdf.js
                    const renderOptions = {
                        normalizeWhitespace: false, 
                        disableCombineTextItems: false,
                    };
                    // HINT: pageData.getTextContent() promise will be resolved with TextContentItem[]
                    // TextContentItem object structure: {str: string, dir: string, width: number, height: number, transform: number[], fontName: string}
                    const textContent = await pageData.getTextContent(renderOptions);
                    
                    let lastY: number | undefined;
                    let pageText = '';
                    // Concatenate items, handling line breaks based on Y-coordinate
                    for (const item of textContent.items) {
                        if (lastY === item.transform[5] || !lastY) {
                            pageText += item.str;
                        } else {
                            pageText += '\n' + item.str;
                        }
                        lastY = item.transform[5];
                    }

                    if (pageData.pageNumber > 0 && pageData.pageNumber <= 1000) { // Safety guard for pageNumber
                        pageContents[pageData.pageNumber - 1] = pageText;
                    } else if (pageData.pageNumber > 1000) {
                        console.warn(`PDF page number ${pageData.pageNumber} exceeds reasonable limit, skipping storage in pageContents.`);
                    }
                    return pageText; // pdf-parse expects the text of the current page
                }

                const pdfParseOptions = {
                    pagerender: customPageRenderer,
                };
                const pdfData = await pdf(pdfBuffer, pdfParseOptions); // This populates `pageContents`

                // Existing logs for pdfData are still useful
                const info = pdfData.info;
                const numpages = pdfData.numpages;
                const numrender = pdfData.numrender;
                const version = pdfData.version;

                if (pageContents.length === 0) {
                    // Update status to FAILED as no content was processed
                    const updateToFailedCmd = new UpdateCommand({
                        TableName: DocumentConfig.tableName,
                        Key: { chatId, uploadedAt },
                        UpdateExpression: 'set processingStatus = :status, processingError = :error',
                        ExpressionAttributeValues: {
                            ':status': 'FAILED',
                            ':error': 'No text content extracted from PDF.',
                        },
                    });
                    await docClient.send(updateToFailedCmd);
                    return Promise.resolve(); 
                }

                for (let pageIndex = 0; pageIndex < pageContents.length; pageIndex++) {
                    const currentPageText = pageContents[pageIndex];
                    const pageNumber = pageIndex + 1; // 1-indexed page number

                    if (!currentPageText || currentPageText.trim() === '') {
                        continue;
                    }

                    const chunks = await splitter.splitText(currentPageText);
                    
                    for (let chunkIndexOnPage = 0; chunkIndexOnPage < chunks.length; chunkIndexOnPage++) {
                        const chunkText = chunks[chunkIndexOnPage];
                        if (chunkText.trim() === '') continue; // Skip empty chunks

                        const embedding = await generateEmbeddings(chunkText);
                        points.push({
                            id: uuidv4(),
                            vector: embedding,
                            payload: {
                                text: chunkText,
                                documentId: docId,
                                chatId: chatId,
                                s3Key: s3Key,
                                fileName: fileName,
                                pageNumber: pageNumber,         // New field: 1-indexed page number
                                chunkIndexOnPage: chunkIndexOnPage, // New field: 0-indexed chunk on this page
                            }
                        });
                    }
                }
                
                if (points.length > 0) {
                    await qdrantClient.upsert(COLLECTION_NAME, { points });
                } else {
                    // Potentially mark as FAILED if no points were generated from non-empty pages
                    const updateToFailedNoPointsCmd = new UpdateCommand({
                        TableName: DocumentConfig.tableName,
                        Key: { chatId, uploadedAt },
                        UpdateExpression: 'set processingStatus = :status, processingError = :error',
                        ExpressionAttributeValues: {
                            ':status': 'FAILED',
                            ':error': 'PDF processed, but no text chunks generated for Qdrant.',
                        },
                    });
                    await docClient.send(updateToFailedNoPointsCmd);
                    return Promise.resolve(); 
                }

                // Update status to COMPLETED
                const updateToCompletedCmd = new UpdateCommand({
                    TableName: DocumentConfig.tableName,
                    Key: { chatId, uploadedAt },
                    UpdateExpression: 'set processingStatus = :status, processingError = :err_val',
                    ExpressionAttributeValues: {
                         ':status': 'COMPLETED',
                         ':err_val': 'null' // Explicitly set error to null or remove it
                    },
                });
                await docClient.send(updateToCompletedCmd);

            } catch (error: any) {
                console.error(`Error processing PDF ${s3Key}:`, error);
                // Update status to FAILED
                try {
                    const updateToFailedErrorCmd = new UpdateCommand({
                        TableName: DocumentConfig.tableName,
                        Key: { chatId, uploadedAt },
                        UpdateExpression: 'set processingStatus = :status, processingError = :error',
                        ExpressionAttributeValues: {
                            ':status': 'FAILED',
                            ':error': error.message as string || 'Unknown processing error',
                        },
                    });
                    await docClient.send(updateToFailedErrorCmd);
                } catch (statusUpdateError) {
                    console.error(`CRITICAL: Failed to update status to FAILED for docId ${docId} after processing error:`, statusUpdateError);
                }
                throw error; // Re-throw the original processing error for BullMQ to handle
            }
        } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileType === 'application/msword') {
            // console.log(`Processing DOC/DOCX file: ${fileName} (S3 Key: ${s3Key})`);

            // 1. Download the file from S3
            const getObjectCommand = new GetObjectCommand({
                Bucket: process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME!, // Ensure this env variable is set
                Key: s3Key,
            });
            const s3Object = await s3Client.send(getObjectCommand);

            if (!s3Object.Body) {
                throw new Error(`S3 object body is empty for DOC/DOCX file: ${s3Key}`);
            }

            // 2. Convert S3 stream to buffer
            const byteArray = await s3Object.Body.transformToByteArray();
            const nodeBuffer = Buffer.from(byteArray); // Mammoth expects a Node.js Buffer

            if (nodeBuffer.length === 0) {
                throw new Error(`Zero-byte buffer obtained from S3 for DOC/DOCX file: ${s3Key}`);
            }

            // console.log(`DOC/DOCX file ${fileName} downloaded successfully. Size: ${nodeBuffer.length} bytes. Extracting text...`);

            // 3. Pass the buffer to mammoth
            const result = await mammoth.extractRawText({ buffer: nodeBuffer });
            const text = result.value;
            // // console.log("text from docx", text); // Uncomment for debugging if needed
            
            if (!text || text.trim() === '') {
                // Update status to FAILED as no content was processed
                const updateToFailedCmd = new UpdateCommand({
                    TableName: DocumentConfig.tableName,
                    Key: { chatId, uploadedAt },
                    UpdateExpression: 'set processingStatus = :status, processingError = :error',
                    ExpressionAttributeValues: {
                        ':status': 'FAILED',
                        ':error': 'No text content extracted from DOC/DOCX.',
                    },
                });
                await docClient.send(updateToFailedCmd);
                console.warn(`No text content extracted from DOC/DOCX: ${fileName}`);
                return Promise.resolve(); 
            }
            
            const chunks = await splitter.splitText(text);
            // console.log(`DOC/DOCX split into ${chunks.length} chunks.`);
            for (let i = 0; i < chunks.length; i++) {
                const chunkText = chunks[i];
                const sanitizedChunk = chunkText.replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFF]/g, '');
                if (chunkText.trim() === '') continue;
                // // console.log(`Embedding chunk ${i + 1}/${chunks.length} (length: ${chunkText.length}):`, sanitizedChunk.slice(0, 500));
                const embedding = await generateEmbeddings(sanitizedChunk);
    
                points.push({
                    id: uuidv4(), vector: embedding,
                    payload: { text: chunkText, documentId: docId, chatId, s3Key, fileName, chunkIndex: i }
                });
            }
        } else {
            // console.log(`Skipping unsupported file type: ${fileName} (Type: ${fileType})`);
            // Update status to COMPLETED with a note that it's unsupported by this worker
            const updateToSkippedCmd = new UpdateCommand({
                TableName: DocumentConfig.tableName, Key: { chatId, uploadedAt },
                UpdateExpression: 'set processingStatus = :status, processingError = :error',
                ExpressionAttributeValues: { ':status': 'COMPLETED', ':error': `File type ${fileType} not processed by worker.` },
            });
            await docClient.send(updateToSkippedCmd);
            return Promise.resolve(); // End processing for this job
        }

        if (points.length > 0) {
            await qdrantClient.upsert(COLLECTION_NAME, { points });
            // console.log(`${points.length} points upserted successfully for ${fileName}.`);
            const updateToCompletedCmd = new UpdateCommand({
                TableName: DocumentConfig.tableName, Key: { chatId, uploadedAt },
                UpdateExpression: 'set processingStatus = :status, processingError = :err_val',
                ExpressionAttributeValues: { ':status': 'COMPLETED', ':err_val': "null" },
            });
            await docClient.send(updateToCompletedCmd);
        } else {
            throw new Error('No text chunks generated for Qdrant from the document.');
        }

    } catch (error: any) {
        console.error(`Error processing document ${s3Key} (${fileName}):`, error);
        try {
            const updateToFailedErrorCmd = new UpdateCommand({
                TableName: DocumentConfig.tableName, Key: { chatId, uploadedAt },
                UpdateExpression: 'set processingStatus = :status, processingError = :error',
                ExpressionAttributeValues: {
                    ':status': 'FAILED',
                    ':error': error.message as string || 'Unknown processing error',
                },
            });
            await docClient.send(updateToFailedErrorCmd);
        } catch (statusUpdateError) {
            console.error(`CRITICAL: Failed to update status to FAILED for docId ${docId} after processing error:`, statusUpdateError);
        }
        // Do not re-throw if you want BullMQ to consider it handled based on status update.
        // If you re-throw, BullMQ will mark it as failed and potentially retry based on queue settings.
        // For now, let's not re-throw, assuming status update is sufficient.
    }
    return Promise.resolve();
}, { connection,concurrency:3 });

worker.on('completed', job => {
    // // console.log(`Job ${job.id} for ${job.data.fileName} has completed!`);
});

worker.on('failed', (job, err) => {
    const jobFileName = job?.data?.fileName || 'unknown file';
    if (job) {
        // // console.log(`Job ${job.id} for ${jobFileName} has failed with ${err.message}`);
    } else {
        // // console.log(`A job for ${jobFileName} has failed with ${err.message}`);
    }
});

// console.log('Worker started listening for jobs on the \'documents\' queue with PDF and DOC/DOCX processing logic...');

// Graceful shutdown
process.on('SIGINT', async () => {
    await worker.close();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await worker.close();
    process.exit(0);
});