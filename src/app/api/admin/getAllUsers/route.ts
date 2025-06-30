import {
    DynamoDBDocumentClient,
    ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { NextResponse } from "next/server";
import { UserConfig } from "../../../../../models/userModel";
import { dynamoClient } from "@/lib/AWS/AWS_CLIENT";

const docClient = DynamoDBDocumentClient.from(dynamoClient);

export async function GET(request: Request) {
    try {

        const command = new ScanCommand({
            TableName: UserConfig.tableName,
        });
        const response = await docClient.send(command);
        return NextResponse.json(response.Items || []);
    } catch (error) {
        console.error('Get user error:', error);
        return NextResponse.json(
            { error: 'Failed to get user' },
            { status: 500 }
        );
    }
}