import { z } from 'zod';
import { procedure } from '../../trpc';
import { DocumentConfig } from '../../../../models/documentModel'; // Adjusted path
import { QueryCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { dynamoClient } from '@/lib/AWS/AWS_CLIENT';
import { DocumentWithStatus, DocumentWithStatusSchema } from '@/lib/utils';

const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const getDocumentProcessingStatusProcedure = procedure
    .input(z.object({ chatId: z.string() }))
    .query(async ({ input }): Promise<DocumentWithStatus[]> => {
        const command = new QueryCommand({
            TableName: DocumentConfig.tableName,
            KeyConditionExpression: "chatId = :cid",
            ExpressionAttributeValues: {
                ":cid": input.chatId,
            },
            // Specify only the attributes you need for the frontend display
            // ProjectionExpression: "docId, fileName, s3Key, uploadedAt, fileType, processingStatus, processingError, chatId",
        });

        try {
            const { Items } = await docClient.send(command);
            if (!Items) {
                return [];
            }
            // Validate each item against the schema to ensure type safety
            return Items.map(item => DocumentWithStatusSchema.parse(item));
        } catch (error) {
            console.error("Error fetching document processing statuses:", error);
            // Consider throwing a TRPCError here if appropriate
            throw new Error("Failed to fetch document processing statuses.");
        }
    }); 