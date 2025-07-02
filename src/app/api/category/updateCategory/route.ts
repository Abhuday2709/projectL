import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoClient } from '@/lib/AWS/AWS_CLIENT';
import { CategoryConfig } from '@/models/categoryModel';

const updClient = DynamoDBDocumentClient.from(dynamoClient);

export async function POST(request: NextRequest) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

    const { userId: uid, order, categoryId, categoryName, qualificationCutoff } = body;
    if (userId !== uid || typeof order !== 'number' || !categoryId || !categoryName)
        return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    const updateExpr = qualificationCutoff !== undefined
        ? 'SET categoryName = :name, qualificationCutoff = :cutoff'
        : 'SET categoryName = :name';

    const exprAttrVals: any = { ':name': categoryName };
    if (qualificationCutoff !== undefined) exprAttrVals[':cutoff'] = qualificationCutoff;

    try {
        await updClient.send(new UpdateCommand({
            TableName: CategoryConfig.tableName,
            Key: { user_id: uid, order },
            UpdateExpression: updateExpr,
            ExpressionAttributeValues: exprAttrVals,
        }));
        return NextResponse.json({ success: true });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }
}
