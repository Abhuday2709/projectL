import { z } from 'zod';
import { procedure } from '../../trpc'; // Adjusted import path
import { scoringSessionConfig, ScoringSessionSchema } from '../../../../models/scoringReviewModel'; // Adjusted import path
import { PutCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { dynamoClient } from '@/lib/AWS/AWS_CLIENT';

// Create a document client using a common DynamoDB client instance.
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const createReviewProcedure = procedure
    .input(
        z.object({
        user_id: z.string(),
        scoringSessionId: z.string(),
        name: z.string().min(1, "review name is required"),
        scores: z.array(z.any()),   
        answers: z.array(z.any()),
        recommendation: z.string()
    })
)
.mutation(async ({ input, ctx }) => {
        // Check that the authenticated user is allowed to create the review.
        if (!ctx.userId || ctx.userId !== input.user_id) {
            throw new Error("Not authorized to create this review");
        }
        // Inject createdAt server-side.
        const review = ScoringSessionSchema.parse({
            ...input,
            createdAt: new Date().toISOString(),
        });
        const command = new PutCommand({
            TableName: scoringSessionConfig.tableName,
            Item: review,
        });
        await docClient.send(command);
        return review;
    }); 