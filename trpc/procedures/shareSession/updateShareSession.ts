import { procedure } from "@/trpc/trpc";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
import { dynamoClient } from "@/lib/AWS/AWS_CLIENT";
import { shareSessionConfig } from "../../../../models/shareSessionModel";


const docClient = DynamoDBDocumentClient.from(dynamoClient);
export const updateShareSessionProcedure = procedure
  .input(z.object({
    chatId: z.string(),
    password: z.string(),
    isActive: z.boolean(),
  }))
  .mutation(async ({ input }) => {
    await docClient.send(new UpdateCommand({
      TableName: shareSessionConfig.tableName,
      Key: {
        chatId: input.chatId,
      },
      UpdateExpression: "SET password = :password, isActive = :isActive",
      ExpressionAttributeValues: {
        ":password": input.password,
        ":isActive": input.isActive,
      },
    }));
    return { success: true };
  });