import { z } from 'zod';

export const QuestionSchema = z.object({
    questionId: z.string().uuid(),
    categoryId : z.string().uuid(),
    text: z.string(),
    uploadedAt: z.string().optional().default(() => new Date().toISOString()),
}); 
export type Question = z.infer<typeof QuestionSchema>;
export const QuestionConfig = {
    tableName: 'questions',
    keys: {
        partition: 'questionId', 
        sort: 'uploadedAt'
    }
} as const;