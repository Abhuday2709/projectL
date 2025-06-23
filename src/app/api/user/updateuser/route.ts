import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { 
    DynamoDBDocumentClient,  
    UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { NextResponse } from "next/server";
import { UserConfig } from "../../../../../models/userModel";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export async function PATCH(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        if (!userId) {
            return NextResponse.json(
                { error: 'userId parameter required' },
                { status: 400 }
            );
        }

        const updates = await request.json();
        const updateExpr = Object.keys(updates)
            .map(key => `#${key} = :${key}`)
            .join(', ');

        const command = new UpdateCommand({
            TableName: UserConfig.tableName,
            Key: { userId },
            UpdateExpression: `SET ${updateExpr}`,
            ExpressionAttributeNames: Object.keys(updates)
                .reduce((acc, key) => ({ ...acc, [`#${key}`]: key }), {}),
            ExpressionAttributeValues: Object.entries(updates)
                .reduce((acc, [key, value]) => ({ ...acc, [`:${key}`]: value }), {}),
            ReturnValues: 'ALL_NEW'
        });

        const response = await docClient.send(command);
        return NextResponse.json(response.Attributes);
    } catch (error) {
        console.error('Update user error:', error);
        return NextResponse.json(
            { error: 'Failed to update user' },
            { status: 500 }
        );
    }
}