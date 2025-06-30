import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoClient } from '@/lib/AWS/AWS_CLIENT';
import { CategoryConfig, type Category } from '../../../../../models/categoryModel';

const catClient = DynamoDBDocumentClient.from(dynamoClient);

export async function GET(request: NextRequest) {
    // Optionally, you can keep auth for admin-only access, or remove for public
    // const { userId } = await auth();

    try {
        const { Items } = await catClient.send(new ScanCommand({
            TableName: CategoryConfig.tableName,
        }));
        return NextResponse.json(Items as Category[]);
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Query failed' }, { status: 500 });
    }
}