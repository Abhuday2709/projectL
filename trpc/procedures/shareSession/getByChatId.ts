import { z } from 'zod';
import { procedure } from '../../trpc'; // Assuming trpc.ts is two levels up
import { shareSessionConfig, type ShareSession } from '../../../../models/shareSessionModel'; // Path relative to src/trpc/procedures/chat/
import { QueryCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { dynamoClient } from '@/lib/AWS/AWS_CLIENT';
import { TRPCError } from '@trpc/server'; // Import TRPCError

const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const getByChatIdProcedure = procedure
    .input(z.object({ chatId: z.string().min(1) })) // Ensure chatId is not empty
    .query(async ({ input, ctx }) => {
        if (!ctx.userId) {
            throw new TRPCError({ code: "UNAUTHORIZED", message: "User is not authenticated." });
        }

        const { chatId } = input;

        // Assuming a GSI on chatId. The IndexName might come from ChatConfig or be a default.
        // If your primary key is (user_id, chatId), a GetCommand would be more direct
        // after ensuring ctx.userId is available.
        const command = new QueryCommand({
            TableName: shareSessionConfig.tableName,
            KeyConditionExpression: 'chatId = :cid',
            ExpressionAttributeValues: { ':cid': chatId },
            Limit: 1 // We expect only one chat for a given chatId
        });

        let result;
        try {
            result = await docClient.send(command);
        } catch (error: any) {
            console.error("DynamoDB QueryCommand failed in getByChatId:", error);
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to query chat details from database.",
                cause: error, // Include the original error if helpful for server logs
            });
        }

        if (!result.Items || result.Items.length === 0) {
            throw new TRPCError({
                code: "NOT_FOUND",
                message: `shareSession with chatId '${chatId}' not found.`,
            });
        }

        const shareSession = result.Items[0] as ShareSession;

        return shareSession;
    }); 