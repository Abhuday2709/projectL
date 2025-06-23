import { z } from 'zod';
import { router, procedure } from './trpc';
import { GetCommand, PutCommand, UpdateCommand, DeleteCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { UserSchema, type User } from '../../models/userModel'; // Adjust the import path as necessary
import { dynamoClient } from '@/lib/AWS/AWS_CLIENT'; // Ensure you export your DynamoDB client there.

const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const userRouter = router({
    // Get a user by ID
    getUser: procedure
        .input(z.object({ userId: z.string() }))
        .query(async ({ input, ctx }) => {
            if (!ctx.userId || ctx.userId !== input.userId) {
                throw new Error("Not authorized to create this user");
            }
            const command = new GetCommand({
                TableName: 'Users',
                Key: { userId: input.userId },
            });
            const result = await docClient.send(command);
            if (!result.Item) {
                throw new Error('User not found');
            }
            return result.Item as User;
        }),

    // Create a new user
    createUser: procedure
        .input(UserSchema)
        .mutation(async ({ input }) => {
            const command = new PutCommand({
                TableName: 'Users',
                Item: {
                    ...input,
                    createdAt: new Date().toISOString(),
                },
                ConditionExpression: 'attribute_not_exists(userId)',
            });
            await docClient.send(command);
            return input;
        }),

    // Update an existing user
    updateUser: procedure
        .input(
            z.object({
                userId: z.string(),
                // You can expand this shape based on what properties might be updatable.
                updates: z.object({
                    emailVerified: z.boolean().optional(),
                    // Add additional fields to update as needed.
                }),
            })
        )
        .mutation(async ({ input }) => {
            const updateExpressions = Object.keys(input.updates)
                .map((key) => `#${key} = :${key}`)
                .join(', ');
            const command = new UpdateCommand({
                TableName: 'Users',
                Key: { userId: input.userId },
                UpdateExpression: `SET ${updateExpressions}`,
                ExpressionAttributeNames: Object.keys(input.updates).reduce((acc, key) => {
                    acc[`#${key}`] = key;
                    return acc;
                }, {} as Record<string, string>),
                ExpressionAttributeValues: Object.entries(input.updates).reduce((acc, [key, value]) => {
                    acc[`:${key}`] = value;
                    return acc;
                }, {} as Record<string, unknown>),
                ReturnValues: 'ALL_NEW',
            });
            const result = await docClient.send(command);
            return result.Attributes as User;
        }),

    // Delete a user
    deleteUser: procedure
        .input(z.object({ userId: z.string() }))
        .mutation(async ({ input }) => {
            const command = new DeleteCommand({
                TableName: 'Users',
                Key: { userId: input.userId },
            });
            await docClient.send(command);
            // Optionally, cascade delete related chats here.
            return { success: true };
        }),
});