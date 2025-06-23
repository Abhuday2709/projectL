import { z } from 'zod';
import { procedure } from '../../trpc'; // Adjusted import path
import { CategoryConfig, type Category } from '../../../../models/categoryModel'; // Adjusted import path
import { QueryCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { dynamoClient } from '@/lib/AWS/AWS_CLIENT';

// Create a document client using a common DynamoDB client instance.
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const getCategoriesProcedure = procedure
    .input(z.object({ user_id: z.string() }))
    .query(async ({ input, ctx }) => {
        if (!ctx.userId || ctx.userId !== input.user_id) {
            throw new Error("Not authorized to retrieve these categories");
        }
        const command = new QueryCommand({
            TableName: CategoryConfig.tableName,
            KeyConditionExpression: 'user_id = :uid',
            ExpressionAttributeValues: { ':uid': input.user_id },
            // Get newest categories first.
            ScanIndexForward: false,
        });
        const result = await docClient.send(command);
        return result.Items as Category[];
    }); 