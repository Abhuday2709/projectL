import {
    DynamoDBDocumentClient,
    ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { NextResponse } from "next/server";
import { scoringSessionConfig } from "../../../../../models/scoringReviewModel";
import { dynamoClient } from "@/lib/AWS/AWS_CLIENT";

const docClient = DynamoDBDocumentClient.from(dynamoClient);

export async function GET(request: Request) {
    try {
        const command = new ScanCommand({
            TableName: scoringSessionConfig.tableName,
        });
        const response = await docClient.send(command);
        return NextResponse.json(response.Items || []);
    } catch (error) {
        console.error('Get review error:', error);
        return NextResponse.json(
            { error: 'Failed to get reviews' },
            { status: 500 }
        );
    }
}