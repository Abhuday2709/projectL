import { z } from 'zod';
import { procedure } from '../../trpc'; // Adjusted import path
import { ChatConfig, ChatSchema } from '../../../../models/chatModel'; // Adjusted import path
import { PutCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { dynamoClient } from '@/lib/AWS/AWS_CLIENT';
import { shareSessionConfig, ShareSessionSchema } from '../../../../models/shareSessionModel';
import { v4 as uuidv4 } from "uuid";
// Create a document client using a common DynamoDB client instance.
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const createChatProcedure = procedure
    .input(
        z.object({
            user_id: z.string(),
            chatId: z.string(),
            name: z.string().min(1, "Chat name is required"),
        })
    )
    .mutation(async ({ input, ctx }) => {
        // Check that the authenticated user is allowed to create the chat.
        if (!ctx.userId || ctx.userId !== input.user_id) {
            throw new Error("Not authorized to create this chat");
        }
        // Inject createdAt server-side.
        const chat = ChatSchema.parse({
            ...input,
            createdAt: new Date().toISOString(),
        });
        const command = new PutCommand({
            TableName: ChatConfig.tableName,
            Item: chat,
            // Prevent overwriting an existing chat.
            ConditionExpression: `attribute_not_exists(user_id) AND attribute_not_exists(createdAt)`,
        });
        const share_id = uuidv4();

        const share = ShareSessionSchema.parse({
            chatId: chat.chatId,
            shareId: share_id,
            questionsAndAnswers: [],
            password: "",
            isActive: true,
        });
        const shareCommand = new PutCommand({
            TableName: shareSessionConfig.tableName,
            Item: share,
            // Prevent overwriting an existing share session.
            ConditionExpression: `attribute_not_exists(chatId)`,
        });
        await docClient.send(shareCommand);
        await docClient.send(command);
        return chat;
    }); 