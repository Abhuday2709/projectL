// src/app/api/chat/[chatId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { PutCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { dynamoClient } from '@/lib/AWS/AWS_CLIENT';
import { ChatConfig, ChatSchema, type Chat } from '../../../../../models/chatModel';
import { shareSessionConfig, ShareSessionSchema } from '../../../../../models/shareSessionModel';
import { v4 as uuidv4 } from "uuid";

const docClient = DynamoDBDocumentClient.from(dynamoClient);


// POST - Create a new chat
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: "User is not authenticated." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { chatId, name } = body;

    if (!chatId || !name) {
      return NextResponse.json(
        { error: "chatId and name are required" },
        { status: 400 }
      );
    }

    if (name.trim().length === 0) {
      return NextResponse.json(
        { error: "Chat name is required" },
        { status: 400 }
      );
    }

    // Create chat object
    const chat = ChatSchema.parse({
      user_id: userId,
      chatId,
      name,
      createdAt: new Date().toISOString(),
    });

    // Create share session
    const share_id = uuidv4();
    const share = ShareSessionSchema.parse({
      chatId: chat.chatId,
      shareId: share_id,
      questionsAndAnswers: [],
      password: "",
      isActive: true,
    });

    // Create commands
    const chatCommand = new PutCommand({
      TableName: ChatConfig.tableName,
      Item: chat,
      ConditionExpression: `attribute_not_exists(user_id) AND attribute_not_exists(createdAt)`,
    });

    const shareCommand = new PutCommand({
      TableName: shareSessionConfig.tableName,
      Item: share,
      ConditionExpression: `attribute_not_exists(chatId)`,
    });

    // Execute commands
    await docClient.send(shareCommand);
    await docClient.send(chatCommand);

    return NextResponse.json(chat, { status: 201 });
  } catch (error) {
    console.error("Error in createChat:", error);
    return NextResponse.json(
      { error: "Failed to create chat" },
      { status: 500 }
    );
  }
}