import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoClient } from '@/lib/AWS/AWS_CLIENT';
import { CategoryConfig, type Category } from '../../../../../models/categoryModel';

const catClient = DynamoDBDocumentClient.from(dynamoClient);

export async function GET(request: NextRequest) {
    const { userId } = await auth();
    const uid = request.nextUrl.searchParams.get('user_id');
    if (!userId || userId !== uid)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!uid) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });

    try {
        const { Items } = await catClient.send(new QueryCommand({
            TableName: CategoryConfig.tableName,
            KeyConditionExpression: 'user_id = :uid',
            ExpressionAttributeValues: { ':uid': uid },
            ScanIndexForward: false,
        }));
        return NextResponse.json(Items as Category[]);
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Query failed' }, { status: 500 });
    }
}