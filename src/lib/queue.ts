import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { type Document } from '@/models/documentModel';
import { ProcessDocumentForReviewJobData, ProcessPodcasts } from './utils';

// Create a single Redis connection instance from the environment variable.
// This instance will be reused by all queues, which is more efficient.
// The 'rediss://' protocol in your REDIS_URL will ensure a TLS connection, which Upstash requires.
// The `maxRetriesPerRequest: null` option is recommended by Upstash to avoid unexpected behavior.
const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: null
});

// Create and export the queue instances, passing the shared connection.
export const myQueue = new Queue<Document>('documents', { connection });

export const myReviewQueue = new Queue<ProcessDocumentForReviewJobData>('processDocumentForReview', { connection });

export const myPodcastQueue = new Queue<ProcessPodcasts>('processPodcast', { connection });
