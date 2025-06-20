import { procedure } from "@/trpc/trpc";
import { DeleteCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
import { CategoryConfig } from "../../../../models/categoryModel";
import { dynamoClient } from "@/lib/AWS/AWS_CLIENT";


const docClient = DynamoDBDocumentClient.from(dynamoClient);


export const deleteCategoryProcedure = procedure
  .input(z.object({
    userId: z.string(),
    order: z.number(),
    categoryId: z.string(),
  }))
  .mutation(async ({ input }) => {
    await docClient.send(new DeleteCommand({
      TableName: CategoryConfig.tableName,
      Key: {
        user_id: input.userId,
        order: input.order,
      },
    }));
    return { success: true };
  });
