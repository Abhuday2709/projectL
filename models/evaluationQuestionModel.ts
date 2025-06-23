import { z } from 'zod';

export const EvaluationQuestionSchema = z.object({
    user_id: z.string(),
    evaluationQuestionId: z.string().uuid(),
    categoryId : z.string().uuid(),
    text: z.string(),
    order: z.number(),
    isMaster: z.boolean().default(false),
}); 
export type EvaluationQuestion = z.infer<typeof EvaluationQuestionSchema>;
export const EvaluationQuestionConfig = {
    tableName: 'evaluationQuestions',
    keys: {
        partition: 'user_id', 
        sort: 'evaluationQuestionId'
    }
} as const;