import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoClient } from '@/lib/AWS/AWS_CLIENT';
import { DocumentConfig } from '@/models/documentModel';
import { z } from 'zod';

const docClient2 = DynamoDBDocumentClient.from(dynamoClient);
const StatusQuerySchema = z.object({ chatId: z.string() });

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const parse = StatusQuerySchema.safeParse({ chatId: searchParams.get('chatId') });
    if (!parse.success) {
        return NextResponse.json({ message: 'Invalid input' }, { status: 400 });
    }
    const { chatId } = parse.data;

    try {
        const { Items } = await docClient2.send(new QueryCommand({
            TableName: DocumentConfig.tableName,
            KeyConditionExpression: 'chatId = :cid',
            ExpressionAttributeValues: { ':cid': chatId },
        }));
        return NextResponse.json(Items);
    } catch (err) {
        console.error(err);
        return NextResponse.json({ message: 'Failed to fetch statuses' }, { status: 500 });
    }
}