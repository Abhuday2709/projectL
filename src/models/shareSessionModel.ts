// models/shareSessionModel.ts
import { z } from 'zod';

// scoringSession Schema Validation
export const ShareSessionSchema = z.object({
    chatId: z.string(),
    shareId: z.string(),
    password: z.string(),
    isActive: z.boolean().default(true),
    passwordCreatedAt: z.string().optional(), // ISO 8601 string
    expiresAt: z.number().optional(),  // epoch seconds for DynamoDB TTL
});

// scoringSession Type
export type ShareSession = z.infer<typeof ShareSessionSchema>;

// Table Configuration
export const shareSessionConfig = {
    tableName: 'shareSession',
    keys: {
        partition: 'chatId',
    },
    indexes: {
        shareId: 'shareId-index',
    },
} as const;
