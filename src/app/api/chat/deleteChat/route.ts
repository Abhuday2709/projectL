// src/app/api/chat/deleteChat/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { DeleteCommand, DynamoDBDocumentClient, QueryCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoClient } from '@/lib/AWS/AWS_CLIENT';
import { ChatConfig } from '@/models/chatModel';
import { DocumentConfig } from '@/models/documentModel';
import { MessageConfig } from '@/models/messageModel';
import { shareSessionConfig } from '@/models/shareSessionModel';
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { QdrantClient } from "@qdrant/js-client-rest";

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
    host: process.env.QDRANT_HOST!,
    port: process.env.QDRANT_PORT ? parseInt(process.env.QDRANT_PORT!) : 6333,
});
const QDRANT_COLLECTION_NAME = process.env.QDRANT_COLLECTION_NAME!;

export async function DELETE(request: NextRequest) {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json(
                { error: "User is not authenticated." },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { user_id, createdAt } = body;

        if (!user_id || !createdAt) {
            return NextResponse.json(
                { error: "user_id and createdAt are required" },
                { status: 400 }
            );
        }

        // Check authorization
        if (userId !== user_id) {
            return NextResponse.json(
                { error: "Not authorized to delete this chat" },
                { status: 403 }
            );
        }

        // Step 0: Fetch chat details to get the actual chatId
        let chatIdForDocuments: string;
        try {
            const getChatCommand = new GetCommand({
                TableName: ChatConfig.tableName,
                Key: {
                    user_id: user_id,
                    createdAt: createdAt,
                },
            });
            const { Item: chatItem } = await docClient.send(getChatCommand);

            if (!chatItem) {
                return NextResponse.json(
                    { error: `Chat not found with user_id: ${user_id} and createdAt: ${createdAt}` },
                    { status: 404 }
                );
            }

            if (!chatItem.chatId || typeof chatItem.chatId !== 'string') {
                console.error('ChatItem:', chatItem);
                return NextResponse.json(
                    { error: 'Chat item found, but chatId is missing or not a string.' },
                    { status: 500 }
                );
            }

            chatIdForDocuments = chatItem.chatId as string;
        } catch (error) {
            console.error(`Error fetching chat details for user_id ${user_id}, createdAt ${createdAt}:`, error);
            return NextResponse.json(
                { error: 'Failed to fetch chat details for deletion process' },
                { status: 500 }
            );
        }

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
        } catch (error) {
            console.error(`Error fetching documents for chat ${chatIdForDocuments}:`, error);
            return NextResponse.json(
                { error: 'Failed to fetch documents for chat deletion' },
                { status: 500 }
            );
        }

        // Step 2: Delete each document's assets (S3, Qdrant) and its metadata (DynamoDB)
        for (const doc of documentsToDelete) {
            const s3Key = doc.s3Key as string;
            const docId = doc.docId as string;
            const uploadedAt = doc.uploadedAt as string;

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
            } catch (s3Error) {
                console.error(`Failed to delete S3 object ${s3Key} for chat ${chatIdForDocuments}:`, s3Error);
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
            } catch (qdrantError) {
                console.error(`Failed to delete Qdrant embeddings for docId ${docId}, chat ${chatIdForDocuments}:`, qdrantError);
            }

            // Delete document metadata from DynamoDB
            try {
                const dynamoDocDeleteCommand = new DeleteCommand({
                    TableName: DocumentConfig.tableName,
                    Key: {
                        chatId: chatIdForDocuments,
                        uploadedAt: uploadedAt,
                    },
                });
                await docClient.send(dynamoDocDeleteCommand);
            } catch (dynamoDocError) {
                console.error(`Failed to delete DynamoDB document metadata for chat ${chatIdForDocuments}, uploadedAt: ${uploadedAt}:`, dynamoDocError);
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
                for (const message of messages) {
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
                }
            }
        } catch (error) {
            console.error(`Error deleting messages for chat ${chatIdForDocuments}:`, error);
            console.warn(`Proceeding with chat deletion despite failure to delete all associated messages.`);
        }

        // Step 2.6: Delete the ShareSession associated with this chat
        try {
            const deleteShareSessionCommand = new DeleteCommand({
                TableName: shareSessionConfig.tableName,
                Key: {
                    chatId: chatIdForDocuments,
                },
            });
            await docClient.send(deleteShareSessionCommand);
        } catch (error) {
            console.error(`Failed to delete ShareSession for chatId ${chatIdForDocuments}:`, error);
        }

        // Step 3: Delete the chat itself from DynamoDB
        const chatDeleteCommand = new DeleteCommand({
            TableName: ChatConfig.tableName,
            Key: {
                user_id: user_id,
                createdAt: createdAt,
            },
        });

        try {
            await docClient.send(chatDeleteCommand);
        } catch (error) {
            console.error(`Failed to delete chat ${user_id}/${createdAt}:`, error);
            return NextResponse.json(
                { error: 'Failed to delete chat after processing documents' },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error in deleteChat:", error);
        return NextResponse.json(
            { error: "Failed to delete chat" },
            { status: 500 }
        );
    }
}