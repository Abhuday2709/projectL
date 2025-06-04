import { PutCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { ChatConfig, ChatSchema } from "../../../../../models/chatModel";
import { NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

// Initialize DynamoDB client with credentials
const client = new DynamoDBClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    }
});
const docClient = DynamoDBDocumentClient.from(client);

export async function POST(request: Request) {
    try {
        // Validate environment variables
        if (!process.env.AWS_REGION || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
            throw new Error('Missing AWS credentials in environment variables');
        }

        const body = await request.json();

        // Log incoming data for debugging
        console.log('Incoming chat data:', body);

        const chat = ChatSchema.parse({
            ...body,
            createdAt: new Date().toISOString()
        });

        const command = new PutCommand({
            TableName: ChatConfig.tableName,
            Item: chat,
            // Ensure we don't overwrite existing chats with same user_id and createdAt
            ConditionExpression: `attribute_not_exists(user_id) AND attribute_not_exists(createdAt)`
        });

        await docClient.send(command);
        return NextResponse.json(chat, { status: 201 });
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error('Create chat error:', {
                message: error.message,
                name: error.name,
                stack: error.stack
            });

            if (error.name === 'ResourceNotFoundException') {
                return NextResponse.json(
                    {
                        error: 'Chat table not found. Please ensure the table is created.',
                        details: process.env.NODE_ENV === 'development'
                            ? 'Run the createChatTable script to create the table.'
                            : undefined
                    },
                    { status: 500 }
                );
            }

            if (error.name === 'ConditionalCheckFailedException') {
                return NextResponse.json(
                    {
                        error: 'Chat already exists',
                        details: 'A chat with this user_id and timestamp already exists'
                    },
                    { status: 409 }
                );
            }
        }

        return NextResponse.json(
            {
                error: 'Failed to create chat',
                details: process.env.NODE_ENV === 'development' && error instanceof Error
                    ? error.message
                    : undefined
            },
            { status: 500 }
        );
    }
}