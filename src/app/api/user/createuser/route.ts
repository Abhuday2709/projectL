import { PutCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {  UserConfig, UserSchema } from "../../../../../models/userModel";
import { NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

// Initialize DynamoDB client with credentials
const client = new DynamoDBClient({
    region: process.env.NEXT_PUBLIC_AWS_REGION,
    credentials: {
        accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY!,
    }
});
const docClient = DynamoDBDocumentClient.from(client);

export async function POST(request: Request) {
    try {
        // Validate environment variables
        if (!process.env.NEXT_PUBLIC_AWS_REGION || !process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID || !process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY) {
            throw new Error('Missing AWS credentials in environment variables');
        }

        const body = await request.json();
        

        const user = UserSchema.parse(body);

        const command = new PutCommand({
            TableName: UserConfig.tableName,
            Item: {
                ...user,
                createdAt: new Date().toISOString() // Ensure createdAt is set
            },
            ConditionExpression: "attribute_not_exists(userId)"
        });

        await docClient.send(command);
        return NextResponse.json(user, { status: 201 });
    } catch (error: unknown) {
        // More detailed error logging
        if (error instanceof Error) {
            if (error.name === 'ResourceNotFoundException') {
                return NextResponse.json(
                    { 
                        error: 'Database table not found. Please ensure the table is created.',
                        details: process.env.NODE_ENV === 'development' 
                            ? 'Run the createDynamoTable script to create the table.'
                            : undefined
                    },
                    { status: 500 }
                );
            }
        }

        return NextResponse.json(
            { 
                error: 'Failed to create user',
                details: process.env.NODE_ENV === 'development' && error && typeof error === "object" && "message" in error
                    ? (error as { message?: string }).message
                    : undefined
            },
            { status: 500 }
        );
    }
}