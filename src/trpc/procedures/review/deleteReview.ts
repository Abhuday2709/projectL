import { z } from 'zod';
import { procedure } from '../../trpc'; // Adjusted import path
import { scoringSessionConfig } from '../../../../models/scoringReviewModel'; // Adjusted import path
import { DocumentConfig } from '../../../../models/documentModel'; // Added import for DocumentConfig
import { DeleteCommand, DynamoDBDocumentClient, QueryCommand, GetCommand } from "@aws-sdk/lib-dynamodb"; // Added QueryCommand and GetCommand
import { dynamoClient } from '@/lib/AWS/AWS_CLIENT';
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3"; // Added S3 imports
import { QdrantClient } from "@qdrant/js-client-rest"; // Added Qdrant import
import { TRPCError } from "@trpc/server"; // Added TRPCError import

// Create a document client using a common DynamoDB client instance.
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// S3 Client Initialization
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


export const deleteReviewProcedure = procedure
    .input(
        z.object({
            user_id: z.string(),
            createdAt: z.string(), // This is assumed to be the scoringSessionId for documents
        })
    )
    .mutation(async ({ input, ctx }) => {
        // Check that the authenticated user is allowed to delete the chat.
        if (!ctx.userId || ctx.userId !== input.user_id) {
            throw new TRPCError({ code: 'FORBIDDEN', message: "Not authorized to delete this chat" });
        }

        // Step 0: Fetch chat details to get the actual scoringSessionId
        let revviewIdForDocuments: string;
        try {
            const getChatCommand = new GetCommand({
                TableName: scoringSessionConfig.tableName,
                Key: {
                    user_id: input.user_id,
                    createdAt: input.createdAt,
                },
            });
            const { Item: reviewItem } = await docClient.send(getChatCommand);

            if (!reviewItem) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: `Review not found with user_id: ${input.user_id} and createdAt: ${input.createdAt}`,
                });
            }
            if (!reviewItem.scoringSessionId || typeof reviewItem.scoringSessionId !== 'string') {
                console.error('ReviewItem:', reviewItem); // Log the item for debugging
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Review item found, but scoringSessionId is missing or not a string.',
                });
            }
            revviewIdForDocuments = reviewItem.scoringSessionId as string;
            // console.log(`Retrieved scoringSessionId: ${revviewIdForDocuments} for chat user_id: ${input.user_id}, createdAt: ${input.createdAt}`);

        } catch (error) {
            console.error(`Error fetching review details for user_id ${input.user_id}, createdAt ${input.createdAt}:`, error);
            if (error instanceof TRPCError) throw error; // Re-throw TRPCError
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to fetch review details for deletion process',
                cause: error,
            });
        }
        
        // const revviewIdForDocuments = input.createdAt; // OLD LOGIC - REMOVED

        // Step 1: Fetch all documents associated with this chat
        const queryDocumentsCommand = new QueryCommand({
            TableName: DocumentConfig.tableName,
            KeyConditionExpression: "chatId = :cid",
            ExpressionAttributeValues: {
                ":cid": revviewIdForDocuments,
            },
        });

        let documentsToDelete: Record<string, any>[] = [];
        try {
            const { Items } = await docClient.send(queryDocumentsCommand);
            if (Items) {
                documentsToDelete = Items;
            }
            console.log(`Found ${documentsToDelete.length} documents for review ${revviewIdForDocuments}`);
        } catch (error) {
            console.error(`Error fetching documents for review ${revviewIdForDocuments}:`, error);
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to fetch documents for review deletion',
                cause: error,
            });
        }

        // Step 2: Delete each document's assets (S3, Qdrant) and its metadata (DynamoDB)
        for (const doc of documentsToDelete) {
            const s3Key = doc.s3Key as string;
            const docId = doc.docId as string; // Used for Qdrant
            const uploadedAt = doc.uploadedAt as string; // Sort key for DocumentConfig table

            if (!s3Key || !docId || !uploadedAt) {
                console.warn(`Skipping document with missing s3Key, docId, or uploadedAt for review ${revviewIdForDocuments}:`, doc);
                continue;
            }

            // Delete from S3
            try {
                const s3Command = new DeleteObjectCommand({
                    Bucket: process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME!,
                    Key: s3Key,
                });
                await s3Client.send(s3Command);
                // console.log(`S3 object deleted successfully: ${s3Key}`);
            } catch (s3Error) {
                console.error(`Failed to delete S3 object ${s3Key} for chat ${revviewIdForDocuments}:`, s3Error);
                // Continue to delete other parts, but log the error
            }

            // Delete from Qdrant
            try {
                await qdrantClient.delete(QDRANT_COLLECTION_NAME, {
                    filter: {
                        must: [
                            { key: 'documentId', match: { value: docId } },
                            { key: 'chatId', match: { value: revviewIdForDocuments } },
                        ],
                    },
                });
                // console.log(`Qdrant embeddings deleted successfully for docId: ${docId}, chatId: ${revviewIdForDocuments}`);
            } catch (qdrantError) {
                console.error(`Failed to delete Qdrant embeddings for docId ${docId}, review ${revviewIdForDocuments}:`, qdrantError);
                // Continue to delete other parts, but log the error
            }

            // Delete document metadata from DynamoDB (DocumentConfig.tableName)
            try {
                const dynamoDocDeleteCommand = new DeleteCommand({
                    TableName: DocumentConfig.tableName,
                    Key: {
                        chatId: revviewIdForDocuments,
                        uploadedAt: uploadedAt,
                    },
                });
                await docClient.send(dynamoDocDeleteCommand);
                // console.log(`DynamoDB document metadata deleted for chatId: ${revviewIdForDocuments}, uploadedAt: ${uploadedAt}`);
            } catch (dynamoDocError) {
                console.error(`Failed to delete DynamoDB document metadata for review ${revviewIdForDocuments}, uploadedAt: ${uploadedAt}:`, dynamoDocError);
                // Continue, but log error
            }
        }
        // Step 3: Delete the chat itself from DynamoDB
        const reviewDeleteCommand = new DeleteCommand({
            TableName: scoringSessionConfig.tableName,
            Key: {
                user_id: input.user_id,
                createdAt: input.createdAt,
            },
        });

        try {
            await docClient.send(reviewDeleteCommand);
            // console.log(`Review deleted successfully: user_id ${input.user_id}, createdAt ${input.createdAt}`);
        } catch (error) {
            console.error(`Failed to delete review ${input.user_id}/${input.createdAt}:`, error);
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to delete review after processing documents',
                cause: error,
            });
        }

        return { success: true };
    }); 