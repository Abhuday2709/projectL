
import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoClient } from '@/lib/AWS/AWS_CLIENT';
import { DocumentConfig, type Document } from '@/models/documentModel';
import { myQueue, myReviewQueue } from '@/lib/queue';

const docClient = DynamoDBDocumentClient.from(dynamoClient);

// POST /api/documents — create document
export async function POST(request: NextRequest) {
    try {
        const input = await request.json() as Partial<Document> & { forReview?: boolean; user_id?: string; createdAt?: string };
        const document: Document = {
            chatId: input.chatId!,
            docId: input.docId!,
            fileName: input.fileName!,
            s3Key: input.s3Key!,
            fileType: input.fileType!,
            uploadedAt: new Date().toISOString(),
            processingStatus: 'QUEUED',
            processingError: ' ',
        };

        await docClient.send(new PutCommand({
            TableName: DocumentConfig.tableName,
            Item: document,
            ConditionExpression: 'attribute_not_exists(chatId) AND attribute_not_exists(docId)',
        }));

        // Enqueue for processing
        if (input.forReview) {
            if (!input.user_id) throw new Error('User ID required for review');
            await myReviewQueue.add('processDocumentForReview', { ...document, user_id: input.user_id, createdAt: input.createdAt }, { jobId: document.docId });
        } else {
            await myQueue.add('processDocument', document, { jobId: document.docId });
        }

        return NextResponse.json(document, { status: 201 });
    } catch (err: any) {
        console.error(err);
        if (err.name === 'ConditionalCheckFailedException') {
            return NextResponse.json({ message: 'Document already exists' }, { status: 409 });
        }
        return NextResponse.json({ message: err.message || 'Server error' }, { status: 500 });
    }
}