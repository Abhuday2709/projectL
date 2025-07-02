import { z } from 'zod';

export const DocumentSchema = z.object({
    chatId: z.string(),
    uploadedAt: z.string().optional().default(() => new Date().toISOString()),
    docId: z.string().uuid(),
    fileName: z.string(),
    s3Key: z.string(),
    fileType: z.string(),
    processingStatus: z.enum(['QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED']).optional(),
    processingError: z.string().optional(),
    missingQuestionIds: z.array(z.string()).optional(),
}); 
export type Document = z.infer<typeof DocumentSchema>;
export const DocumentConfig = {
    tableName: 'documents',
    keys: {
        partition: 'chatId', 
        sort: 'uploadedAt'
    }
} as const;