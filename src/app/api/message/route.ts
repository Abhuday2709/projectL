import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoClient } from '@/lib/AWS/AWS_CLIENT';
import { MessageConfig, type Message } from '../../../../models/messageModel';

const docClient = DynamoDBDocumentClient.from(dynamoClient);
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const chatId = url.searchParams.get('chatId');
  const cursor = url.searchParams.get('cursor') || undefined;
  const limitParam = url.searchParams.get('limit');
  const limit = limitParam ? Math.min(Math.max(parseInt(limitParam), 1), 100) : 10;

  if (!chatId) {
    return NextResponse.json({ message: 'chatId is required' }, { status: 400 });
  }

  try {
    const params: any = {
      TableName: MessageConfig.tableName,
      KeyConditionExpression: 'chatId = :cid',
      ExpressionAttributeValues: { ':cid': chatId },
      Limit: limit,
      ScanIndexForward: false,
    };
    if (cursor) {
      params.ExclusiveStartKey = { chatId, createdAt: cursor };
    }

    const result = await docClient.send(new QueryCommand(params));
    const items = (result.Items || []) as Message[];
    const nextCursor = result.LastEvaluatedKey?.createdAt;

    return NextResponse.json({ items, nextCursor });
  } catch (err) {
    console.error('Error fetching messages:', err);
    return NextResponse.json({ message: 'Failed to fetch messages' }, { status: 500 });
  }
}