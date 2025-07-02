import { Queue } from 'bullmq';
import { type Document } from '@/models/documentModel'; // Assuming this type is still relevant for job data
import { ProcessDocumentForReviewJobData, ProcessPodcasts } from './utils';

// Configure Redis connection
const connectionOptions = {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379,
    // Add other connection options if needed (e.g., password, db)
};

// Create and export the queue instance
// Other parts of your application can import this to add jobs.
export const myQueue = new Queue<Document>('documents', { connection: connectionOptions });
export const myReviewQueue = new Queue<ProcessDocumentForReviewJobData>('processDocumentForReview', { connection: connectionOptions });
export const myPodcastQueue = new Queue<ProcessPodcasts>('processPodcast', { connection: connectionOptions });