// src/app/api/chat/[chatId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { QueryCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { dynamoClient } from '@/lib/AWS/AWS_CLIENT';
import { Chat, ChatConfig } from '../../../../../models/chatModel';

const docClient = DynamoDBDocumentClient.from(dynamoClient);

// GET - Get all chats for a user
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: "User is not authenticated." },
        { status: 401 }
      );
    }

    const command = new QueryCommand({
      TableName: ChatConfig.tableName,
      KeyConditionExpression: 'user_id = :uid',
      ExpressionAttributeValues: { ':uid': userId },
      ScanIndexForward: false, // Get newest chats first
    });

    const result = await docClient.send(command);
    return NextResponse.json(result.Items as Chat[]);
  } catch (error) {
    console.error("Error in getChats:", error);
    return NextResponse.json(
      { error: "Failed to fetch chats" },
      { status: 500 }
    );
  }
}