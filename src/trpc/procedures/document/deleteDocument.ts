import { z } from "zod";
import { procedure } from "../../trpc"; // Adjusted import path
import { DeleteCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { dynamoClient } from '@/lib/AWS/AWS_CLIENT';
import { DocumentConfig } from '../../../../models/documentModel'; // Adjusted import path
import { TRPCError } from "@trpc/server";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { QdrantClient } from "@qdrant/js-client-rest"; // Qdrant client

// Update S3 client initialization with proper configuration
const s3Client = new S3Client({
    region: process.env.NEXT_PUBLIC_AWS_REGION,
    credentials: {
        accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY || '',
    }, 
});

// Qdrant Client Initialization
const qdrantClient = new QdrantClient({
    host: process.env.QDRANT_HOST || 'localhost',
    port: process.env.QDRANT_PORT ? parseInt(process.env.QDRANT_PORT) : 6333,
});

const QDRANT_COLLECTION_NAME = process.env.QDRANT_COLLECTION_NAME || 'document_embeddings';

// Create a document client using a common DynamoDB client instance.
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const deleteDocumentProcedure = procedure
    .input(
        z.object({
            chatId: z.string(),
            docId: z.string().uuid(),
            s3Key: z.string(),
            uploadedAt: z.string(),
        })
    )
    .mutation(async ({ input }) => {
        console.log('Starting delete operation for:', input);

        // First delete from DynamoDB
        try {
            const dynamoCommand = new DeleteCommand({
                TableName: DocumentConfig.tableName,
                Key: {
                    chatId: input.chatId,
                    uploadedAt: input.uploadedAt,  // Use uploadedAt as sort key
                },
                // Add condition to ensure item exists
                ConditionExpression: 'attribute_exists(chatId) AND attribute_exists(uploadedAt)',
            });

            await docClient.send(dynamoCommand);
            console.log('DynamoDB delete successful');
        } catch (dynamoError) {
            console.error('DynamoDB deletion error:', dynamoError);
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to delete document from database',
                cause: dynamoError,
            });
        }

        // Then delete from S3
        try {
            const s3Command = new DeleteObjectCommand({
                Bucket: process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME!,
                Key: input.s3Key,
            });
            await s3Client.send(s3Command);
            console.log('S3 delete successful');
        } catch (s3Error) {
            console.error('S3 deletion error:', s3Error);
            console.warn('Failed to delete from S3, but DynamoDB delete was successful');
        }

        // Finally, delete from Qdrant
        try {
            console.log(`Attempting to delete embeddings from Qdrant for docId: ${input.docId} and chatId: ${input.chatId}`);
            await qdrantClient.delete(QDRANT_COLLECTION_NAME, {
                filter: {
                    must: [
                        {
                            key: 'documentId', // Ensure this matches the payload key in worker.ts
                            match: {
                                value: input.docId,
                            },
                        },
                        {
                            key: 'chatId', // Ensure this matches the payload key in worker.ts
                            match: {
                                value: input.chatId,
                            },
                        },
                    ],
                },
            });
            console.log('Qdrant embeddings deletion successful (or no matching points found).');
        } catch (qdrantError) {
            console.error('Qdrant deletion error:', qdrantError);
            // Decide on error handling: maybe just log, or throw if critical
            // For now, log and continue as primary data (DynamoDB/S3) is deleted.
            console.warn('Failed to delete embeddings from Qdrant. Document metadata and S3 object were deleted.');
        }

        return { success: true };
    }); 