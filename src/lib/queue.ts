import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { type Document } from '@/models/documentModel';
import { ProcessDocumentForReviewJobData, ProcessPodcasts } from './utils';


/**
 * Shared Redis connection for all queues.
 * @constant {IORedis.Redis} connection
 * @requires REDIS_URL environment variable.
 */
const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: null
});

/**
 * Queue for generic document jobs.
 * @export
 * @type {Queue<Document>}
 */
export const myQueue = new Queue<Document>('documents', { connection });
/**
 * Queue for processing documents for review.
 * @export
 * @type {Queue<ProcessDocumentForReviewJobData>}
 */
export const myReviewQueue = new Queue<ProcessDocumentForReviewJobData>('processDocumentForReview', { connection });

/**
 * Queue for processing podcast transcriptions.
 * @export
 * @type {Queue<ProcessPodcasts>}
 */
export const myPodcastQueue = new Queue<ProcessPodcasts>('processPodcast', { connection });
