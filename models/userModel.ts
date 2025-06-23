import { z } from 'zod';

// User Schema Validation
export const UserSchema = z.object({
    user_id: z.string(),
    email: z.string().email(),
    // passwordHash: z.string(),
    // emailVerified: z.boolean().default(false),
    createdAt: z.string().optional().default(() => new Date().toISOString()),
});

// User Type
export type User = z.infer<typeof UserSchema>;

// Table Configuration
export const UserConfig = {
    tableName: 'users',
    indexes: {
        email: 'EmailIndex'
    }
} as const;