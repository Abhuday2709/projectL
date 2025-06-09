import { z } from 'zod';
import { procedure } from '../../trpc';
import { DocumentConfig, DocumentSchema } from '../../../../models/documentModel'; // Adjusted path
import { QueryCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { dynamoClient } from '@/lib/AWS/AWS_CLIENT';

const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Define the type for the items returned by the query, including the status fields
const DocumentWithStatusSchema = DocumentSchema.pick({
    docId: true,
    fileName: true,
    s3Key: true,
    uploadedAt: true, // Keep uploadedAt if it's part of your primary key or useful for sorting/display
    fileType: true,
    processingStatus: true,
    processingError: true,
    chatId: true, // Include chatId if useful for client-side cache or context
});
export type DocumentWithStatus = z.infer<typeof DocumentWithStatusSchema>;

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