import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoClient } from '@/lib/AWS/AWS_CLIENT';
import { Message, MessageConfig } from '@/models/messageModel';

const docClient = DynamoDBDocumentClient.from(dynamoClient);

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get('chatId');

    if (!chatId) {
      return NextResponse.json({ error: 'chatId is required' }, { status: 400 });
    }

    const command = new QueryCommand({
      TableName: MessageConfig.tableName,
      KeyConditionExpression: 'chatId = :cid',
      ExpressionAttributeValues: { ':cid': chatId },
      ScanIndexForward: true, // Sorts messages from oldest to newest
    });

    const result = await docClient.send(command);
    const messages = (result.Items || []) as Message[];

    return NextResponse.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}