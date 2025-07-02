import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBDocumentClient, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoClient } from '@/lib/AWS/AWS_CLIENT';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { QdrantClient } from '@qdrant/js-client-rest';
import { DocumentConfig } from '@/models/documentModel';

const docClient3 = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({
    region: process.env.NEXT_PUBLIC_AWS_REGION, 
    credentials: {
        accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY!,
    },
});
const qdrant = new QdrantClient({ host: process.env.QDRANT_HOST, port: Number(process.env.QDRANT_PORT) });
const COLLECTION = process.env.QDRANT_COLLECTION_NAME || 'document_embeddings';

export async function DELETE(request: NextRequest, { params }: { params: { chatId: string, uploadedAt: string } }) {
    const { chatId, uploadedAt } = await params;
    try {
        // DynamoDB delete
        await docClient3.send(new DeleteCommand({
            TableName: DocumentConfig.tableName,
            Key: { chatId, uploadedAt },
            ConditionExpression: 'attribute_exists(chatId) AND attribute_exists(uploadedAt)',
        }));

        // S3 delete
        const { s3Key, docId } = await request.json();
        await s3Client.send(new DeleteObjectCommand({ Bucket: process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME, Key: s3Key }));

        // Qdrant delete
        await qdrant.delete(COLLECTION, {
            filter: {
                must: [
                    { key: 'documentId', match: { value: docId } },
                    { key: 'chatId', match: { value: chatId } }
                ]
            }
        });

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ message: 'Deletion failed' }, { status: 500 });
    }
}
