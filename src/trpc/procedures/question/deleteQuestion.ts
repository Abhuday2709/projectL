import { procedure } from "@/trpc/trpc";
import { DeleteCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
import { dynamoClient } from "@/lib/AWS/AWS_CLIENT";
import { EvaluationQuestionConfig } from "../../../../models/evaluationQuestionModel";


const docClient = DynamoDBDocumentClient.from(dynamoClient);
export const deleteQuestionProcedure = procedure
  .input(z.object({
    userId: z.string(),
    evaluationQuestionId: z.string(),
  }))
  .mutation(async ({ input }) => {
    await docClient.send(new DeleteCommand({
      TableName: EvaluationQuestionConfig.tableName,
      Key: {
        user_id: input.userId,
        evaluationQuestionId: input.evaluationQuestionId,
      },
    }));
    return { success: true };
  });