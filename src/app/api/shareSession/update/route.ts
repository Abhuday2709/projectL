import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoClient } from '@/lib/AWS/AWS_CLIENT';
import { shareSessionConfig } from '../../../../../models/shareSessionModel';

const docClient3 = DynamoDBDocumentClient.from(dynamoClient);

export async function POST(request: NextRequest) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'User is not authenticated.' }, { status: 401 });
    }

    let body: { chatId: string; password: string; isActive: boolean };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    const { chatId, password, isActive } = body;
    if (!chatId || typeof password !== 'string' || typeof isActive !== 'boolean') {
        return NextResponse.json({ error: 'chatId, password, and isActive are required.' }, { status: 400 });
    }

    try {
        await docClient3.send(
            new UpdateCommand({
                TableName: shareSessionConfig.tableName,
                Key: { chatId },
                UpdateExpression: 'SET password = :password, isActive = :isActive',
                ExpressionAttributeValues: {
                    ':password': password,
                    ':isActive': isActive,
                },
            })
        );
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('DynamoDB UpdateCommand failed in updateShareSession:', error);
        return NextResponse.json(
            { error: 'Failed to update shareSession.' },
            { status: 500 }
        );
    }
}
