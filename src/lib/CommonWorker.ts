import * as dotenv from 'dotenv';
dotenv.config(); // Load environment variables from .env file

import { Worker, Job } from 'bullmq';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import pdf from 'pdf-parse';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { type Document, DocumentConfig } from '../models/documentModel';
import { Readable } from 'stream';
import { generateEmbeddings } from './gemini';
import { QdrantClient } from '@qdrant/js-client-rest';
import { v4 as uuidv4 } from 'uuid';
import { DynamoDBDocumentClient, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoClient } from '../lib/AWS/AWS_CLIENT';
import mammoth from 'mammoth';
import { EvaluationQuestionConfig, type EvaluationQuestion } from '../models/evaluationQuestionModel';
import { scoringSessionConfig } from '../models/scoringReviewModel';
import { ProcessDocumentForReviewJobData, deleteFromS3, ProcessPodcasts } from './utils';
import { GoogleGenerativeAI } from '@google/generative-ai';
import IORedis from 'ioredis';
import axios from 'axios';
import { Upload } from '@aws-sdk/lib-storage';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import ffprobePath from 'ffprobe-static';
import { ChatConfig } from '../models/chatModel';

// =================================================================
// SHARED CONFIGURATION
// =================================================================

// Configure S3 client
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
const generativeModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

// DynamoDB Document Client
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Redis connection for BullMQ
const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: null
});

// Murf API Key for podcast worker
const murfApiKey = process.env.NEXT_PUBLIC_MURF_API_KEY || '';

// FFmpeg configuration for podcast worker
ffmpeg.setFfmpegPath(ffmpegPath!);
ffmpeg.setFfprobePath(ffprobePath.path);

// =================================================================
// SHARED UTILITY FUNCTIONS
// =================================================================

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

async function streamToBuffer(stream: Readable): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
}

// Initialize Qdrant collection
(async () => {
    try {
        await ensureCollection();
        console.log('Qdrant collection ensured successfully at combined worker startup.');
    } catch (error) {
        console.error('Failed to ensure Qdrant collection at startup. Workers may not function correctly:', error);
    }
})();

// =================================================================
// WORKER 1: DOCUMENT PROCESSING (Chat/Regular Documents)
// =================================================================

const documentWorker = new Worker('documents', async (job: Job<Document>) => {
    const { chatId, uploadedAt, docId, fileName, s3Key, fileType } = job.data;

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
    }

    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 500,
        chunkOverlap: 50,
    });
    let points = [];

    try {
        if (fileType === 'application/pdf') {
            const getObjectCommand = new GetObjectCommand({
                Bucket: process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME!,
                Key: s3Key,
            });
            const s3Object = await s3Client.send(getObjectCommand);

            if (!s3Object.Body) {
                throw new Error('S3 object body is empty.');
            }

            const pdfBuffer = await streamToBuffer(s3Object.Body as Readable);
            console.log(`[Documents Worker] PDF downloaded successfully. Size: ${pdfBuffer.length} bytes. Parsing text...`);

            const pageContents: string[] = [];

            async function customPageRenderer(pageData: any): Promise<string> {
                const renderOptions = {
                    normalizeWhitespace: false,
                    disableCombineTextItems: false,
                };
                const textContent = await pageData.getTextContent(renderOptions);

                let lastY: number | undefined;
                let pageText = '';
                for (const item of textContent.items) {
                    if (lastY === item.transform[5] || !lastY) {
                        pageText += item.str;
                    } else {
                        pageText += '\n' + item.str;
                    }
                    lastY = item.transform[5];
                }

                if (pageData.pageNumber > 0 && pageData.pageNumber <= 1000) {
                    pageContents[pageData.pageNumber - 1] = pageText;
                }
                return pageText;
            }

            const pdfParseOptions = { pagerender: customPageRenderer };
            const pdfData = await pdf(pdfBuffer, pdfParseOptions);

            if (pageContents.length === 0) {
                const updateToFailedCmd = new UpdateCommand({
                    TableName: DocumentConfig.tableName,
                    Key: { chatId, uploadedAt },
                    UpdateExpression: 'set processingStatus = :status, processingError = :error',
                    ExpressionAttributeValues: {
                        ':status': 'COMPLETED',
                        ':error': 'No text content extracted from PDF.',
                    },
                });
                await docClient.send(updateToFailedCmd);
                return Promise.resolve();
            }

            for (let pageIndex = 0; pageIndex < pageContents.length; pageIndex++) {
                const currentPageText = pageContents[pageIndex];
                const pageNumber = pageIndex + 1;

                if (!currentPageText || currentPageText.trim() === '') {
                    continue;
                }

                const chunks = await splitter.splitText(currentPageText);

                for (let chunkIndexOnPage = 0; chunkIndexOnPage < chunks.length; chunkIndexOnPage++) {
                    const chunkText = chunks[chunkIndexOnPage];
                    if (chunkText.trim() === '') continue;

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
                            pageNumber: pageNumber,
                            chunkIndexOnPage: chunkIndexOnPage,
                        }
                    });
                }
            }

        } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileType === 'application/msword') {
            const getObjectCommand = new GetObjectCommand({
                Bucket: process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME!,
                Key: s3Key,
            });
            const s3Object = await s3Client.send(getObjectCommand);

            if (!s3Object.Body) {
                throw new Error(`S3 object body is empty for DOC/DOCX file: ${s3Key}`);
            }

            const byteArray = await s3Object.Body.transformToByteArray();
            const nodeBuffer = Buffer.from(byteArray);

            console.log(`[Documents Worker] DOC/DOCX file ${fileName} downloaded successfully. Size: ${nodeBuffer.length} bytes. Extracting text...`);

            const result = await mammoth.extractRawText({ buffer: nodeBuffer });
            const text = result.value;

            if (!text || text.trim() === '') {
                const updateToFailedCmd = new UpdateCommand({
                    TableName: DocumentConfig.tableName,
                    Key: { chatId, uploadedAt },
                    UpdateExpression: 'set processingStatus = :status, processingError = :error',
                    ExpressionAttributeValues: {
                        ':status': 'COMPLETED',
                        ':error': 'No text content extracted from DOC/DOCX.',
                    },
                });
                await docClient.send(updateToFailedCmd);
                return Promise.resolve();
            }

            const chunks = await splitter.splitText(text);
            for (let i = 0; i < chunks.length; i++) {
                const chunkText = chunks[i];
                if (chunkText.trim() === '') continue;
                const embedding = await generateEmbeddings(chunkText);
                points.push({
                    id: uuidv4(),
                    vector: embedding,
                    payload: { text: chunkText, documentId: docId, chatId, s3Key, fileName, chunkIndex: i }
                });
            }
        }

        if (points.length > 0) {
            await qdrantClient.upsert(COLLECTION_NAME, { points });
            console.log(`[Documents Worker] ${points.length} points upserted successfully for ${fileName}.`);
            const updateToCompletedCmd = new UpdateCommand({
                TableName: DocumentConfig.tableName,
                Key: { chatId, uploadedAt },
                UpdateExpression: 'set processingStatus = :status, processingError = :err_val',
                ExpressionAttributeValues: { ':status': 'COMPLETED', ':err_val': "null" },
            });
            await docClient.send(updateToCompletedCmd);
        } else {
            throw new Error('No text chunks generated for Qdrant from the document.');
        }

    } catch (error: any) {
        console.error(`[Documents Worker] Error processing document ${s3Key} (${fileName}):`, error);
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
            console.error(`[Documents Worker] CRITICAL: Failed to update status to FAILED for docId ${docId}:`, statusUpdateError);
        }
    }
    return Promise.resolve();
}, { connection });

// =================================================================
// WORKER 2: REVIEW DOCUMENT PROCESSING (Bid/No-Bid Analysis)
// =================================================================

const reviewDocumentWorker = new Worker('processDocumentForReview', async (job: Job<ProcessDocumentForReviewJobData>) => {
    const { chatId, uploadedAt, docId, fileName, s3Key, fileType, user_id, createdAt } = job.data;

    try {
        const updateToProcessingCmd = new UpdateCommand({
            TableName: DocumentConfig.tableName,
            Key: { chatId, uploadedAt },
            UpdateExpression: 'set processingStatus = :status',
            ExpressionAttributeValues: { ':status': 'PROCESSING' },
        });
        await docClient.send(updateToProcessingCmd);
    } catch (statusError) {
        console.error(`[Review Worker] Failed to update status to PROCESSING for docId ${docId}:`, statusError);
    }

    // Fetch all questions for the user
    const questionsCommand = new QueryCommand({
        TableName: EvaluationQuestionConfig.tableName,
        KeyConditionExpression: 'user_id = :uid',
        ExpressionAttributeValues: { ':uid': "user_2xfz39DJXAXQC4weCgt0W4eJqqq" },
    });

    let questions: EvaluationQuestion[] = [];
    try {
        const questionsResult = await docClient.send(questionsCommand);
        questions = questionsResult.Items as EvaluationQuestion[];
    } catch (error) {
        console.error('[Review Worker] Failed to fetch questions:', error);
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
            // Similar PDF processing logic as document worker but with AI question answering
            const getObjectCommand = new GetObjectCommand({
                Bucket: process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME!,
                Key: s3Key,
            });
            const s3Object = await s3Client.send(getObjectCommand);

            if (!s3Object.Body) {
                throw new Error('S3 object body is empty.');
            }

            const pdfBuffer = await streamToBuffer(s3Object.Body as Readable);
            console.log(`[Review Worker] PDF downloaded successfully. Size: ${pdfBuffer.length} bytes. Parsing text...`);

            const pageContents: string[] = [];

            async function customPageRenderer(pageData: any): Promise<string> {
                const renderOptions = {
                    normalizeWhitespace: false,
                    disableCombineTextItems: false,
                };
                const textContent = await pageData.getTextContent(renderOptions);

                let lastY: number | undefined;
                let pageText = '';
                for (const item of textContent.items) {
                    if (lastY === item.transform[5] || !lastY) {
                        pageText += item.str;
                    } else {
                        pageText += '\n' + item.str;
                    }
                    lastY = item.transform[5];
                }

                if (pageData.pageNumber > 0 && pageData.pageNumber <= 1000) {
                    pageContents[pageData.pageNumber - 1] = pageText;
                }
                return pageText;
            }

            const pdfParseOptions = { pagerender: customPageRenderer };
            const pdfData = await pdf(pdfBuffer, pdfParseOptions);

            if (pageContents.length === 0) {
                const updateToFailedCmd = new UpdateCommand({
                    TableName: DocumentConfig.tableName,
                    Key: { chatId, uploadedAt },
                    UpdateExpression: 'set processingStatus = :status, processingError = :error',
                    ExpressionAttributeValues: {
                        ':status': 'COMPLETED',
                        ':error': 'No text content extracted from PDF.',
                    },
                });
                await docClient.send(updateToFailedCmd);
                return Promise.resolve();
            }

            // Process pages and create embeddings
            for (let pageIndex = 0; pageIndex < pageContents.length; pageIndex++) {
                const currentPageText = pageContents[pageIndex];
                const pageNumber = pageIndex + 1;

                if (!currentPageText || currentPageText.trim() === '') {
                    continue;
                }

                const chunks = await splitter.splitText(currentPageText);

                for (let chunkIndexOnPage = 0; chunkIndexOnPage < chunks.length; chunkIndexOnPage++) {
                    const chunkText = chunks[chunkIndexOnPage];
                    if (chunkText.trim() === '') continue;

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
                            pageNumber: pageNumber,
                            chunkIndexOnPage: chunkIndexOnPage,
                        }
                    });
                }
            }

            if (points.length > 0) {
                await qdrantClient.upsert(COLLECTION_NAME, { points });
                console.log(`[Review Worker] ${points.length} points upserted successfully.`);
            }

            // Process each question with Gemini
            for (const question of questions) {
                try {
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
                        unanswerableQuestions.push(question.evaluationQuestionId);
                        continue;
                    }

                    questionAnswers.push({
                        questionId: question.evaluationQuestionId,
                        answer: score,
                        reasoning: reasoning
                    });

                } catch (error) {
                    console.error(`[Review Worker] Error processing question ${question.evaluationQuestionId}:`, error);
                    unanswerableQuestions.push(question.evaluationQuestionId);
                }
            }

            // Save scoring session
            await docClient.send(new UpdateCommand({
                TableName: scoringSessionConfig.tableName,
                Key: {
                    user_id: user_id || "",
                    createdAt: createdAt || new Date().toISOString()
                },
                UpdateExpression: 'set processingStatus = :status, processingError = :err_val, answers = :answers',
                ExpressionAttributeValues: {
                    ':status': 'COMPLETED',
                    ':err_val': 'null',
                    ':answers': questionAnswers
                },
            }));

            // Update document status
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

        } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileType === 'application/msword') {
            // Similar DOCX processing logic as document worker but with AI question answering
            const getObjectCommand = new GetObjectCommand({
                Bucket: process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME!,
                Key: s3Key,
            });
            const s3Object = await s3Client.send(getObjectCommand);

            if (!s3Object.Body) {
                throw new Error(`S3 object body is empty for DOC/DOCX file: ${s3Key}`);
            }

            const byteArray = await s3Object.Body.transformToByteArray();
            const nodeBuffer = Buffer.from(byteArray);

            console.log(`[Review Worker] DOC/DOCX file ${fileName} downloaded successfully. Size: ${nodeBuffer.length} bytes. Extracting text...`);

            const result = await mammoth.extractRawText({ buffer: nodeBuffer });
            const text = result.value;

            if (!text || text.trim() === '') {
                const updateToFailedCmd = new UpdateCommand({
                    TableName: DocumentConfig.tableName,
                    Key: { chatId, uploadedAt },
                    UpdateExpression: 'set processingStatus = :status, processingError = :error',
                    ExpressionAttributeValues: {
                        ':status': 'COMPLETED',
                        ':error': 'No text content extracted from DOC/DOCX.',
                    },
                });
                await docClient.send(updateToFailedCmd);
                return Promise.resolve();
            }

            // Create embeddings for document chunks
            const chunks = await splitter.splitText(text);
            for (let i = 0; i < chunks.length; i++) {
                const chunkText = chunks[i];
                if (chunkText.trim() === '') continue;

                const embedding = await generateEmbeddings(chunkText);
                points.push({
                    id: uuidv4(),
                    vector: embedding,
                    payload: {
                        text: chunkText,
                        documentId: docId,
                        chatId,
                        s3Key,
                        fileName,
                        chunkIndex: i
                    }
                });
            }

            if (points.length > 0) {
                await qdrantClient.upsert(COLLECTION_NAME, { points });
                console.log(`[Review Worker] ${points.length} points upserted successfully for ${fileName}.`);
            }

            // Process each question with Gemini
            for (const question of questions) {
                try {
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
                        unanswerableQuestions.push(question.evaluationQuestionId);
                        continue;
                    }

                    questionAnswers.push({
                        questionId: question.evaluationQuestionId,
                        answer: score,
                        reasoning: reasoning
                    });

                } catch (error) {
                    console.error(`[Review Worker] Error processing question ${question.evaluationQuestionId}:`, error);
                    unanswerableQuestions.push(question.evaluationQuestionId);
                }
            }

            // Save scoring session
            await docClient.send(new UpdateCommand({
                TableName: scoringSessionConfig.tableName,
                Key: {
                    user_id: user_id || "",
                    createdAt: createdAt || new Date().toISOString()
                },
                UpdateExpression: 'set processingStatus = :status, processingError = :err_val, answers = :answers',
                ExpressionAttributeValues: {
                    ':status': 'COMPLETED',
                    ':err_val': 'null',
                    ':answers': questionAnswers
                },
            }));

            // Update document status
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
        }

    } catch (error: any) {
        console.error(`[Review Worker] Error processing document ${s3Key} (${fileName}):`, error);
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
            console.error(`[Review Worker] CRITICAL: Failed to update status to FAILED for docId ${docId}:`, statusUpdateError);
        }
    }
    return Promise.resolve();
}, { connection });

// =================================================================
// WORKER 3: PODCAST PROCESSING
// =================================================================

// Podcast utility functions
async function embedText(text: string): Promise<number[]> {
    const result = await embeddingModel.embedContent(text);
    return result.embedding.values;
}

async function summarizeChunkBatch(chunks: string[]): Promise<string> {
    const prompt = `Read the following document excerpts and extract the main points, arguments, or facts. List each as a bullet point. Respond ONLY with the bullet points.`;
    const fullText = chunks.join('\n\n');
    const result = await generativeModel.generateContent([prompt, fullText]);
    return result.response.text();
}

async function generateComprehensiveSummaryFromMainPoints(allMainPoints: string[]): Promise<string> {
    const fullText = allMainPoints.join('\n\n');
    const prompt = `Given the following main points from a document, write a concise, one-paragraph summary that includes:
- An engaging introduction
- The main points and key arguments
- An overall conclusion
Respond ONLY with the summary paragraph.`;
    const result = await generativeModel.generateContent([prompt, fullText]);
    return result.response.text();
}

async function generatePodcastOutline(summary: string, tone: string): Promise<string[]> {
    const prompt = `You are a podcast producer. Based on the following summary, generate a detailed, multi-point outline for a podcast episode. The tone should be ${tone}. The outline must include:
1.  An engaging Introduction/Hook.
2.  3 to 5(or more if needed) distinct thematic Sections or Key Points.
3.  A concluding Summary/Outro.

For each point, write a single, clear, descriptive sentence. Respond ONLY with the numbered list of outline points and nothing else.`;

    const result = await generativeModel.generateContent([prompt, summary]);
    return result.response.text().split('\n').filter(line => line.match(/^\d+\./)).map(line => line.replace(/^\d+\.\s*/, '').trim());
}

async function searchRelevantChunks(query: string, docIds: string[]): Promise<string[]> {
    const queryVector = await embedText(query);

    const searchResult = await qdrantClient.search(COLLECTION_NAME, {
        vector: queryVector,
        filter: {
            must: [{ key: 'documentId', match: { any: docIds } }]
        },
        with_payload: true,
        limit: 5,
    });

    return searchResult.map(point => point.payload?.text as string).filter(Boolean);
}

async function generateScriptSection(outlinePoint: string, contextChunks: string[]): Promise<string> {
    const context = contextChunks.join('\n\n');
    const prompt = `You are a podcast scriptwriter. Your current task is to write the script for the section titled: '${outlinePoint}'.

Use ONLY the provided Source Text below to write this part of the script. Make it engaging, clear, and conversational. If you find any powerful phrases or data points, incorporate them directly.

Source Text:
---
${context}
---`;
    const result = await generativeModel.generateContent(prompt);
    return result.response.text();
}

async function polishFinalScript(draftScript: string): Promise<string> {
    const prompt = `You are going to produce a 5-7 minute podcast episode based on the draft script I provide. Your job is to adapt and polish the single-voice script into a natural back-and-forth between two engaging hosts, "Charles" and "Natalie." Follow these guidelines:

Opening (10-15 seconds):

Charles: Write a new, compelling welcome that introduces the episode's core theme in one sentence.
Natalie: Add a quick hook or teaser that sets the stage ("Today we're unpacking why…").
Body (4-5 minutes):

Transform the draft script's main points into a dialogue.
Alternate turns:
Host A (Charles): Summarize a key idea from the original script clearly and concisely.
Host B (Natalie): Build on Charles's point with an example, analogy, or thoughtful question to improve flow and clarity.
After every 2-3 exchanges, insert a brief connective phrase to ensure the transition is smooth (e.g., "That's a great point," "Right, and that connects to…," "Interesting—let's explore that").
Tone & Style:

Warm, upbeat, and conversational—like two friends unpacking ideas.
Rewrite any awkward or repetitive sentences from the original script into everyday language.
Use natural pauses (ellipses "…") but avoid filler words ("um," "like").
Do not read the text verbatim—the goal is to rephrase and elevate it.
Do not include any explicit laughter or stage directions.
Closing (15-20 seconds):

Charles: Write a new, thoughtful recap of the main takeaway in one sentence.
Natalie: Invite listeners to share feedback or tease the next topic ("Catch us next time when we'll be talking about…").
Output Format:

Produce only the final script, labeling each line with "Charles:" or "Natalie:".
No additional commentary or metadata.
Draft Script:
---
${draftScript}
---`;
    const result = await generativeModel.generateContent(prompt);
    return result.response.text();
}

function extractDialoguesRobust(script: string): { speaker: string; text: string }[] {
    const dialogues: { speaker: string; text: string }[] = [];
    const cleanScript = script.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const blocks = cleanScript.split(/(?=(?:\*\*)?(?:^\s*)?(Charles|Natalie)(?:\*\*)?:)/m);

    for (const block of blocks) {
        const trimmedBlock = block.trim();
        if (!trimmedBlock) continue;

        const match = trimmedBlock.match(/^(?:\*\*)?(Charles|Natalie)(?:\*\*)?:\s*([\s\S]*)/);

        if (match) {
            const speaker = match[1];
            const text = match[2]
                .replace(/\n+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();

            if (text) {
                dialogues.push({ speaker, text });
            }
        }
    }

    return dialogues;
}

async function uploadBufferToS3(buffer: Buffer, fileName: string, contentType: string): Promise<string> {
    const maxRetries = 5;
    let attempt = 0;
    let lastError: any = null;

    while (attempt < maxRetries) {
        try {
            const upload = new Upload({
                client: s3Client,
                params: {
                    Bucket: process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME!,
                    Key: fileName,
                    Body: buffer,
                    ContentType: contentType,
                    ContentDisposition: 'inline',
                },
            });

            await upload.done();

            const s3Url = `https://${process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME}.s3.${process.env.NEXT_PUBLIC_AWS_REGION}.amazonaws.com/${fileName}`;
            console.log(`File uploaded to S3: ${s3Url}`);
            return s3Url;
        } catch (err) {
            lastError = err;
            attempt++;
            console.error(`S3 upload failed (attempt ${attempt}):`, err);
            if (attempt < maxRetries) {
                // Optional: add a delay before retrying
                await new Promise(res => setTimeout(res, 1000 * attempt));
            }
        }
    }

    throw lastError;
}

async function downloadAudioToBuffer(url: string): Promise<Buffer> {
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'arraybuffer',
    });

    return Buffer.from(response.data);
}
async function generateMurfAudioWithRetry(text: string, speaker: string, maxRetries = 3) {
    let attempt = 0;
    let lastError: any = null;
    while (attempt < maxRetries) {
        try {
            return await generateMurfAudio(text, speaker);
        } catch (err) {
            lastError = err;
            attempt++;
            console.error(`Murf audio generation failed (attempt ${attempt}) for ${speaker}:`, err);
            if (attempt < maxRetries) {
                await new Promise(res => setTimeout(res, 1000 * attempt));
            }
        }
    }
    throw lastError;
}
async function generateMurfAudio(text: string, speaker: string) {
    const voiceId = speaker === "Charles" ? "en-US-charles" : "en-US-natalie";
    const style = speaker === "Charles" ? "Conversational" : undefined;

    const payload: any = {
        text,
        voiceId,
    };
    if (style) payload.style = style;

    const config = {
        method: 'post',
        url: 'https://api.murf.ai/v1/speech/generate',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'api-key': murfApiKey,
        },
        data: JSON.stringify(payload),
    };

    const response = await axios(config);
    return response.data.audioUrl || response.data.url || response.data;
}

// --- FFmpeg S3 Integration ---

ffmpeg.setFfmpegPath(ffmpegPath!);
ffmpeg.setFfprobePath(ffprobePath.path);
async function concatenateAudioWithRetry(audioUrls: string[], chatId: string, maxRetries = 3): Promise<string> {
    let attempt = 0;
    let lastError: any = null;
    while (attempt < maxRetries) {
        try {
            return await concatenateAudioFromS3(audioUrls, chatId);
        } catch (err) {
            lastError = err;
            attempt++;
            console.error(`Audio concatenation failed (attempt ${attempt}):`, err);
            if (attempt < maxRetries) {
                await new Promise(res => setTimeout(res, 1000 * attempt));
            }
        }
    }
    throw lastError;
}
async function concatenateAudioFromS3(audioUrls: string[], chatId: string): Promise<string> {
    return new Promise((resolve, reject) => {
        try {
            // Temporary output path for merged file
            const tempDir = `/tmp/chat_${chatId}`;
            const outputFile = `${tempDir}/final_combined.wav`;

            // Ensure temp directory exists
            const fsSync = require('fs');
            if (!fsSync.existsSync(tempDir)) {
                fsSync.mkdirSync(tempDir, { recursive: true });
            }

            // Build ffmpeg command with URL inputs
            const command = ffmpeg();
            audioUrls.forEach(url => command.input(url));

            command
                .on('error', (err) => {
                    console.error('Error concatenating audio:', err);
                    // Cleanup
                    if (fsSync.existsSync(outputFile)) fsSync.unlinkSync(outputFile);
                    if (fsSync.existsSync(tempDir)) fsSync.rmdirSync(tempDir);
                    reject(err);
                })
                .on('end', async () => {
                    try {
                        // Read merged file and upload
                        const buffer = fsSync.readFileSync(outputFile);
                        const s3Key = `podcast-audio/chat_${chatId}_final_${Date.now()}.wav`;
                        const upload = new Upload({
                            client: s3Client,
                            params: {
                                Bucket: process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME!,
                                Key: s3Key,
                                Body: buffer,
                                ContentType: 'audio/wav',
                                ContentDisposition: 'inline',
                            },
                        });
                        await upload.done();
                        const s3Url = `https://${process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME}.s3.${process.env.NEXT_PUBLIC_AWS_REGION}.amazonaws.com/${s3Key}`;

                        // Cleanup
                        fsSync.unlinkSync(outputFile);
                        fsSync.rmdirSync(tempDir);

                        resolve(s3Url);
                    } catch (uploadErr) {
                        reject(uploadErr);
                    }
                })
                .mergeToFile(outputFile, tempDir);
        } catch (error) {
            reject(error);
        }
    });
}

async function getChunksByDocIds(docIds: string[]): Promise<string[]> {
    const allChunks: string[] = [];
    for (const docId of docIds) {
        // Using scroll API to fetch all points for a documentId
        let nextOffset: string | number | undefined = 0;
        do {
            const result = await qdrantClient.scroll(COLLECTION_NAME, {
                filter: { must: [{ key: 'documentId', match: { value: docId } }] },
                with_payload: true,
                limit: 250, // Fetch in batches of 250
                offset: nextOffset,
            });
            const texts = result.points.map(pt => pt.payload?.text).filter(Boolean) as string[];
            allChunks.push(...texts);
            if (result.next_page_offset === undefined)
                nextOffset = result.next_page_offset;
        } while (nextOffset);
    }
    return allChunks;
}

// --- Main Processing Function ---

async function processAndStorePodcastAudio(script: string, chatId: string, user_id: string, createdAt: string) {
    const dialogues = extractDialoguesRobust(script);
    const audioResults: { speaker: string; text: string; audioUrl: string }[] = [];
    const s3AudioUrls: string[] = [];

    // Generate and upload individual audio files
    for (let i = 0; i < dialogues.length; i++) {
        const { speaker, text } = dialogues[i];
        try {
            // Generate audio with Murf
            const murfResponse = await generateMurfAudioWithRetry(text, speaker);
            const audioFileUrl = murfResponse.audioFile || murfResponse.audioUrl || murfResponse.url || '';

            let s3AudioUrl = '';
            if (audioFileUrl) {
                // Download audio from Murf and upload to S3
                const audioBuffer = await downloadAudioToBuffer(audioFileUrl);
                const s3FileName = `podcast-audio/chat_${chatId}_${i}_${speaker}_${Date.now()}.wav`;
                s3AudioUrl = await uploadBufferToS3(audioBuffer, s3FileName, 'audio/wav');
                s3AudioUrls.push(s3AudioUrl);
            }

            audioResults.push({ speaker, text, audioUrl: s3AudioUrl });
            console.log(`Generated and uploaded audio for ${speaker}: ${s3AudioUrl}`);
        } catch (err) {
            console.error(`Failed to generate/upload audio for ${speaker}:`, err);
            audioResults.push({ speaker, text, audioUrl: '' });
        }
    }

    // Concatenate all audio files and upload final version
    let finalPodcastUrl = '';
    const validAudioUrls = s3AudioUrls.filter(Boolean);
    if (validAudioUrls.length > 1) {
        finalPodcastUrl = await concatenateAudioWithRetry(validAudioUrls, chatId);
        console.log("Final combined podcast audio URL:", finalPodcastUrl);
    } else if (validAudioUrls.length === 1) {
        finalPodcastUrl = validAudioUrls[0];
        console.log("Single podcast audio URL:", finalPodcastUrl);
    } else {
        console.log("No audio files to combine.");
    }
    for (const s3AudioUrl of validAudioUrls) {
        try {
            // Extract the S3 key from the URL
            const urlParts = s3AudioUrl.split('/');
            const s3Key = urlParts.slice(3).join('/'); // Remove 'https://bucket.s3.region.amazonaws.com/'
            deleteFromS3(s3Key);
            console.log('S3 delete successful for', s3Key);
        } catch (s3Error) {
            console.error('S3 deletion error:', s3Error);
            console.warn('Failed to delete from S3:', s3AudioUrl);
        }
    }
    // Store in DynamoDB with retry logic
    const maxRetries = 5;
    let attempt = 0;
    let success = false;
    let lastError: any = null;

    while (attempt < maxRetries && !success) {
        try {
            await docClient.send(new UpdateCommand({
                TableName: ChatConfig.tableName,
                Key: { user_id, createdAt },
                UpdateExpression: "SET podcast = :podcast, podcastFinal = :finalUrl",
                ExpressionAttributeValues: {
                    ":podcast": audioResults,
                    ":finalUrl": finalPodcastUrl,
                },
            }));
            success = true;
            console.log("Podcast audio URLs stored in DynamoDB chat table.");
        } catch (err) {
            lastError = err;
            attempt++;
            console.error(`DynamoDB update failed (attempt ${attempt}):`, err);
            if (attempt < maxRetries) {
                // Optional: add a delay before retrying
                await new Promise(res => setTimeout(res, 1000 * attempt));
            }
        }
    }

    if (!success) {
        throw lastError;
    }
}

const podcastWorker = new Worker<ProcessPodcasts>(
    'processPodcast',
    async (job) => {
        console.log('Processing podcast job with new RAG workflow:', job.data);
        // Assuming title and tone can be passed in job data for customization
        const { DocIdList, chatId, user_id, createdAt } = job.data;
        const tone = "conversational and informative"
        // --- PHASE 1: PREPARATION ---
        // Step 1 is assumed to be completed before this worker is called.
        // Chunks are already in Qdrant. We just need to fetch them.
        const allChunks = await getChunksByDocIds(DocIdList); // You need to implement or use your existing getChunksByDocIds
        console.log(`Fetched ${allChunks.length} chunks from Qdrant for document(s) [${DocIdList.join(', ')}].`);
        if (allChunks.length === 0) {
            console.error("No chunks found for the given documents. Aborting job.");
            // Optionally update the chat with an error message
            return;
        }

        // --- PHASE 2: OUTLINING ---
        // Step 2.1: Summarize main points from each batch of 10 chunks
        const batchSize = 10;
        const mainPointsBatches: string[] = [];
        for (let i = 0; i < allChunks.length; i += batchSize) {
            const batch = allChunks.slice(i, i + batchSize);
            const mainPoints = await summarizeChunkBatch(batch);
            mainPointsBatches.push(mainPoints);
        }

        // Step 2.2: Generate a comprehensive summary from all main points
        const summary = await generateComprehensiveSummaryFromMainPoints(mainPointsBatches);

        // Step 3: Generate a Structured Podcast Outline
        const outline = await generatePodcastOutline(summary, tone);
        if (outline.length < 3) {
            throw new Error("Failed to generate a valid outline from the document summary.");
        }
        console.log("Successfully generated podcast outline:", outline);

        // --- PHASE 3: WRITING THE SCRIPT ---
        // Step 4: Generate the Script for Each Outline Point
        const scriptSections: string[] = [];
        for (const point of outline) {
            // 4a: Retrieve relevant chunks for this outline point
            const relevantChunks = await searchRelevantChunks(point, DocIdList);

            // 4b: Generate the script for this section
            if (relevantChunks.length > 0) {
                const sectionScript = await generateScriptSection(point, relevantChunks);
                scriptSections.push(sectionScript);
                console.log(`-> Script generated for section: "${point}"`);
            } else {
                console.log(`-> No relevant chunks found for section: "${point}". Skipping.`);
            }
        }

        // --- PHASE 4: FINAL ASSEMBLY ---
        // Step 5: Assemble and Polish the Final Script
        const draftScript = scriptSections.join('\n\n---\n\n');
        const finalPodcastScript = await polishFinalScript(draftScript);

        console.log("\n--- FINAL POLISHED PODCAST SCRIPT ---\n");
        console.log(finalPodcastScript);
        //         const temp = `Charles: So, the biggest takeaway: OLX Poland's AI journey showcases how strategic AI can dramatically improve efficiency, customer experiences, and scalability.
        // Natalie: It's really a blueprint for businesses looking to revolutionize their own customer service strategies.`
        //         console.log("temp");

        // Step 6: Extract dialogues for further processing or storage
        await processAndStorePodcastAudio(finalPodcastScript, chatId, user_id, createdAt);

        // TODO: Save the finalPodcastScript to your database, associate it with the chatId,
        // and notify the user that their podcast is ready.
    },
    { connection }
);


// =================================================================
// WORKER EVENT HANDLERS
// =================================================================

// Document Worker Events
documentWorker.on('completed', job => {
    console.log(`[Documents Worker] Job ${job.id} for ${job.data.fileName} completed!`);
});

documentWorker.on('failed', (job, err) => {
    const jobFileName = job?.data?.fileName || 'unknown file';
    console.log(`[Documents Worker] Job ${job?.id} for ${jobFileName} failed: ${err.message}`);
});

// Review Document Worker Events
reviewDocumentWorker.on('completed', job => {
    console.log(`[Review Worker] Job ${job.id} for ${job.data.fileName} completed!`);
});

reviewDocumentWorker.on('failed', (job, err) => {
    const jobFileName = job?.data?.fileName || 'unknown file';
    console.log(`[Review Worker] Job ${job?.id} for ${jobFileName} failed: ${err.message}`);
});

// Podcast Worker Events
podcastWorker.on('completed', (job) => {
    console.log(`[Podcast Worker] Job ${job.id} completed successfully.`);
});

podcastWorker.on('failed', (job, err) => {
    console.error(`[Podcast Worker] Job ${job?.id} failed:`, err);
});

// =================================================================
// STARTUP AND SHUTDOWN
// =================================================================

console.log('🚀 Combined Worker started with all three processing capabilities:');
console.log('   📄 Documents Queue - Regular document processing');
console.log('   📊 Review Documents Queue - Bid/No-bid analysis');
console.log('   🎙️  Podcast Queue - AI-generated podcasts');

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down workers...');
    await Promise.all([
        documentWorker.close(),
        reviewDocumentWorker.close(),
        podcastWorker.close()
    ]);
    await connection.quit();
    console.log('All workers shut down successfully.');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Shutting down workers...');
    await Promise.all([
        documentWorker.close(),
        reviewDocumentWorker.close(),
        podcastWorker.close()
    ]);
    await connection.quit();
    console.log('All workers shut down successfully.');
    process.exit(0);
});