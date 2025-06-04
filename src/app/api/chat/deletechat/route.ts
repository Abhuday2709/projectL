import { DeleteCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { ChatConfig } from "../../../../../models/chatModel";
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

export async function DELETE(request: Request) {
    try {
        // Validate environment variables
        if (!process.env.AWS_REGION || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
            throw new Error('Missing AWS credentials in environment variables');
        }

        // Parse request body for keys
        const body = await request.json();
        console.log('Incoming delete chat data:', body);

        const { user_id, createdAt } = body;
        if (!user_id || !createdAt) {
            return NextResponse.json(
                { error: 'user_id and createdAt are required' },
                { status: 400 }
            );
        }

        // Create and send delete command
        const command = new DeleteCommand({
            TableName: ChatConfig.tableName,
            Key: {
                user_id,
                createdAt
            }
        });

        await docClient.send(command);
        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error: unknown) {
        console.error('Delete chat error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to delete chat' },
            { status: 500 }
        );
    }
}