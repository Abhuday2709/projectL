import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoClient } from '@/lib/AWS/AWS_CLIENT';
import { MessageConfig, type Message } from '../../../../../models/messageModel';
import { v4 as uuidv4 } from 'uuid';

const docClient = DynamoDBDocumentClient.from(dynamoClient);

// POST /api/messages — save a user message
export async function POST(request: NextRequest) {
  try {
    const { chatId, text, shareId } = await request.json() as { chatId: string; text: string; shareId: string };
    // validate input
    if (!chatId || !text) {
      return NextResponse.json({ message: 'chatId and text are required' }, { status: 400 });
    }
    if (!shareId) {
    const userMessage: Message = {
      messageId: uuidv4(),
      chatId,
      text,
      isUserMessage: true,
      createdAt: new Date().toISOString(),
    };

    await docClient.send(new PutCommand({
      TableName: MessageConfig.tableName,
      Item: userMessage,
    }));

    return NextResponse.json(userMessage, { status: 201 });
  }
  const userMessage: Message = {
      messageId: uuidv4(),
      chatId: shareId,
      text,
      isUserMessage: true,
      createdAt: new Date().toISOString(),
    };

    await docClient.send(new PutCommand({
      TableName: MessageConfig.tableName,
      Item: userMessage,
    }));

    return NextResponse.json(userMessage, { status: 201 });
  } catch (err: any) {
    console.error('Error saving message:', err);
    return NextResponse.json({ message: err.message || 'Server error' }, { status: 500 });
  }
}