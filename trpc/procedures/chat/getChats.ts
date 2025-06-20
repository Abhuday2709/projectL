import { z } from 'zod';
import { procedure } from '../../trpc'; // Adjusted import path
import { ChatConfig, type Chat } from '../../../../models/chatModel'; // Adjusted import path
import { QueryCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { dynamoClient } from '@/lib/AWS/AWS_CLIENT';

// Create a document client using a common DynamoDB client instance.
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const getChatsProcedure = procedure
    .input(z.object({ user_id: z.string() }))
    .query(async ({ input, ctx }) => {
        if (!ctx.userId || ctx.userId !== input.user_id) {
            throw new Error("Not authorized to retrieve these chats");
        }
        const command = new QueryCommand({
            TableName: ChatConfig.tableName,
            KeyConditionExpression: 'user_id = :uid',
            ExpressionAttributeValues: { ':uid': input.user_id },
            // Get newest chats first.
            ScanIndexForward: false,
        });
        const result = await docClient.send(command);
        return result.Items as Chat[];
    }); 