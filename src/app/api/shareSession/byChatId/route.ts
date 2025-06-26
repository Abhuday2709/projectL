import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoClient } from '@/lib/AWS/AWS_CLIENT';
import { shareSessionConfig, type ShareSession } from '../../../../../models/shareSessionModel';

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

  // Query by chatId (assumes GSI or primary key)
  const command = new QueryCommand({
    TableName: shareSessionConfig.tableName,
    KeyConditionExpression: 'chatId = :cid',
    ExpressionAttributeValues: { ':cid': chatId },
    Limit: 1,
  });

  try {
    const result = await docClient.send(command);
    if (!result.Items || result.Items.length === 0) {
      return NextResponse.json({ error: `shareSession with chatId '${chatId}' not found.` }, { status: 404 });
    }

    const shareSession = result.Items[0] as ShareSession;
    return NextResponse.json(shareSession);
  } catch (error) {
    console.error('DynamoDB QueryCommand failed in byChatId:', error);
    return NextResponse.json(
      { error: 'Failed to query chat details from database.' },
      { status: 500 }
    );
  }
}
