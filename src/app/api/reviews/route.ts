import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBDocumentClient, PutCommand, DeleteCommand, QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoClient } from '@/lib/AWS/AWS_CLIENT';
import { scoringSessionConfig, ScoringSessionSchema, type ScoringSession } from '../../../../models/scoringReviewModel';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { QdrantClient } from '@qdrant/js-client-rest';

const reviewClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({ region: process.env.NEXT_PUBLIC_AWS_REGION });
const qdrant = new QdrantClient({ host: process.env.QDRANT_HOST, port: Number(process.env.QDRANT_PORT) });
const COLLECTION = process.env.QDRANT_COLLECTION_NAME || 'document_embeddings';

// Create review
export async function POST(request: NextRequest) {
    const input = await request.json() as { user_id: string; scoringSessionId?: string; name: string; scores: any[]; answers: any[]; recommendation: string };
    // Authorization and validation
    if (!input.user_id) return NextResponse.json({ message: 'user_id required' }, { status: 400 });
    // Server-side fields
    const review = ScoringSessionSchema.parse({ ...input, createdAt: new Date().toISOString(), opportunityInfo: [] });
    await reviewClient.send(new PutCommand({ TableName: scoringSessionConfig.tableName, Item: review }));
    return NextResponse.json(review, { status: 201 });
}

// List reviews
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    if (!userId) return NextResponse.json({ message: 'user_id required' }, { status: 400 });
    try {
        const result = await reviewClient.send(new QueryCommand({ TableName: scoringSessionConfig.tableName, KeyConditionExpression: 'user_id = :uid', ExpressionAttributeValues: { ':uid': userId }, ScanIndexForward: false }));
        return NextResponse.json(result.Items as ScoringSession[]);
    } catch (err) {
        console.error(err);
        return NextResponse.json({ message: 'Fetch error' }, { status: 500 });
    }
}

// Delete review and related assets
export async function DELETE(request: NextRequest) {
    const { user_id, createdAt } = await request.json() as { user_id: string; createdAt: string };
    if (!user_id || !createdAt) return NextResponse.json({ message: 'Invalid input' }, { status: 400 });
    // Fetch review to get scoringSessionId
    const { Item } = await reviewClient.send(new GetCommand({ TableName: scoringSessionConfig.tableName, Key: { user_id, createdAt } }));
    const sessionId = Item?.scoringSessionId as string;
    // Fetch associated documents
    const docs = (await reviewClient.send(new QueryCommand({ TableName: '<DocumentTable>', KeyConditionExpression: 'chatId = :cid', ExpressionAttributeValues: { ':cid': sessionId } }))).Items || [];
    // Delete each doc: S3, Qdrant, Dynamo
    for (const doc of docs) {
        await s3Client.send(new DeleteObjectCommand({ Bucket: process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME!, Key: doc.s3Key }));
        await qdrant.delete(COLLECTION, { filter: { must: [{ key: 'documentId', match: { value: doc.docId } }, { key: 'chatId', match: { value: sessionId } }] } });
        await reviewClient.send(new DeleteCommand({ TableName: '<DocumentTable>', Key: { chatId: sessionId, uploadedAt: doc.uploadedAt } }));
    }
    // Delete review record
    await reviewClient.send(new DeleteCommand({ TableName: scoringSessionConfig.tableName, Key: { user_id, createdAt } }));
    return NextResponse.json({ success: true });
}
