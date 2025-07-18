import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { DocumentSchema } from "../models/documentModel";
import { z } from "zod";
const s3Client = new S3Client({
    region: process.env.NEXT_PUBLIC_AWS_REGION!,
    credentials: {
        accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY!,
    },
});
/**
 * Merge and dedupe Tailwind CSS class names.
 * @export
 * @param {...ClassValue[]} inputs – Class values for clsx and twMerge.
 * @returns {string} The merged class string.
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}


/**
 * Accepted MIME types for file uploads, mapping to file extensions.
 * @export
 * @constant {Record<string, string[]>} ACCEPTED_MIME_TYPES
 */
export const ACCEPTED_MIME_TYPES = {
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
} as const;
/**
 * Set of accepted MIME types for quick look-up.
 * @export
 * @constant {Set<string>} ACCEPTED_FILE_TYPES
 */
export const ACCEPTED_FILE_TYPES = new Set(Object.keys(ACCEPTED_MIME_TYPES));
/**
 * Check if an email belongs to the Network Science domain or allowed overrides.
 * @export
 * @param {string} email – Email address to validate.
 * @returns {boolean} True if the email is allowed.
 */
export function isNetworkScienceEmail(email: string): boolean {
    return email.toLowerCase().endsWith('@networkscience.ai') || email === "abhudaylath@gmail.com" || email === "iit2022154@iiita.ac.in";
}


/**
 * Zod schema for documents with status fields.
 * @export
 * @constant {z.ZodType<DocumentWithStatus>} DocumentWithStatusSchema
 */
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

/**
 * Type inferred from DocumentWithStatusSchema.
 * @export
 * @typedef {z.infer<typeof DocumentWithStatusSchema>} DocumentWithStatus
 */
export type DocumentWithStatus = z.infer<typeof DocumentWithStatusSchema>;

export interface QuestionType {
    questionId: string
    text: string
    categoryId: string
    uploadedAt: string
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
/** 
 * ProcessDocumentForReviewJobData defines payload for review-processing jobs.
 * @export
 * @interface ProcessDocumentForReviewJobData
 */
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
/**
 * ProcessPodcasts defines payload structure for podcast jobs.
 * @export
 * @interface ProcessPodcasts
 */
export interface ProcessPodcasts {
    DocIdList: string[];
    chatId: string;
    user_id: string;
    createdAt: string;
}
/**
 * Deletes an object from S3, retrying up to maxRetries times on failure.
 * @export
 * @async
 * @param {string} key – The S3 object key to delete.
 * @param {number} [maxRetries=5] – Number of retry attempts.
 * @returns {Promise<void>} Resolves when deletion succeeds.
 * @throws {any} The last error if all retries fail.
 */
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
            // console.log(`S3 delete successful for key: ${key}`);
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