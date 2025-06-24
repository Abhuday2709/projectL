import { z } from 'zod';

export const CategorySchema = z.object({
    user_id: z.string(),
    categoryId : z.string().uuid(),
    categoryName : z.string(),
    order: z.number(),
    isMaster: z.boolean().default(false),
    qualificationCutoff: z.number().default(50),
}); 
export type Category = z.infer<typeof CategorySchema>;
export const CategoryConfig = {
    tableName: 'categories',
    keys: {
        partition: 'user_id', 
        sort: 'order'
    },
    indexes: {
        categoryId: 'categoryId-index'
    }
} as const;