import { router, procedure } from './trpc';
import { z } from 'zod';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

// Initialize S3 Client
const s3Client = new S3Client({
    region: process.env.AWS_REGION!,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
});

export const awsRouter = router({
    postDocFromChat: procedure
        .input(
            z.object({
                chatId: z.string(),
                fileName: z.string(),       // The original file name
                fileContent: z.string(),    // The file content encoded as a base64 string
                contentType: z.string(),    // Should be "application/pdf"
            })
        )
        .mutation(async ({ input }) => {
            // Validate that required AWS env. variables are set.
            if (
                !process.env.AWS_S3_BUCKET_NAME ||
                !process.env.AWS_REGION ||
                !process.env.AWS_ACCESS_KEY_ID ||
                !process.env.AWS_SECRET_ACCESS_KEY
            ) {
                throw new Error('Missing required AWS environment variables');
            }

            // Validate file type
            if (input.contentType !== 'application/pdf') {
                throw new Error('Only PDF files are allowed');
            }

            // Decode the received base64 content into a Buffer
            const buffer = Buffer.from(input.fileContent, 'base64');

            // Create a unique file key using a timestamp and sanitized file name
            const timestamp = Date.now();
            const sanitizedFileName = input.fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
            const key = `uploads/${timestamp}-${sanitizedFileName}`;

            // Configure and perform the upload using AWS SDK's Upload utility
            const upload = new Upload({
                client: s3Client,
                params: {
                    Bucket: process.env.AWS_S3_BUCKET_NAME,
                    Key: key,
                    Body: buffer,
                    ContentType: input.contentType,
                    ContentDisposition: 'inline',
                },
            });

            await upload.done();

            // Return success response with file URL and key
            return {
                success: true,
                fileUrl: `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
                key,
            };
        }),
});