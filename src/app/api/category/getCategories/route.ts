import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoClient } from '@/lib/AWS/AWS_CLIENT';
import { CategoryConfig, type Category } from '@/models/categoryModel';

////////////////////////////////////////////////////////////////////////////////
// List Categories Endpoint
////////////////////////////////////////////////////////////////////////////////

/**
 * DynamoDB client for scanning category table.
 */
const catClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * GET /api/categories
 * Retrieves all category records from DynamoDB.
 * @param {NextRequest} request - Incoming request (no body).
 * @returns {Promise<NextResponse>} JSON array of Category objects, or error.
 * @usage
 * GET /api/category/getCategories
 */
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