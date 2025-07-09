import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoClient } from '@/lib/AWS/AWS_CLIENT';
import { shareSessionConfig } from '@/models/shareSessionModel';

const docClient = DynamoDBDocumentClient.from(dynamoClient);

export type UpdatePayload = {
    chatId: string;
    password?: string;
    validityDays?: number;
    isActive?: boolean;
};

export async function POST(request: NextRequest) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'User is not authenticated.' }, { status: 401 });
    }

    const body: UpdatePayload = await request.json();
    const { chatId, password, validityDays, isActive } = body;

    if (!chatId) {
        return NextResponse.json({ error: 'chatId is required.' }, { status: 400 });
    }

    // Build UpdateExpression dynamically
    const updateExpressions: string[] = [];
    const expressionAttributeValues: Record<string, any> = {};

    if (password && typeof validityDays === 'number') {
        const now = new Date();
        const passwordCreatedAt = now.toISOString();
        // TTL is in seconds, Date.now() is in milliseconds
        const expiresAt = Math.floor(Date.now() / 1000) + validityDays * 86400;

        updateExpressions.push('password = :pwd', 'passwordCreatedAt = :pca', 'expiresAt = :exp', 'isActive = :act');
        expressionAttributeValues[':pwd'] = password;
        expressionAttributeValues[':pca'] = passwordCreatedAt;
        expressionAttributeValues[':exp'] = expiresAt;
        expressionAttributeValues[':act'] = true; // Always activate on new password
    } else if (typeof isActive === 'boolean') {
        updateExpressions.push('isActive = :act');
        expressionAttributeValues[':act'] = isActive;
    } else {
        return NextResponse.json({ error: 'Invalid payload. Provide password and validity, or an active status.' }, { status: 400 });
    }

    if (updateExpressions.length === 0) {
        return NextResponse.json({ error: 'No update parameters provided.' }, { status: 400 });
    }

    try {
        await docClient.send(
            new UpdateCommand({
                TableName: shareSessionConfig.tableName,
                Key: { chatId },
                UpdateExpression: `SET ${updateExpressions.join(', ')}`,
                ExpressionAttributeValues: expressionAttributeValues,
            })
        );
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Update failed.' }, { status: 500 });
    }
}
