import { z } from 'zod';

// scoringSession Schema Validation
export const ScoringSessionSchema = z.object({
    user_id: z.string(), // Partition key - references user_id from Users table
    createdAt: z.string(), // Sort key - ISO timestamp
    scoringSessionId: z.string(),
    docId: z.string().uuid(),
    scores: z.array(z.object({
        categoryId: z.string(),
        score: z.number(),
    })),
    answers: z.array(z.object({
        questionId: z.string(),
        answer: z.number(),
    })),
    name: z.string().optional().default("untitled folder"), // Optional scoringSession name
});

// scoringSession Type
export type ScoringSession = z.infer<typeof ScoringSessionSchema>;

// Table Configuration
export const scoringSessionConfig = {
    tableName: 'scoringSession',
    keys: {
        partition: 'user_id', 
        sort: 'createdAt'
    },
    indexes: {
        scoringSessionId: 'scoringSessionId-index',
    }
} as const; 