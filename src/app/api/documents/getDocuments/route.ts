import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoClient } from '@/lib/AWS/AWS_CLIENT';
import { DocumentConfig, type Document } from '../../../../../models/documentModel';
const docClient = DynamoDBDocumentClient.from(dynamoClient);
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get('chatId');
    if (!chatId) {
        return NextResponse.json({ message: 'chatId is required' }, { status: 400 });
    }

    try {
        const result = await docClient.send(new QueryCommand({
            TableName: DocumentConfig.tableName,
            KeyConditionExpression: 'chatId = :cid',
            ExpressionAttributeValues: { ':cid': chatId },
        }));
        const items = result.Items as Document[];
        return NextResponse.json(items);
    } catch (err) {
        console.error(err);
        return NextResponse.json({ message: 'Failed to fetch documents' }, { status: 500 });
    }
}