import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoClient } from '@/lib/AWS/AWS_CLIENT';
import { shareSessionConfig, type ShareSession } from '@/models/shareSessionModel';

const docClient2 = DynamoDBDocumentClient.from(dynamoClient);

export async function GET(request: NextRequest) {
    // console.log('/api/shareSession/byShareId called');
    
    const shareId = request.nextUrl.searchParams.get('shareId');
    if (!shareId) {
        return NextResponse.json({ error: 'Missing `shareId` parameter.' }, { status: 400 });
    }

    const command = new QueryCommand({
        TableName: shareSessionConfig.tableName,
        IndexName: shareSessionConfig.indexes.shareId,
        KeyConditionExpression: 'shareId = :sid',
        ExpressionAttributeValues: { ':sid': shareId },
        Limit: 1,
    });

    try {
        const result = await docClient2.send(command);
        if (!result.Items || result.Items.length === 0) {
            return NextResponse.json({ error: `shareSession with shareId '${shareId}' not found.` }, { status: 404 });
        }

        const shareSession = result.Items[0] as ShareSession;
        return NextResponse.json(shareSession);
    } catch (error) {
        console.error('DynamoDB QueryCommand failed in byShareId:', error);
        return NextResponse.json(
            { error: 'Failed to query chat details from database.' },
            { status: 500 }
        );
    }
}
