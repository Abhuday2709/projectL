import * as dotenv from 'dotenv';
dotenv.config(); // Load environment variables from .env file

import { Worker, Job } from 'bullmq';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import pdf from 'pdf-parse'; // Using 'pdf-parse' for PDF text extraction
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { type Document } from '../../models/documentModel'; // Changed to relative path
import { Readable } from 'stream';
import { generateEmbeddings } from './gemini'; // Added import
import { QdrantClient } from '@qdrant/js-client-rest'; // Qdrant client
import { v4 as uuidv4 } from 'uuid'; // UUID generator

// Configure S3 client (ensure AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY are set in env)
const s3Client = new S3Client({
    region: process.env.AWS_REGION!,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
});

// Qdrant Client Initialization
const qdrantClient = new QdrantClient({
    host: process.env.QDRANT_HOST || 'localhost',
    port: process.env.QDRANT_PORT ? parseInt(process.env.QDRANT_PORT) : 6333,
});

const COLLECTION_NAME = process.env.QDRANT_COLLECTION_NAME || 'document_embeddings';
const VECTOR_SIZE = 768; // For Gemini 'embedding-001'
const DISTANCE_METRIC = 'Cosine';

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
            console.log(`Collection '${COLLECTION_NAME}' created successfully.`);
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
        console.log('Qdrant collection ensured successfully at worker startup.');
    } catch (error) {
        console.error('Failed to ensure Qdrant collection at startup. Worker may not function correctly:', error);
        // Decide if you want to exit the process if Qdrant is essential
        // process.exit(1);
    }
})();

// It's good practice to configure your Redis connection
const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379,
};

async function streamToBuffer(stream: Readable): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
}

const worker = new Worker('documents', async (job: Job<Document>) => {
    // console.log(`Processing job ${job.id} for document: ${job.data.fileName} (S3 Key: ${job.data.s3Key})`);
    
    if (job.data.fileType === 'application/pdf') {
        try {
            // console.log(`Attempting to download PDF from S3: ${job.data.s3Key}`);
            const getObjectCommand = new GetObjectCommand({
                Bucket: process.env.AWS_S3_BUCKET_NAME!,
                Key: job.data.s3Key,
            }); 
            const s3Object = await s3Client.send(getObjectCommand);

            if (!s3Object.Body) {
                throw new Error('S3 object body is empty.');
            }

            const pdfBuffer = await streamToBuffer(s3Object.Body as Readable);
            // console.log(`PDF downloaded successfully. Size: ${pdfBuffer.length} bytes. Parsing text...`);

            const pdfData = await pdf(pdfBuffer);
            const text = pdfData.text;
            // console.log(`PDF text extracted. Length: ${text.length} characters.`);

            if (!text || text.trim() === '') {
                // console.log('No text content found in PDF after parsing.');
                return Promise.resolve(); 
            }

            const splitter = new RecursiveCharacterTextSplitter({
                chunkSize: 500, // Target size of each chunk (in characters)
                chunkOverlap: 50, // Number of characters to overlap between chunks
            });

            const chunks = await splitter.splitText(text);
            // console.log(`Text split into ${chunks.length} chunks.`);
            
            if (chunks.length > 0) {
                // console.log('Generating embeddings and preparing points for Qdrant...');
                const points = [];
                for (let i = 0; i < chunks.length; i++) {
                    const chunkText = chunks[i];
                    const embedding = await generateEmbeddings(chunkText);
                    points.push({
                        id: uuidv4(),
                        vector: embedding,
                        payload: {
                            text: chunkText,
                            documentId: job.data.docId,
                            chatId: job.data.chatId,
                            s3Key: job.data.s3Key,
                            fileName: job.data.fileName,
                            chunkIndex: i,
                        }
                    });
                    // console.log(`Generated embedding for chunk ${i + 1}/${chunks.length}`); // Optional: can be noisy
                }

                if (points.length > 0) {
                    // console.log(`Upserting ${points.length} points to Qdrant collection '${COLLECTION_NAME}'...`);
                    await qdrantClient.upsert(COLLECTION_NAME, { points });
                    // console.log(`${points.length} points upserted successfully.`);
                }
            } else {
                // console.log('No text chunks to process for Qdrant.');
            }

        } catch (error) {
            console.error(`Error processing PDF ${job.data.s3Key}:`, error);
            throw error; 
        }
    } else {
        // console.log(`Skipping non-PDF file: ${job.data.fileName} (Type: ${job.data.fileType})`);
    }

    return Promise.resolve();
}, { connection });

worker.on('completed', job => {
    // console.log(`Job ${job.id} for ${job.data.fileName} has completed!`);
});

worker.on('failed', (job, err) => {
    const jobFileName = job?.data?.fileName || 'unknown file';
    if (job) {
        // console.log(`Job ${job.id} for ${jobFileName} has failed with ${err.message}`);
    } else {
        // console.log(`A job for ${jobFileName} has failed with ${err.message}`);
    }
});

console.log('Worker started listening for jobs on the \'documents\' queue with PDF processing logic...');

// Graceful shutdown
process.on('SIGINT', async () => {
    await worker.close();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await worker.close();
    process.exit(0);
});