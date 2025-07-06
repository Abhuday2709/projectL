import { z } from 'zod';

// User Schema Validation
export const UserSchema = z.object({
    user_id: z.string(),
    email: z.string().email(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    passwordHash: z.string().optional(), // Uncomment this line
    createdAt: z.string().optional().default(() => new Date().toISOString()),
    role: z.string().default('user') // Default role is 'user'
});

// User Type
export type User = z.infer<typeof UserSchema>;

// Table Configuration
export const UserConfig = {
    tableName: 'users',
    keys: {
        partition: 'user_id',
    }
} as const;