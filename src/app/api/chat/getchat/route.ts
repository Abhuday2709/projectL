import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { 
    DynamoDBDocumentClient, 
    QueryCommand
} from "@aws-sdk/lib-dynamodb";
import { NextResponse } from "next/server";
import { ChatConfig } from "../../../../../models/chatModel";

// Initialize DynamoDB client
const client = new DynamoDBClient({
    region: process.env.NEXT_PUBLIC_AWS_REGION,
    credentials: {
        accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY!,
    }
});
const docClient = DynamoDBDocumentClient.from(client);

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const chatId = searchParams.get('chatId');

        if (!userId) {
            return NextResponse.json(
                { error: 'userId is required' },
                { status: 400 }
            );
        }

        // If chatId is provided, get specific chat
        if (chatId) {
            const command = new QueryCommand({
                TableName: ChatConfig.tableName,
                KeyConditionExpression: `${ChatConfig.keys.partition} = :userId`,
                FilterExpression: 'chatId = :chatId',
                ExpressionAttributeValues: {
                    ':userId': userId,
                    ':chatId': chatId
                }
            });

            const response = await docClient.send(command);
            const chat = response.Items?.[0];

            if (!chat) {
                return NextResponse.json(
                    { error: 'Chat not found' },
                    { status: 404 }
                );
            }

            return NextResponse.json(chat);
        }

        // Get all chats for the user
        const command = new QueryCommand({
            TableName: ChatConfig.tableName,
            KeyConditionExpression: `${ChatConfig.keys.partition} = :userId`,
            ExpressionAttributeValues: {
                ':userId': userId
            },
            // Sort by createdAt in descending order (newest first)
            ScanIndexForward: false
        });

        const response = await docClient.send(command);
        return NextResponse.json(response.Items || []);

    } catch (error: unknown) {
        console.error('Get chat error:', error);

        if (error instanceof Error) {
            if (error.name === 'ResourceNotFoundException') {
                return NextResponse.json(
                    { 
                        error: 'Chat table not found',
                        details: process.env.NODE_ENV === 'development' 
                            ? 'Ensure the Chats table is created' 
                            : undefined
                    },
                    { status: 500 }
                );
            }
        }

        return NextResponse.json(
            { 
                error: 'Failed to get chat(s)',
                details: process.env.NODE_ENV === 'development' && error instanceof Error 
                    ? error.message 
                    : undefined
            },
            { status: 500 }
        );
    }
}