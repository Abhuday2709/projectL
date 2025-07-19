import { z } from 'zod';

export const CategorySchema = z.object({
    categoryId : z.string().uuid(),
    categoryName : z.string(),
    qualificationCutoff: z.number().default(50),
    createdAt: z.string().datetime().default(() => new Date().toISOString()),
}); 
export type Category = z.infer<typeof CategorySchema>;
export const CategoryConfig = {
    tableName: 'categories',
    keys: {
        partition: 'categoryId', 
        sort: 'createdAt'
    },
    indexes: {
        categoryId: 'categoryId-index'
    }
} as const;