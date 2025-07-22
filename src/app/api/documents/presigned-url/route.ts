// /api/documents/presigned-url/route.ts (for App Router)
// or /pages/api/documents/presigned-url.ts (for Pages Router)

import { NextRequest, NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
    region: process.env.NEXT_PUBLIC_AWS_REGION,
    credentials: {
        accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY!,
    },
});

export async function POST(request: NextRequest) {
    try {
        const { s3Key, expiresIn = 60*60*24*7 ,isAudio} = await request.json();
        if (!s3Key) {
            return NextResponse.json(
                { error: 'S3 key is required' },
                { status: 400 }
            );
        }

        const command = new GetObjectCommand({
            Bucket: process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME,
            Key: s3Key,
        });

        const presignedUrl = await getSignedUrl(s3Client, command, {
            expiresIn: isAudio ? 60 : expiresIn, // URL expires in specified seconds (default 1 hour)
        });

        return NextResponse.json({ presignedUrl });
    } catch (error) {
        console.error('Error generating presigned URL:', error);
        return NextResponse.json(
            { error: 'Failed to generate presigned URL' },
            { status: 500 }
        );
    }
}

// For Pages Router, use this instead:
/*
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { s3Key, expiresIn = 3600 } = req.body;

        if (!s3Key) {
            return res.status(400).json({ error: 'S3 key is required' });
        }

        const command = new GetObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: s3Key,
        });

        const presignedUrl = await getSignedUrl(s3Client, command, {
            expiresIn,
        });

        res.status(200).json({ presignedUrl });
    } catch (error) {
        console.error('Error generating presigned URL:', error);
        res.status(500).json({ error: 'Failed to generate presigned URL' });
    }
}
*/