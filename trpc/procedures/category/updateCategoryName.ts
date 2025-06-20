import { procedure } from "@/trpc/trpc";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
import { CategoryConfig } from "../../../../models/categoryModel";
import { dynamoClient } from "@/lib/AWS/AWS_CLIENT";


const docClient = DynamoDBDocumentClient.from(dynamoClient);
export const updateCategoryNameProcedure = procedure
    .input(z.object({
        userId: z.string(),
        order: z.number(), // <-- add this
        categoryId: z.string(),
        categoryName: z.string(),
    }))
    .mutation(async ({ input }) => {
        await docClient.send(new UpdateCommand({
            TableName: CategoryConfig.tableName,
            Key: {
                user_id: input.userId,
                order: input.order,
            },
            UpdateExpression: "set #categoryName = :name",
            ExpressionAttributeNames: {
                "#categoryName": "categoryName",
            },
            ExpressionAttributeValues: {
                ":name": input.categoryName,
            },
        }));
        return { success: true };
    });