import { z } from 'zod';

// scoringSession Schema Validation
export const ScoringSessionSchema = z.object({
    user_id: z.string(), // Partition key - references user_id from Users table
    createdAt: z.string().optional().default(() => new Date().toISOString()), // Sort key - ISO timestamp
    scoringSessionId: z.string(),
    scores: z.array(z.object({
        categoryId: z.string(),
        score: z.number(),
    })),
    answers: z.array(z.object({
        answer: z.number(),
        questionId: z.string(),
        reasoning: z.string().optional(), // Added reasoning field
    })),
    recommendation: z.string(),
    name: z.string().optional().default("untitled folder"), 
    opportunityInfo: z.array(z.object({
        contactName: z.string().optional(),
        companyName: z.string().optional(),
        useCase: z.string().optional(),
        region: z.string().optional(),
    })),
});

// scoringSession Type
export type ScoringSession = z.infer<typeof ScoringSessionSchema>;

// Table Configuration
export const scoringSessionConfig = {
    tableName: 'projectL-scoringSession',
    keys: {
        partition: 'user_id', 
        sort: 'createdAt'
    },
    indexes: {
        scoringSessionId: 'scoringSessionId-index',
    }
} as const;