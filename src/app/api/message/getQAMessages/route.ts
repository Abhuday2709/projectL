import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoClient } from '@/lib/AWS/AWS_CLIENT';
import { MessageConfig, type Message } from '../../../../../models/messageModel';

const docClient = DynamoDBDocumentClient.from(dynamoClient);

export async function GET(request: NextRequest) {
  // Authenticate user via Clerk
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'User is not authenticated.' }, { status: 401 });
  }

  // Parse and validate chatId
  const chatId = request.nextUrl.searchParams.get('chatId');
  if (!chatId) {
    return NextResponse.json({ error: 'Missing `chatId` parameter.' }, { status: 400 });
  }

  try {
    // First, get the shareId from shareSession table using chatId
    const shareSessionCommand = new QueryCommand({
      TableName: 'shareSession', // Replace with your actual shareSession table name
      KeyConditionExpression: 'chatId = :cid',
      ExpressionAttributeValues: { ':cid': chatId },
      Limit: 1,
    });

    const shareSessionResult = await docClient.send(shareSessionCommand);
    
    if (!shareSessionResult.Items || shareSessionResult.Items.length === 0) {
      return NextResponse.json({ messages: [] }); // No shared session found
    }

    const shareId = shareSessionResult.Items[0].shareId;

    // Now fetch messages using shareId as chatId in messages table
    const messagesCommand = new QueryCommand({
      TableName: MessageConfig.tableName,
      KeyConditionExpression: 'chatId = :shareId',
      ExpressionAttributeValues: { ':shareId': shareId },
      ScanIndexForward: true, // Sort by createdAt in ascending order
    });

    const messagesResult = await docClient.send(messagesCommand);
    const messages = (messagesResult.Items || []) as Message[];

    // Sort messages by createdAt to ensure proper order
    const sortedMessages = messages.sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    return NextResponse.json({ messages: sortedMessages });
  } catch (error) {
    console.error('Error fetching Q&A messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Q&A messages from database.' },
      { status: 500 }
    );
  }
}