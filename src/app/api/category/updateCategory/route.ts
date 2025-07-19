import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoClient } from '@/lib/AWS/AWS_CLIENT';
import { CategoryConfig } from '@/models/categoryModel';

////////////////////////////////////////////////////////////////////////////////
// Update Category Endpoint
////////////////////////////////////////////////////////////////////////////////

/**
 * DynamoDB client for updating category table.
 */
const updClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * POST /api/categories/update
 * Updates a category's name and optionally qualificationCutoff.
 * Requires Clerk authentication.
 *
 * @param {NextRequest} request - JSON body with userId, order, categoryId, categoryName, [qualificationCutoff].
 * @returns {Promise<NextResponse>} JSON success or error message.
 * @usage
 * POST /api/category/updateCategory
 * Body: {
 *   userId: string,
 *   order: number,
 *   categoryId: string,
 *   categoryName: string,
 *   qualificationCutoff?: number
 * }
 */
export async function PUT(request: NextRequest) {
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

    const { categoryId, categoryName, qualificationCutoff, createdAt } = body;
    if (!categoryId || !categoryName || !createdAt) {
        return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    const updateExpr = qualificationCutoff !== undefined
        ? 'SET categoryName = :name, qualificationCutoff = :cutoff'
        : 'SET categoryName = :name';

    const exprAttrVals: any = { ':name': categoryName };
    if (qualificationCutoff !== undefined) exprAttrVals[':cutoff'] = qualificationCutoff;

    try {
        await updClient.send(new UpdateCommand({
            TableName: CategoryConfig.tableName,
            Key: { categoryId , createdAt },
            UpdateExpression: updateExpr,
            ExpressionAttributeValues: exprAttrVals,
        }));
        return NextResponse.json({ success: true });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }
}
