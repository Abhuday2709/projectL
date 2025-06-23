import { z } from 'zod';
import { procedure } from '../../trpc'; // Adjusted import path
import { ChatConfig } from '../../../../models/chatModel'; // Adjusted import path
import { DocumentConfig } from '../../../../models/documentModel'; // Added import for DocumentConfig
import { MessageConfig } from '../../../../models/messageModel'; // Added import for MessageConfig
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


export const deleteChatProcedure = procedure
    .input(
        z.object({
            user_id: z.string(),
            createdAt: z.string(), // This is assumed to be the chatId for documents
        })
    )
    .mutation(async ({ input, ctx }) => {
        // Check that the authenticated user is allowed to delete the chat.
        if (!ctx.userId || ctx.userId !== input.user_id) {
            throw new TRPCError({ code: 'FORBIDDEN', message: "Not authorized to delete this chat" });
        }

        // Step 0: Fetch chat details to get the actual chatId
        let chatIdForDocuments: string;
        try {
            const getChatCommand = new GetCommand({
                TableName: ChatConfig.tableName,
                Key: {
                    user_id: input.user_id,
                    createdAt: input.createdAt,
                },
            });
            const { Item: chatItem } = await docClient.send(getChatCommand);

            if (!chatItem) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: `Chat not found with user_id: ${input.user_id} and createdAt: ${input.createdAt}`,
                });
            }
            if (!chatItem.chatId || typeof chatItem.chatId !== 'string') {
                console.error('ChatItem:', chatItem); // Log the item for debugging
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Chat item found, but chatId is missing or not a string.',
                });
            }
            chatIdForDocuments = chatItem.chatId as string;
            // console.log(`Retrieved chatId: ${chatIdForDocuments} for chat user_id: ${input.user_id}, createdAt: ${input.createdAt}`);

        } catch (error) {
            console.error(`Error fetching chat details for user_id ${input.user_id}, createdAt ${input.createdAt}:`, error);
            if (error instanceof TRPCError) throw error; // Re-throw TRPCError
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to fetch chat details for deletion process',
                cause: error,
            });
        }
        
        // const chatIdForDocuments = input.createdAt; // OLD LOGIC - REMOVED

        // Step 1: Fetch all documents associated with this chat
        const queryDocumentsCommand = new QueryCommand({
            TableName: DocumentConfig.tableName,
            KeyConditionExpression: "chatId = :cid",
            ExpressionAttributeValues: {
                ":cid": chatIdForDocuments,
            },
        });

        let documentsToDelete: Record<string, any>[] = [];
        try {
            const { Items } = await docClient.send(queryDocumentsCommand);
            if (Items) {
                documentsToDelete = Items;
            }
            // console.log(`Found ${documentsToDelete.length} documents for chat ${chatIdForDocuments}`);
        } catch (error) {
            console.error(`Error fetching documents for chat ${chatIdForDocuments}:`, error);
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to fetch documents for chat deletion',
                cause: error,
            });
        }

        // Step 2: Delete each document's assets (S3, Qdrant) and its metadata (DynamoDB)
        for (const doc of documentsToDelete) {
            const s3Key = doc.s3Key as string;
            const docId = doc.docId as string; // Used for Qdrant
            const uploadedAt = doc.uploadedAt as string; // Sort key for DocumentConfig table

            if (!s3Key || !docId || !uploadedAt) {
                console.warn(`Skipping document with missing s3Key, docId, or uploadedAt for chat ${chatIdForDocuments}:`, doc);
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
                console.error(`Failed to delete S3 object ${s3Key} for chat ${chatIdForDocuments}:`, s3Error);
                // Continue to delete other parts, but log the error
            }

            // Delete from Qdrant
            try {
                await qdrantClient.delete(QDRANT_COLLECTION_NAME, {
                    filter: {
                        must: [
                            { key: 'documentId', match: { value: docId } },
                            { key: 'chatId', match: { value: chatIdForDocuments } },
                        ],
                    },
                });
                // console.log(`Qdrant embeddings deleted successfully for docId: ${docId}, chatId: ${chatIdForDocuments}`);
            } catch (qdrantError) {
                console.error(`Failed to delete Qdrant embeddings for docId ${docId}, chat ${chatIdForDocuments}:`, qdrantError);
                // Continue to delete other parts, but log the error
            }

            // Delete document metadata from DynamoDB (DocumentConfig.tableName)
            try {
                const dynamoDocDeleteCommand = new DeleteCommand({
                    TableName: DocumentConfig.tableName,
                    Key: {
                        chatId: chatIdForDocuments,
                        uploadedAt: uploadedAt,
                    },
                });
                await docClient.send(dynamoDocDeleteCommand);
                // console.log(`DynamoDB document metadata deleted for chatId: ${chatIdForDocuments}, uploadedAt: ${uploadedAt}`);
            } catch (dynamoDocError) {
                console.error(`Failed to delete DynamoDB document metadata for chat ${chatIdForDocuments}, uploadedAt: ${uploadedAt}:`, dynamoDocError);
                // Continue, but log error
            }
        }

        // Step 2.5: Delete all messages associated with this chat
        try {
            const queryMessagesCommand = new QueryCommand({
                TableName: MessageConfig.tableName,
                KeyConditionExpression: "chatId = :cid",
                ExpressionAttributeValues: {
                    ":cid": chatIdForDocuments,
                },
            });
            const { Items: messages } = await docClient.send(queryMessagesCommand);

            if (messages && messages.length > 0) {
                // console.log(`Found ${messages.length} messages to delete for chat ${chatIdForDocuments}`);
                for (const message of messages) {
                    // Assuming messages have 'createdAt' as a sort key, similar to documents or chats.
                    // Adjust if the sort key for messages is different.
                    if (!message.createdAt) {
                        console.warn(`Skipping message deletion due to missing createdAt:`, message);
                        continue;
                    }
                    const deleteMessageCommand = new DeleteCommand({
                        TableName: MessageConfig.tableName,
                        Key: {
                            chatId: chatIdForDocuments,
                            createdAt: message.createdAt as string, 
                        },
                    });
                    await docClient.send(deleteMessageCommand);
                    // console.log(`Message deleted: chatId ${chatIdForDocuments}, createdAt ${message.createdAt}`);
                }
            } else {
                // console.log(`No messages found to delete for chat ${chatIdForDocuments}`);
            }
        } catch (error) {
            console.error(`Error deleting messages for chat ${chatIdForDocuments}:`, error);
            // Decide if this error should be fatal or just logged.
            // For now, logging and continuing to delete the main chat item.
            // You might want to throw a TRPCError here if message deletion is critical.
            console.warn(`Proceeding with chat deletion despite failure to delete all associated messages.`);
        }

        // Step 3: Delete the chat itself from DynamoDB
        const chatDeleteCommand = new DeleteCommand({
            TableName: ChatConfig.tableName,
            Key: {
                user_id: input.user_id,
                createdAt: input.createdAt,
            },
        });

        try {
            await docClient.send(chatDeleteCommand);
            // console.log(`Chat deleted successfully: user_id ${input.user_id}, createdAt ${input.createdAt}`);
        } catch (error) {
            console.error(`Failed to delete chat ${input.user_id}/${input.createdAt}:`, error);
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to delete chat after processing documents',
                cause: error,
            });
        }

        return { success: true };
    }); 