import { procedure } from "@/trpc/trpc";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
import { CategoryConfig } from "../../../../models/categoryModel";
import { dynamoClient } from "@/lib/AWS/AWS_CLIENT";

const docClient = DynamoDBDocumentClient.from(dynamoClient);
export const updateCategoryNameProcedure = procedure
    .input(z.object({
        userId: z.string(),
        order: z.number(),
        categoryId: z.string(),
        categoryName: z.string(),
        qualificationCutoff: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
        const updateExpression = input.qualificationCutoff !== undefined 
            ? "set #categoryName = :name, #qualificationCutoff = :cutoff"
            : "set #categoryName = :name";

        const expressionAttributeNames: Record<string, string> = {
            "#categoryName": "categoryName",
            ...(input.qualificationCutoff !== undefined && { "#qualificationCutoff": "qualificationCutoff" }),
        };

        const expressionAttributeValues = input.qualificationCutoff !== undefined
            ? {
                ":name": input.categoryName,
                ":cutoff": input.qualificationCutoff,
            }
            : {
                ":name": input.categoryName,
            };

        await docClient.send(new UpdateCommand({
            TableName: CategoryConfig.tableName,
            Key: {
                user_id: input.userId,
                order: input.order,
            },
            UpdateExpression: updateExpression,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
        }));
        return { success: true };
    });