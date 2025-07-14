import * as dotenv from 'dotenv';
dotenv.config(); // Load environment variables from .env file

import { Worker, Job } from 'bullmq';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import pdf from 'pdf-parse'; // Using 'pdf-parse' for PDF text extraction
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { type Document, DocumentConfig } from '../models/documentModel'; // Changed to relative path, Added DocumentConfig
import { Readable } from 'stream';
import { generateEmbeddings } from './gemini'; // Added import
import { QdrantClient } from '@qdrant/js-client-rest'; // Qdrant client
import { v4 as uuidv4 } from 'uuid'; // UUID generator
import { DynamoDBDocumentClient, UpdateCommand, QueryCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb'; // Added DynamoDB imports
import { dynamoClient } from '../lib/AWS/AWS_CLIENT';
import mammoth from 'mammoth';
import { EvaluationQuestionConfig, type EvaluationQuestion } from '../models/evaluationQuestionModel';
import { scoringSessionConfig, ScoringSessionSchema, type ScoringSession } from '../models/scoringReviewModel';
import { ProcessDocumentForReviewJobData } from './utils';
import { GoogleGenerativeAI } from '@google/generative-ai';
import IORedis from 'ioredis'; // Redis client for BullMQ
// Configure S3 client (ensure NEXT_PUBLIC_AWS_REGION, NEXT_PUBLIC_AWS_ACCESS_KEY_ID, NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY are set in env)
const s3Client = new S3Client({
    region: process.env.NEXT_PUBLIC_AWS_REGION!,
    credentials: {
        accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY!,
    },
});

// Qdrant Client Initialization
const qdrantClient = new QdrantClient({
    host: process.env.QDRANT_HOST!,
    port: process.env.QDRANT_PORT ? parseInt(process.env.QDRANT_PORT!) : 6333,
});

const COLLECTION_NAME = process.env.QDRANT_COLLECTION_NAME!;
const VECTOR_SIZE = 768; // For Gemini 'embedding-001'
const DISTANCE_METRIC = 'Cosine';

if (!process.env.GEMINI_API_KEY) {
    throw new Error('Missing GEMINI_API_KEY environment variable');
}

// Initialize the Gemini API client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// DynamoDB Document Client
const docClient = DynamoDBDocumentClient.from(dynamoClient);

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
        // console.log('Qdrant collection ensured successfully at worker startupfor review documents.');
    } catch (error) {
        console.error('Failed to ensure Qdrant collection at startup. Worker may not function correctly:', error);
        // Decide if you want to exit the process if Qdrant is essential
        // process.exit(1);
    }
})();

// It's good practice to configure your Redis connection
const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: null
});

async function streamToBuffer(stream: Readable): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
}

const worker = new Worker('processDocumentForReview', async (job: Job<ProcessDocumentForReviewJobData>) => {
    // // console.log(`Processing job ${job.id} for document: ${job.data.fileName} (S3 Key: ${job.data.s3Key})`);
    const { chatId, uploadedAt, docId, fileName, s3Key, fileType } = job.data;
    const user_id = job.data.user_id
    const createdAt = job.data.createdAt // Use provided createdAt or current time 
    // console.log('user_id', user_id);

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

    // Fetch all questions for the user
    const questionsCommand = new ScanCommand({
        TableName: EvaluationQuestionConfig.tableName
    });

    let questions: EvaluationQuestion[] = [];
    try {
        const questionsResult = await docClient.send(questionsCommand);
        questions = questionsResult.Items as EvaluationQuestion[];
    } catch (error) {
        console.error('Failed to fetch questions:', error);
        throw error;
    }

    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 500,
        chunkOverlap: 50,
    });
    let points = [];
    let unanswerableQuestions: string[] = [];
    let questionAnswers: { questionId: string; answer: number, reasoning: string }[] = [];

    try {
        if (fileType === 'application/pdf') {
            try {
                // // console.log(`Attempting to download PDF from S3: ${s3Key}`);
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

                // Custom pagerender function to extract text and store it by page
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
                // console.log("metadata", pdfData.metadata);
                const info = pdfData.info;
                // console.log("info", info);
                const numpages = pdfData.numpages;
                // console.log("numpages", numpages);
                const numrender = pdfData.numrender;
                // console.log("numrender", numrender);
                const version = pdfData.version;
                // console.log("version", version);

                if (pageContents.length === 0) {
                    // console.log('No text content extracted from any pages of the PDF.');
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
                        // console.log(`No text content on page ${pageNumber}. Skipping.`); // Optional: can be noisy
                        continue;
                    }

                    const chunks = await splitter.splitText(currentPageText);
                    // console.log(`Page ${pageNumber} split into ${chunks.length} chunks.`);

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
                    // // console.log(`Upserting ${points.length} points from ${pageContents.length} pages to Qdrant collection '${COLLECTION_NAME}'...`);
                    await qdrantClient.upsert(COLLECTION_NAME, { points });
                    // console.log(`${points.length} points upserted successfully. HI`);
                } else {
                    // console.log('No text chunks to process for Qdrant after processing all pages.');
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

                // Process each question with Gemini
                for (const question of questions) {
                    try {
                        // console.log("question", question);

                        // Search for relevant context
                        const searchResults = await qdrantClient.search(COLLECTION_NAME, {
                            vector: await generateEmbeddings(question.text),
                            filter: {
                                must: [
                                    {
                                        key: 'chatId',
                                        match: {
                                            value: chatId,
                                        },
                                    },
                                ],
                            },
                            limit: 5,
                            with_payload: true,
                        });

                        const documentContext = searchResults
                            .map(result => result.payload?.text as string)
                            .filter(text => text && text.length > 0);

                        // Generate response using Gemini
                        const prompt = `You are an expert document analyst tasked with evaluating business proposals and RFPs. Based on the provided document context, answer the specific question with precision.

DOCUMENT CONTEXT:
${documentContext.join('\n\n')}

QUESTION TO EVALUATE:
${question.text}

INSTRUCTIONS:
1. Carefully analyze the document context for information directly related to the question
2. Provide your answer in this EXACT format:
   Answer: [Yes/Maybe/No/-1]
   Reason: [One clear sentence explaining your reasoning]

ANSWER GUIDELINES:
- "Yes" (2 points): The document clearly and explicitly supports a positive answer
- "Maybe" (1 point): The document provides some relevant information but it's ambiguous or partial
- "No" (0 points): The document clearly indicates a negative answer or contradicts the question
- "-1": The document lacks sufficient information to make any reasonable assessment

IMPORTANT:
- Base your answer ONLY on the provided document context
- Do not make assumptions beyond what's explicitly stated
- If information is unclear or incomplete, lean towards "Maybe" or "-1"
- Keep your reason to one concise sentence (maximum 20 words)

Your response:`;
                        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
                        const result = await model.generateContent(prompt);
                        const response = await result.response.text();

                        // Parse the structured response
                        const answerMatch = response.match(/Answer:\s*(Yes|Maybe|No|-1)/i);
                        const reasonMatch = response.match(/Reason:\s*(.+?)(?:\n|$)/i);

                        const answer = answerMatch ? answerMatch[1].toLowerCase().trim() : null;
                        const reasoning = reasonMatch ? reasonMatch[1].trim() : "No reasoning provided";

                        // console.log("Raw AI response:", response);
                        // console.log("Parsed answer:", answer);
                        // console.log("Parsed reasoning:", reasoning);

                        // Convert answer to numeric score
                        let score: number;
if (answer === 'yes') {
    score = 2;
} else if (answer === '-1') {
    unanswerableQuestions.push(question.evaluationQuestionId);
    continue;
} else if (answer === 'maybe') {
    score = 1;
} else if (answer === 'no') {
    score = 0;
} else {
    // If parsing failed, treat as unanswerable
    console.warn(`Failed to parse AI response for question ${question.evaluationQuestionId}: ${response}`);
    unanswerableQuestions.push(question.evaluationQuestionId);
    continue;
}

// console.log("Final score:", score);

questionAnswers.push({
    questionId: question.evaluationQuestionId,
    answer: score,
    reasoning: reasoning // Add reasoning to the answer object
});

                    } catch (error) {
                        console.error(`Error processing question ${question.evaluationQuestionId}:`, error);
                        unanswerableQuestions.push(question.evaluationQuestionId);
                    }
                }

                // Create scoring session
                const scoringSession: ScoringSession = {
                    user_id: user_id ? user_id : "", // Use user_id if available, otherwise default
                    createdAt: createdAt || new Date().toISOString(),
                    scoringSessionId: user_id ? user_id : uuidv4(),
                    scores: [], // You might want to calculate category scores based on question answers
                    answers: questionAnswers,
                    name: fileName,
                    recommendation: '',
                    opportunityInfo: [], 
                };

                // Save scoring session
                await docClient.send(new UpdateCommand({
                    TableName: scoringSessionConfig.tableName,
                    Key: {
                        user_id: scoringSession.user_id,
                        createdAt: scoringSession.createdAt
                    },
                    UpdateExpression: 'set processingStatus = :status, processingError = :err_val, answers = :answers',
                    ExpressionAttributeValues: {
                        ':status': 'COMPLETED',
                        ':err_val': 'null',
                        ':answers': questionAnswers
                    },
                }));

                // Update document status with missing questions
                const updateToCompletedCmd = new UpdateCommand({
                    TableName: DocumentConfig.tableName,
                    Key: { chatId, uploadedAt },
                    UpdateExpression: 'set processingStatus = :status, processingError = :err_val, missingQuestionIds = :missing',
                    ExpressionAttributeValues: {
                        ':status': 'COMPLETED',
                        ':err_val': 'null',
                        ':missing': unanswerableQuestions
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
                if (chunkText.trim() === '') continue;
                const embedding = await generateEmbeddings(chunkText);
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

// console.log('Worker started listening for jobs on the \'review documents\' queue with PDF and DOC/DOCX processing logic...');

// Graceful shutdown
process.on('SIGINT', async () => {
    await worker.close();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await worker.close();
    process.exit(0);
});