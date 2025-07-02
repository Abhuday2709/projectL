import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { NextResponse } from "next/server";
import { UserSchema, UserConfig } from "@/models/userModel";
import { dynamoClient } from "@/lib/AWS/AWS_CLIENT";

const docClient = DynamoDBDocumentClient.from(dynamoClient);

export async function POST(request: Request) {

    try {
        console.log("HI");
        
        const body = await request.json();
        console.log("Create user request body:", body);
        
        // Validate the user data
        const validatedUser = UserSchema.parse({
            ...body,
            createdAt: new Date().toISOString()
        });

        // Create user in DynamoDB
        const command = new PutCommand({
            TableName: UserConfig.tableName,
            Item: validatedUser,
            ConditionExpression: "attribute_not_exists(user_id)", // Prevent overwriting existing users
        });

        await docClient.send(command);

        return NextResponse.json({ 
            message: "User created successfully",
            user: {
                user_id: validatedUser.user_id,
                email: validatedUser.email,
                firstName: validatedUser.firstName,
                lastName: validatedUser.lastName,
                createdAt: validatedUser.createdAt
            }
        });
    } catch (error) {
        console.error("Create user error:", error);
        
        // Handle validation errors
        if (error instanceof Error && error.name === 'ZodError') {
            return NextResponse.json(
                { error: "Invalid user data", details: error.message },
                { status: 400 }
            );
        }
        
        // Handle DynamoDB conditional check failure
        if (error instanceof Error && error.name === 'ConditionalCheckFailedException') {
            return NextResponse.json(
                { error: "User already exists" },
                { status: 409 }
            );
        }

        return NextResponse.json(
            { error: "Failed to create user" },
            { status: 500 }
        );
    }
}