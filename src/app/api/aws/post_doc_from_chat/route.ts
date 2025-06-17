import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { NextRequest, NextResponse } from 'next/server';

// Initialize S3 Client
const s3Client = new S3Client({
    region: process.env.NEXT_PUBLIC_AWS_REGION!,
    credentials: {
        accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY!,
    },
});

export async function POST(request: NextRequest) {
    try {
        // Validate environment variables
        if (!process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME ||
            !process.env.NEXT_PUBLIC_AWS_REGION ||
            !process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID ||
            !process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY) {
            throw new Error('Missing required AWS environment variables');
        }

        const formData = await request.formData();
        const file = formData.get('file');

        if (!file || !(file instanceof File)) {
            return NextResponse.json(
                { error: 'Invalid or no file provided' },
                { status: 400 }
            );
        }

        const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { error: 'File size exceeds 50MB limit' },
                { status: 400 }
            );
        }

        const acceptedTypes = new Set([
            'application/pdf',                    // PDF
            'application/msword',                 // DOC
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
        ]);
        // Validate file type
        if (!acceptedTypes.has(file.type)) {
            return NextResponse.json(
                { error: 'Invalid file type. Supported types: PDF, DOC, DOCX' },
                { status: 400 }
            );
        }

        // Convert file to buffer
        const buffer = Buffer.from(await file.arrayBuffer());

        // Create unique file name with sanitization
        const timestamp = Date.now();
        const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const fileName = `uploads/${timestamp}-${sanitizedFileName}`;

        // Configure upload parameters
        const upload = new Upload({
            client: s3Client,
            params: {
                Bucket: process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME,
                Key: fileName,
                Body: buffer,
                ContentType: file.type,
                ContentDisposition: 'inline',
            },
        });

        // Upload to S3
        await upload.done();

        // Return success response with file URL
        return NextResponse.json({
            success: true,
            fileUrl: `https://${process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME}.s3.${process.env.NEXT_PUBLIC_AWS_REGION}.amazonaws.com/${fileName}`,
            key: fileName
        });

    } catch (error: unknown) {
        console.error('Upload error:', error);
        return NextResponse.json(
            {
                error: 'Error uploading file',
                details: process.env.NODE_ENV === 'development' ?
                    error instanceof Error ? error.message : 'Unknown error'
                    : undefined
            },
            { status: 500 }
        );
    }
}

// Configure API route to handle large files
export const config = {
    api: {
        bodyParser: false,
        // Increase the limit if needed
        responseLimit: '50mb',
    },
};