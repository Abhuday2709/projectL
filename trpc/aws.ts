import { router, procedure } from './trpc';
import { z } from 'zod';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
// Initialize S3 Client
const s3Client = new S3Client({
    region: process.env.NEXT_PUBLIC_AWS_REGION!,
    credentials: {
        accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY!,
    },
});

// Helper function to delete from S3 with retries
async function deleteFromS3(key: string, maxRetries = 5): Promise<void> {
    let attempt = 0;
    let lastError: any = null;
    while (attempt < maxRetries) {
        try {
            const command = new DeleteObjectCommand({
                Bucket: process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME!,
                Key: key,
            });
            await s3Client.send(command);
            console.log(`S3 delete successful for key: ${key}`);
            return;
        } catch (err) {
            lastError = err;
            attempt++;
            console.error(`S3 deletion failed (attempt ${attempt}) for key: ${key}`, err);
            if (attempt < maxRetries) {
                await new Promise(res => setTimeout(res, 1000 * attempt));
            }
        }
    }
    throw lastError;
}

export const awsRouter = router({
    deleteFile: procedure
        .input(
            z.object({
                key: z.string(),
            })
        )
        .mutation(async ({ input }) => {
            const bucket = process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME!;
            if (!bucket) {
                throw new Error('Missing S3 bucket name');
            }
            await deleteFromS3(input.key);
            return { success: true };
        }),
});