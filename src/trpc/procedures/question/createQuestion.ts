import { z } from 'zod';
import { procedure } from '../../trpc';
import { EvaluationQuestionConfig } from '../../../../models/evaluationQuestionModel';
import { PutCommand, DeleteCommand, UpdateCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { dynamoClient } from '@/lib/AWS/AWS_CLIENT';
import { v4 as uuidv4 } from 'uuid';

const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const createQuestionProcedure = procedure
    .input(z.object({
        userId: z.string(),
        categoryId: z.string(),
        questionText: z.string(),
        order: z.number(),
    }))
    .mutation(async ({ input }) => {
        const evaluationQuestionId = uuidv4();
        const item = {
            user_id: input.userId,
            evaluationQuestionId,
            categoryId: input.categoryId,
            text: input.questionText,
            order: input.order,
            isMaster: false,
        };
        await docClient.send(new PutCommand({
            TableName: EvaluationQuestionConfig.tableName,
            Item: item,
        }));
        return item;
    });
