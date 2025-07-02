import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { DocumentSchema } from "@/models/documentModel";
import { z } from "zod";
const s3Client = new S3Client({
    region: process.env.NEXT_PUBLIC_AWS_REGION!,
    credentials: {
        accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY!,
    },
});
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


export const ACCEPTED_MIME_TYPES = {
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
} as const; 

export const ACCEPTED_FILE_TYPES = new Set(Object.keys(ACCEPTED_MIME_TYPES));

export function isNetworkScienceEmail(email: string): boolean {
  return email.toLowerCase().endsWith('@networkscience.ai') || email === "abhudaylath@gmail.com" || email === "iit2022154@iiita.ac.in";
}

// types.ts
export interface CategoryType {
  user_id: string
  categoryId: string
  categoryName: string
  order: number
  qualificationCutoff: number
}

// Define the type for the items returned by the query, including the status fields
export const DocumentWithStatusSchema = DocumentSchema.pick({
    docId: true,
    fileName: true,
    s3Key: true,
    uploadedAt: true, // Keep uploadedAt if it's part of your primary key or useful for sorting/display
    fileType: true,
    processingStatus: true,
    processingError: true,
    chatId: true, // Include chatId if useful for client-side cache or context
    missingQuestionIds: true,
});
export type DocumentWithStatus = z.infer<typeof DocumentWithStatusSchema>;

export interface QuestionType {
  user_id: string
  evaluationQuestionId: string
  text: string
  categoryId: string
  order: number
  isMaster?: boolean
}

export interface AnswerType {
  questionId: string
  answer: "No" | "Maybe" | "Yes"
  score: 0 | 1 | 2
}

export interface Results {
  categoryName: string
  score: number
  total: number
  categoryId: string
  qualificationCutoff: number
}

export interface ProcessDocumentForReviewJobData {
    chatId: string;
    uploadedAt: string;
    docId: string;
    fileName: string;
    s3Key: string;
    fileType: string;
    user_id?: string;
    createdAt?: string; 
}

export interface ProcessPodcasts {
    DocIdList: string[];
    chatId: string;
    user_id: string;
    createdAt: string;
}

export async function deleteFromS3(key: string, maxRetries = 5): Promise<void> {
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