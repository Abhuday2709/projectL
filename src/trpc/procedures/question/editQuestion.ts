import { procedure } from "@/trpc/trpc";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
import { dynamoClient } from "@/lib/AWS/AWS_CLIENT";
import { EvaluationQuestionConfig } from "../../../../models/evaluationQuestionModel";


const docClient = DynamoDBDocumentClient.from(dynamoClient);
export const editQuestionProcedure = procedure
  .input(z.object({
    userId: z.string(),
    evaluationQuestionId: z.string(),
    questionText: z.string(),
  }))
  .mutation(async ({ input }) => {
    await docClient.send(new UpdateCommand({
      TableName: EvaluationQuestionConfig.tableName,
      Key: {
        user_id: input.userId,
        evaluationQuestionId:input.evaluationQuestionId
      },
      UpdateExpression: "set #text = :text",
      ExpressionAttributeNames: {
        "#text": "text",
      },
      ExpressionAttributeValues: {
        ":text": input.questionText,
      },
    }));
    return { success: true };
  });