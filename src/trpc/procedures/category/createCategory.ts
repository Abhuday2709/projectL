import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { CategoryConfig } from "../../../../models/categoryModel";
import { dynamoClient } from "@/lib/AWS/AWS_CLIENT";
import { procedure } from "@/trpc/trpc";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const createCategoryProcedure = procedure
    .input(z.object({
        userId: z.string(),
        categoryName: z.string(),
        order: z.number(),
    }))
    .mutation(async ({ input }) => {
        const categoryId = uuidv4();
        const item = {
            user_id: input.userId,
            categoryId,
            categoryName: input.categoryName,
            order: input.order,
            isMaster: false,
        };
        await docClient.send(new PutCommand({
            TableName: CategoryConfig.tableName,
            Item: item,
        }));
        return item;
    });
