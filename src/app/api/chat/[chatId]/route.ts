// src/app/api/chat/[chatId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { QueryCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { dynamoClient } from '@/lib/AWS/AWS_CLIENT';
import { ChatConfig, type Chat } from '@/models/chatModel';

const docClient = DynamoDBDocumentClient.from(dynamoClient);

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ chatId: string }> }
) {
    try {
        const { chatId } = await params;
        if (!chatId) {
            return NextResponse.json(
                { error: "Chat ID is required" },
                { status: 400 }
            );
        }
        const command = new QueryCommand({
            TableName: ChatConfig.tableName,
            IndexName: ChatConfig.indexes.chatId,
            KeyConditionExpression: 'chatId = :cid',
            ExpressionAttributeValues: { ':cid': chatId },
            Limit: 1
        });
        const result = await docClient.send(command);
        if (!result.Items || result.Items.length === 0) {
            return NextResponse.json(
                { error: `Chat with ID '${chatId}' not found.` },
                { status: 404 }
            );
        }
        const chat = result.Items[0] as Chat;
        return NextResponse.json(chat);
    } catch (error) {
        console.error("Error in getChatById:", error);
        return NextResponse.json(
            { error: "Failed to query chat details from database." },
            { status: 500 }
        );
    }
}