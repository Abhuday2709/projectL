import { z } from 'zod';

// scoringSession Schema Validation
export const ShareSessionSchema = z.object({
    chatId: z.string(),
    shareId: z.string(),
    password: z.string(),
    isActive: z.boolean().default(true),
});

// scoringSession Type
export type ShareSession = z.infer<typeof ShareSessionSchema>;

// Table Configuration
export const shareSessionConfig = {
    tableName: 'shareSession',
    keys: {
        partition: 'chatId',
    },
    indexes:{
        shareId: 'shareId-index', // Assuming you have a GSI on shareId
    }
} as const; 