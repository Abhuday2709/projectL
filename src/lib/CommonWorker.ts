import * as dotenv from 'dotenv';
dotenv.config();

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { QdrantClient } from '@qdrant/js-client-rest';
import { DynamoDBDocumentClient, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';

// Initialize S3 client
export function initS3Client(): S3Client {
    return new S3Client({
        region: process.env.NEXT_PUBLIC_AWS_REGION!,
        credentials: {
            accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY!,
        },
    });
}

// Convert Readable stream to Buffer
export async function streamToBuffer(stream: Readable): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
}

// Initialize Qdrant client
export function initQdrantClient(): QdrantClient {
    return new QdrantClient({
        host: process.env.QDRANT_HOST || 'localhost',
        port: process.env.QDRANT_PORT ? parseInt(process.env.QDRANT_PORT) : 6333,
    });
}

// Ensure Qdrant collection exists
export async function ensureQdrantCollection(qdrantClient: QdrantClient, collectionName?: string, vectorSize?: number, distanceMetric?: string): Promise<void> {
    const name = collectionName || process.env.QDRANT_COLLECTION_NAME || 'document_embeddings';
    const VecSize = 768;
    const distance = 'Cosine';
    try {
        const collections = await qdrantClient.getCollections();
        const exists = collections.collections.some(c => c.name === name);
        if (!exists) {
            await qdrantClient.createCollection(name, { vectors: { size: VecSize, distance: distance } });
            console.log(`Collection '${name}' created.`);
        }
    } catch (err) {
        console.error('Error ensuring Qdrant collection:', err);
        throw err;
    }
}

// Download file from S3 and return Buffer
export async function downloadFileBuffer(s3Client: S3Client, s3Key: string, isDocx?: boolean): Promise<Buffer> {
    const cmd = new GetObjectCommand({ Bucket: process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME!, Key: s3Key });
    const res = await s3Client.send(cmd);
    if (!res.Body) throw new Error('S3 object body empty');
    if (isDocx) {
        // For AWS SDK v3, Body has transformToByteArray
        // @ts-ignore
        const byteArray = await res.Body.transformToByteArray();
        return Buffer.from(byteArray);
    }
    return await streamToBuffer(res.Body as Readable);
}

// Extract PDF pages content into array of strings
export async function extractPdfPageContents(buffer: Buffer): Promise<string[]> {
    const pageContents: string[] = [];
    async function customPageRenderer(pageData: any): Promise<string> {
        const textContent = await pageData.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false });
        let lastY: number | undefined;
        let pageText = '';
        for (const item of textContent.items) {
            if (lastY === item.transform[5] || !lastY) pageText += item.str;
            else pageText += '\n' + item.str;
            lastY = item.transform[5];
        }
        if (pageData.pageNumber > 0 && pageData.pageNumber <= 1000) {
            pageContents[pageData.pageNumber - 1] = pageText;
        }
        return pageText;
    }
    await pdf(buffer, { pagerender: customPageRenderer });
    return pageContents;
}

// Split text chunks and embed
export async function splitAndEmbedTextChunks(
    chunks: string[] | string[][],
    splitter: any,
    generateEmbeddings: (text: string) => Promise<number[]>,
    payloadMeta: Record<string, any>
): Promise<any[]> {
    const points: any[] = [];
    // chunks may be array of page strings or array of chunk strings
    if (Array.isArray(chunks) && typeof chunks[0] === 'string') {
        // Each element is a page text or a direct chunk
        for (let i = 0; i < (chunks as string[]).length; i++) {
            const pageText = (chunks as string[])[i];
            if (!pageText || !pageText.trim()) continue;
            const subChunks = await splitter.splitText(pageText);
            for (let j = 0; j < subChunks.length; j++) {
                const text = subChunks[j];
                if (!text.trim()) continue;
                const embedding = await generateEmbeddings(text);
                points.push({ id: uuidv4(), vector: embedding, payload: { text, ...payloadMeta, pageNumber: i + 1, chunkIndexOnPage: j } });
            }
        }
    } else if (Array.isArray(chunks) && Array.isArray(chunks[0])) {
        // Already chunked array-of-arrays: e.g., [[chunk1,chunk2],...]
        for (let i = 0; i < (chunks as string[][]).length; i++) {
            const subArray = (chunks as string[][])[i];
            for (let j = 0; j < subArray.length; j++) {
                const text = subArray[j];
                if (!text.trim()) continue;
                const embedding = await generateEmbeddings(text);
                points.push({ id: uuidv4(), vector: embedding, payload: { text, ...payloadMeta, chunkIndex: j } });
            }
        }
    }
    return points;
}

// Update DynamoDB document status
export async function updateDocumentStatus(
    docClient: DynamoDBDocumentClient,
    tableName: string,
    key: Record<string, any>,
    attributes: Record<string, any>
): Promise<void> {
    const expressionParts: string[] = [];
    const expressionValues: Record<string, any> = {};
    Object.entries(attributes).forEach(([field, val], idx) => {
        const placeholder = `:val${idx}`;
        expressionParts.push(`${field} = ${placeholder}`);
        expressionValues[placeholder] = val;
    });
    const updateExp = 'set ' + expressionParts.join(', ');
    const cmd = new UpdateCommand({ TableName: tableName, Key: key, UpdateExpression: updateExp, ExpressionAttributeValues: expressionValues });
    await docClient.send(cmd);
}

// Fetch evaluation questions from DynamoDB
export async function fetchEvaluationQuestions(
    docClient: DynamoDBDocumentClient,
    tableName: string,
    userId: string
): Promise<any[]> {
    const cmd = new QueryCommand({ TableName: tableName, KeyConditionExpression: 'user_id = :uid', ExpressionAttributeValues: { ':uid': userId } });
    const res = await docClient.send(cmd);
    return res.Items || [];
}