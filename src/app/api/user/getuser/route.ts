import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { 
    DynamoDBDocumentClient, 
    GetCommand,
    QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { NextResponse } from "next/server";
import {  UserConfig } from "../../../../../models/userModel";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const email = searchParams.get('email');

        if (userId) {
            const command = new GetCommand({
                TableName: UserConfig.tableName,
                Key: { userId }
            });
            const response = await docClient.send(command);
            return NextResponse.json(response.Item);
        }

        if (email) {
            const command = new QueryCommand({
                TableName: UserConfig.tableName,
                IndexName: UserConfig.indexes.email,
                KeyConditionExpression: 'email = :email',
                ExpressionAttributeValues: { ':email': email }
            });
            const response = await docClient.send(command);
            return NextResponse.json(response.Items?.[0] || null);
        }

        return NextResponse.json(
            { error: 'userId or email parameter required' },
            { status: 400 }
        );
    } catch (error) {
        console.error('Get user error:', error);
        return NextResponse.json(
            { error: 'Failed to get user' },
            { status: 500 }
        );
    }
}