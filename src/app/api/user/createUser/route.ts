import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { NextResponse } from "next/server";
import { UserSchema, UserConfig } from "@/models/userModel";
import { dynamoClient } from "@/lib/AWS/AWS_CLIENT";

const docClient = DynamoDBDocumentClient.from(dynamoClient);

export async function POST(request: Request) {

    try {
        // console.log("HI");
        
        const body = await request.json();
        if(body.user_id === undefined || body.email === undefined) {
            return NextResponse.json(
                { error: "Missing required user fields" },
                { status: 400 }
            );
        }

        // Create user in DynamoDB
        const command = new PutCommand({
            TableName: UserConfig.tableName,
            Item: {
                user_id: body.user_id,
                email: body.email,
                firstName: body.firstName, 
                lastName: body.lastName,
                passwordHash: body.passwordHash, 
                role: body.role || "user", 
                createdAt: new Date().toISOString(),
            },
            ConditionExpression: "attribute_not_exists(user_id)", 
        });

        await docClient.send(command);

        return NextResponse.json({ 
            message: "User created successfully",
            user: {
                user_id: body.user_id,
                email: body.email,
                firstName: body.firstName,
                lastName: body.lastName,
                passwordHash: body.passwordHash,
                createdAt: body.createdAt
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