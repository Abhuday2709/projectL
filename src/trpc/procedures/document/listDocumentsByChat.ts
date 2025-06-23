import { z } from "zod";
import { procedure } from "../../trpc"; // Adjusted import path
import { QueryCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { dynamoClient } from '@/lib/AWS/AWS_CLIENT';
import { DocumentConfig, type Document } from '../../../../models/documentModel'; // Adjusted import path

// Create a document client using a common DynamoDB client instance.
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const listDocumentsByChatProcedure = procedure
    .input(z.object({ chatId: z.string() }))
    .query(async ({ input }) => {
        const command = new QueryCommand({
            TableName: DocumentConfig.tableName,
            KeyConditionExpression: 'chatId = :cid',
            ExpressionAttributeValues: { ':cid': input.chatId },
            // Optionally, order by uploadedAt if you have a sort key
            // ScanIndexForward: false,
        });
        const result = await docClient.send(command);
        return result.Items as Document[];
    });