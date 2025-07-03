import { DynamoDBDocumentClient, DeleteCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { NextResponse } from "next/server";
import { UserConfig } from "@/models/userModel";
import { clerkClient } from "@clerk/nextjs/server";
import { dynamoClient } from "@/lib/AWS/AWS_CLIENT";
import { ChatConfig } from "@/models/chatModel";
import { DocumentConfig } from "@/models/documentModel";
import { MessageConfig } from "@/models/messageModel";
import { shareSessionConfig } from "@/models/shareSessionModel";
import { scoringSessionConfig } from "@/models/scoringReviewModel";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { QdrantClient } from "@qdrant/js-client-rest";

const docClient = DynamoDBDocumentClient.from(dynamoClient);

const s3Client = new S3Client({
    region: process.env.NEXT_PUBLIC_AWS_REGION!,
    credentials: {
        accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY!,
    },
});

const qdrantClient = new QdrantClient({
    host: process.env.QDRANT_HOST!,
    port: parseInt(process.env.QDRANT_PORT!),
});

const QDRANT_COLLECTION_NAME = process.env.QDRANT_COLLECTION_NAME!;

async function deleteDocuments(chatId: string) {
    const queryDocs = new QueryCommand({
        TableName: DocumentConfig.tableName,
        KeyConditionExpression: "chatId = :cid",
        ExpressionAttributeValues: { ":cid": chatId },
    });
    const { Items: documents } = await docClient.send(queryDocs);

    if (!documents) return;

    for (const doc of documents) {
        // Delete from S3
        if (doc.s3Key) {
            await s3Client.send(new DeleteObjectCommand({ Bucket: process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME!, Key: doc.s3Key }));
        }
        // Delete from Qdrant
        await qdrantClient.delete(QDRANT_COLLECTION_NAME, {
            filter: { must: [{ key: 'documentId', match: { value: doc.docId } }, { key: 'chatId', match: { value: chatId } }] }
        });
        // Delete from DynamoDB
        await docClient.send(new DeleteCommand({ TableName: DocumentConfig.tableName, Key: { chatId: chatId, uploadedAt: doc.uploadedAt } }));
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        const { userId } = await params;
        console.log("Deleting user with ID:", userId);

        if (!userId) {
            return NextResponse.json({ error: "userId parameter required" }, { status: 400 });
        }

        // 1. Fetch and delete all chats and associated data
        const userChatsQuery = new QueryCommand({
            TableName: ChatConfig.tableName,
            KeyConditionExpression: 'user_id = :uid',
            ExpressionAttributeValues: { ':uid': userId },
        });
        const { Items: chats } = await docClient.send(userChatsQuery);

        if (chats) {
            for (const chat of chats) {
                const chatId = chat.chatId;
                // Delete associated documents (S3, Qdrant, DynamoDB)
                await deleteDocuments(chatId);

                // Delete messages
                const queryMessages = new QueryCommand({ TableName: MessageConfig.tableName, KeyConditionExpression: "chatId = :cid", ExpressionAttributeValues: { ":cid": chatId } });
                const { Items: messages } = await docClient.send(queryMessages);
                if (messages) {
                    for (const message of messages) {
                        await docClient.send(new DeleteCommand({ TableName: MessageConfig.tableName, Key: { chatId, createdAt: message.createdAt } }));
                    }
                }

                // Delete share session
                await docClient.send(new DeleteCommand({ TableName: shareSessionConfig.tableName, Key: { chatId } }));

                // Delete chat item itself
                await docClient.send(new DeleteCommand({ TableName: ChatConfig.tableName, Key: { user_id: userId, createdAt: chat.createdAt } }));
            }
        }

        // 2. Fetch and delete all reviews and associated data
        const userReviewsQuery = new QueryCommand({
            TableName: scoringSessionConfig.tableName,
            KeyConditionExpression: 'user_id = :uid',
            ExpressionAttributeValues: { ':uid': userId },
        });
        const { Items: reviews } = await docClient.send(userReviewsQuery);

        if (reviews) {
            for (const review of reviews) {
                const sessionId = review.scoringSessionId;
                // In reviews, the sessionId is used as the chatId for documents
                await deleteDocuments(sessionId);
                // Delete review item itself
                await docClient.send(new DeleteCommand({ TableName: scoringSessionConfig.tableName, Key: { user_id: userId, createdAt: review.createdAt } }));
            }
        }

        // 3. Delete user from DynamoDB
        const command = new DeleteCommand({
            TableName: UserConfig.tableName,
            Key: { user_id: userId },
        });
        await docClient.send(command);

        // 4. Delete from Clerk
        try {
            const client = await clerkClient();
            await client.users.deleteUser(userId);
        } catch (clerkError) {
            console.error("Clerk deletion error:", clerkError);
        }

        return NextResponse.json({ message: "User and all associated data deleted successfully" });
    } catch (error) {
        console.error("Delete user error:", error);
        return NextResponse.json(
            { error: "Failed to delete user" },
            { status: 500 }
        );
    }
}