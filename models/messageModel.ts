import { z } from 'zod';

export const MessageSchema = z.object({
    chatId: z.string(),
    createdAt: z.string().optional().default(() => new Date().toISOString()),
    messageId: z.string().uuid(),
    text: z.string(),
    isUserMessage: z.boolean(),
    isLoading: z.boolean().optional(),
}); 
export type Message = z.infer<typeof MessageSchema>;
export const MessageConfig = {
    tableName: 'messages',
    keys: {
        partition: 'chatId', 
        sort: 'createdAt'
    }
} as const;