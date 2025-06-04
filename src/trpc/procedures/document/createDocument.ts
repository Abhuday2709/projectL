import { z } from "zod";
import { procedure } from "../../trpc"; // Adjusted import path
import { PutCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { dynamoClient } from '@/lib/AWS/AWS_CLIENT';
import { DocumentSchema, DocumentConfig, type Document } from '../../../../models/documentModel'; // Adjusted import path
import { ACCEPTED_FILE_TYPES } from '@/lib/utils'; 
import { myQueue } from '@/lib/queue'; // Import BullMQ queue

// Create a document client using a common DynamoDB client instance.
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const createDocumentProcedure = procedure
    .input(
        DocumentSchema.pick({ 
            chatId: true, 
            docId: true, 
            fileName: true, 
            s3Key: true, 
            fileType: true 
        })
    )
    .mutation(async ({ input }) : Promise<Document> => {
        const document: Document = {
            ...input,
            uploadedAt: new Date().toISOString(),
        };

        const command = new PutCommand({
            TableName: DocumentConfig.tableName,
            Item: document,
            ConditionExpression: `attribute_not_exists(chatId) AND attribute_not_exists(docId)`,
        });
        
        try {
            await docClient.send(command);

            // Enqueue the document for processing after successful DynamoDB put
            try {
                await myQueue.add('processDocument', document, {
                    jobId: document.docId, // Use docId for idempotency
                });
                // console.log(`Document ${document.docId} enqueued for processing.`);
            } catch (queueError) {
                console.error(`Failed to enqueue document ${document.docId}:`, queueError);
                // Potentially throw an error or handle compensation (e.g., delete from DynamoDB or mark for later queueing)
                // For now, we re-throw, so the client knows the full operation wasn't successful.
                throw new Error('Document saved but failed to enqueue for processing.');
            }

            return document;
        } catch (error) {
            console.error("Error in createDocumentProcedure:", error);
            if (error instanceof Error && error.name === 'ConditionalCheckFailedException') {
                throw new Error('Document with this ID already exists for this chat.');
            }
            // If it's not a known error from queueing, throw a generic one.
            if (!(error instanceof Error && error.message === 'Document saved but failed to enqueue for processing.')) {
                 throw new Error('Failed to create document or queue for ingestion.');
            }
            throw error; // Re-throw the specific queueing error if it was that
        }
    }); 