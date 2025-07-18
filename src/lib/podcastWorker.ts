import * as dotenv from 'dotenv';
dotenv.config();
import { Worker } from 'bullmq';
import { deleteFromS3, ProcessPodcasts } from './utils'; 
import { QdrantClient } from '@qdrant/js-client-rest';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { ChatConfig } from '../models/chatModel';
import IORedis from 'ioredis';
import ffmpegStatic from 'ffmpeg-static';
import path from 'path';
import  fs  from 'fs';
import os from 'os';
import { exec } from 'child_process';


/**
 * Google Gemini AI client instance.
 * @constant {GoogleGenerativeAI} genAI
 * @requires process.env.GEMINI_API_KEY
 */
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
/**
 * Generative model for text generation.
 * @constant
 */
const generativeModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

/**
 * Embedding model for text embeddings.
 * @constant
 */
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

/**
 * Qdrant client for vector storage and retrieval.
 * @constant {QdrantClient} qdrantClient
 * @requires QDRANT_HOST, QDRANT_PORT environment variables
 */
const qdrantClient = new QdrantClient({
    host: process.env.QDRANT_HOST!,
    port: process.env.QDRANT_PORT ? parseInt(process.env.QDRANT_PORT!) : 6333,
});
/**
 * Name of the Qdrant collection to use.
 * @constant {string} COLLECTION_NAME
 */
const COLLECTION_NAME = process.env.QDRANT_COLLECTION_NAME!;


/**
 * S3 client for uploading and deleting files.
 * @constant {S3Client} s3Client
 * @requires NEXT_PUBLIC_AWS_REGION, NEXT_PUBLIC_AWS_ACCESS_KEY_ID, NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY
 */
const s3Client = new S3Client({
    region: process.env.NEXT_PUBLIC_AWS_REGION!,
    credentials: {
        accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY!,
    },
});

/**
 * DynamoDB Document client for database operations.
 * @constant {DynamoDBDocumentClient} docClient
 */
const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({
    region: process.env.NEXT_PUBLIC_AWS_REGION,
    credentials: {
        accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY!,
    },
}));
/**
 * API key for Murf text-to-speech service.
 * @constant {string} murfApiKey
 */
const murfApiKey = process.env.NEXT_PUBLIC_MURF_API_KEY || '';


// --- Helper Functions ---
/**
 * Embed given text into a numeric vector using the embedding model.
 * @param {string} text - Text to embed.
 * @returns {Promise<number[]>} Embedding vector.
 */
async function embedText(text: string): Promise<number[]> {
    const result = await embeddingModel.embedContent(text);
    return result.embedding.values;
}

/**
 * Summarize main points in batches of chunks.
 * @param {string[]} chunks - Array of text chunks.
 * @returns {Promise<string>} Bullet-point main points.
 */
async function summarizeChunkBatch(chunks: string[]): Promise<string> {
    const prompt = `Read the following document excerpts and extract the main points, arguments, or facts. List each as a bullet point. Respond ONLY with the bullet points.`;
    const fullText = chunks.join('\n\n');
    const result = await generativeModel.generateContent([prompt, fullText]);
    return result.response.text();
}

/**
 * Generate a concise, comprehensive summary from main points.
 * @param {string[]} allMainPoints - Array of bullet-point strings.
 * @returns {Promise<string>} Single-paragraph summary.
 */
async function generateComprehensiveSummaryFromMainPoints(allMainPoints: string[]): Promise<string> {
    const fullText = allMainPoints.join('\n\n');
    const prompt = `Given the following main points from a document, write a concise, one-paragraph summary that includes:
- An engaging introduction
- The main points and key arguments
- An overall conclusion
Respond ONLY with the summary paragraph.`;
    const result = await generativeModel.generateContent([prompt, fullText]);
    return result.response.text();
}

/**
 * Create a podcast outline from summary.
 * @param {string} summary - Document summary paragraph.
 * @param {string} tone - Desired tone (e.g., conversational).
 * @returns {Promise<string[]>} Array of outline items.
 */
async function generatePodcastOutline(summary: string, tone: string): Promise<string[]> {
    // console.log("Generating a structured podcast outline with focus on key sections...");
    const prompt = `You are a podcast producer creating an outline for a business proposal summary. The tone should be ${tone}.

Based on the summary provided, generate a detailed, multi-point outline.

**CRITICAL INSTRUCTIONS:**
1.  **Prioritize Key Sections:** The outline MUST prominently feature and allocate more detail to the following core sections if they are present in the summary:
    *   Problem Statement
    *   Objectives
    *   Approach / Solutions (give special attention to any AI-related solutions)
    *   Scope of Work
    *   Commercials / Pricing Details
    *   Conclusion / Next Steps

2.  **Summarize Other Points:** For any other points in the summary, include them but keep them very brief (a single, concise sentence).

3.  **Structure:** The final outline must include:
    *   An engaging Introduction/Hook.
    *   Thematic sections, with the prioritized sections forming the main body.
    *   A concluding Summary/Outro.

Respond ONLY with the numbered list of outline points and nothing else.

**DOCUMENT SUMMARY:**
---
${summary}
---`;

    const result = await generativeModel.generateContent([prompt, summary]);
    return result.response.text().split('\n').filter(line => line.match(/^\d+\./)).map(line => line.replace(/^\d+\.\s*/, '').trim());
}


/**
 * Search Qdrant for chunks relevant to a query.
 * @param {string} query - Outline point or search phrase.
 * @param {string[]} docIds - Document IDs to filter by.
 * @returns {Promise<string[]>} Matching text chunks.
 */
async function searchRelevantChunks(query: string, docIds: string[]): Promise<string[]> {
    // console.log(`Searching for chunks related to: "${query}"`);
    const queryVector = await embedText(query);

    const searchResult = await qdrantClient.search(COLLECTION_NAME, {
        vector: queryVector,
        filter: {
            must: [{ key: 'documentId', match: { any: docIds } }]
        },
        with_payload: true,
        limit: 5,
    });

    return searchResult.map(point => point.payload?.text as string).filter(Boolean);
}

/**
 * Generate a script section from context chunks.
 * @param {string} outlinePoint - Section title.
 * @param {string[]} contextChunks - Relevant text chunks.
 * @returns {Promise<string>} Section script text.
 */
async function generateScriptSection(outlinePoint: string, contextChunks: string[]): Promise<string> {
    const context = contextChunks.join('\n\n');
    const prompt = `You are a podcast scriptwriter. Your current task is to write the script for the section titled: '${outlinePoint}'.

Use ONLY the provided Source Text below to write this part of the script. Make it engaging, clear, and conversational. If you find any powerful phrases or data points, incorporate them directly.

Source Text:
---
${context}
---`;
    const result = await generativeModel.generateContent(prompt);
    return result.response.text();
}

/**
 * Polish and format the final script into a dialogue.
 * @param {string} draftScript - Combined draft of script sections.
 * @param {number} [duration=5] - Target duration in minutes.
 * @returns {Promise<string>} Polished script with labeled speakers.
 */
async function polishFinalScript(draftScript: string, duration = 5): Promise<string> {
    const targetWordCount = duration * 150;
    const wordCountRange = `${targetWordCount - 100}-${targetWordCount + 50}`; // e.g., 650-800 for 5 mins

    // console.log("Polishing the final script...");
    const prompt = `You are going to produce a podcast episode based on the draft script I provide. Your job is to adapt and polish the single-voice script into a natural back-and-forth between two engaging hosts, "Charles" and "Natalie." Follow these guidelines:
**CRITICAL CONSTRAINTS:**
1.  **TARGET DURATION:** The final episode must be approximately **${duration} minutes** long.
2.  **STRICT WORD COUNT:** The total word count of the final script MUST be between **${wordCountRange} words**. Do not exceed this limit. Be concise and edit ruthlessly to meet the target.

Opening (10-15 seconds):

Charles: Write a new, compelling welcome that introduces the episode's core theme in one sentence.
Natalie: Add a quick hook or teaser that sets the stage ("Today we're unpacking why…").
Body (4-5 minutes):

Transform the draft script's main points into a dialogue.
Alternate turns:
Host A (Charles): Summarize a key idea from the original script clearly and concisely.
Host B (Natalie): Build on Charles's point with an example, analogy, or thoughtful question to improve flow and clarity.
After every 2-3 exchanges, insert a brief connective phrase to ensure the transition is smooth (e.g., "That's a great point," "Right, and that connects to…," "Interesting—let's explore that").
Tone & Style:

Warm, upbeat, and conversational—like two friends unpacking ideas.
Rewrite any awkward or repetitive sentences from the original script into everyday language.
Use natural pauses (ellipses "…") but avoid filler words ("um," "like").
Do not read the text verbatim—the goal is to rephrase and elevate it.
Do not include any explicit laughter or stage directions.
Closing (15-20 seconds):

Charles: Write a thoughtful recap of the main value proposition or key insight from the proposal in one sentence.

Natalie: Conclude with an encouraging message about the proposal's potential impact or value (e.g., "This proposal really demonstrates the strategic value NetworkScience can bring to your organization" or "The solutions outlined here could be exactly what your team needs to achieve those goals").

Output Format:

Produce only the final script, labeling each line with "Charles:" or "Natalie:".
No additional commentary or metadata.
Draft Script:
---
${draftScript}
---`;
    const result = await generativeModel.generateContent(prompt);
    return result.response.text();
}



/**
 * Extract dialogues labeled "Charles" or "Natalie" from script text.
 * @param {string} script - Script with speaker labels.
 * @returns {{ speaker: string; text: string }[]} Array of dialogue objects.
 */

function extractDialoguesRobust(script: string): { speaker: string; text: string }[] {
    const dialogues: { speaker: string; text: string }[] = [];
    const cleanScript = script.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const blocks = cleanScript.split(/(?=(?:\*\*)?(?:^\s*)?(Charles|Natalie)(?:\*\*)?:)/m);

    for (const block of blocks) {
        const trimmedBlock = block.trim();
        if (!trimmedBlock) continue;

        const match = trimmedBlock.match(/^(?:\*\*)?(Charles|Natalie)(?:\*\*)?:\s*([\s\S]*)/);

        if (match) {
            const speaker = match[1];
            const text = match[2]
                .replace(/\n+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();

            if (text) {
                dialogues.push({ speaker, text });
            }
        }
    }

    return dialogues;
}
/**
 * Upload a Buffer to S3 with retries.
 * @param {Buffer} buffer - File data.
 * @param {string} fileName - Desired S3 key.
 * @param {string} contentType - MIME type of the file.
 * @returns {Promise<string>} Public S3 URL.
 */
async function uploadBufferToS3(buffer: Buffer, fileName: string, contentType: string): Promise<string> {
    const maxRetries = 5;
    let attempt = 0;
    let lastError: any = null;

    while (attempt < maxRetries) {
        try {
            const upload = new Upload({
                client: s3Client,
                params: {
                    Bucket: process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME!,
                    Key: fileName,
                    Body: buffer,
                    ContentType: contentType,
                    ContentDisposition: 'inline',
                },
            });

            await upload.done();

            const s3Url = `https://${process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME}.s3.${process.env.NEXT_PUBLIC_AWS_REGION}.amazonaws.com/${fileName}`;
            // console.log(`File uploaded to S3: ${s3Url}`);
            return s3Url;
        } catch (err) {
            lastError = err;
            attempt++;
            console.error(`S3 upload failed (attempt ${attempt}):`, err);
            if (attempt < maxRetries) {
                // Optional: add a delay before retrying
                await new Promise(res => setTimeout(res, 1000 * attempt));
            }
        }
    }

    throw lastError;
}

/**
 * Download an audio file from a URL into a Buffer.
 * @param {string} url - Audio file URL.
 * @returns {Promise<Buffer>} Downloaded data buffer.
 */
async function downloadAudioToBuffer(url: string): Promise<Buffer> {
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'arraybuffer',
    });

    return Buffer.from(response.data);
}

/**
 * Generate Murf TTS audio with retries.
 * @param {string} text - Text to speak.
 * @param {string} speaker - "Charles" or "Natalie".
 * @param {number} [maxRetries=3] - Number of attempts.
 * @returns {Promise<any>} Murf API response containing audio URL.
 */
async function generateMurfAudioWithRetry(text: string, speaker: string, maxRetries = 3) {
    let attempt = 0;
    let lastError: any = null;
    while (attempt < maxRetries) {
        try {
            return await generateMurfAudio(text, speaker);
        } catch (err) {
            lastError = err;
            attempt++;
            console.error(`Murf audio generation failed (attempt ${attempt}) for ${speaker}:`, err);
            if (attempt < maxRetries) {
                await new Promise(res => setTimeout(res, 1000 * attempt));
            }
        }
    }
    throw lastError;
}

/**
 * Call Murf API to generate TTS audio.
 * @param {string} text - Text to convert.
 * @param {string} speaker - Speaker identifier.
 * @returns {Promise<any>} API response with audio URL.
 */
async function generateMurfAudio(text: string, speaker: string) {
    const voiceId = speaker === "Charles" ? "en-US-charles" : "en-US-natalie";
    const style = speaker === "Charles" ? "Conversational" : undefined;

    const payload: any = {
        text,
        voiceId,
    };
    if (style) payload.style = style;

    const config = {
        method: 'post',
        url: 'https://api.murf.ai/v1/speech/generate',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'api-key': murfApiKey,
        },
        data: JSON.stringify(payload),
    };

    const response = await axios(config);
    return response.data.audioUrl || response.data.url || response.data;
}

/**
 * Concatenate multiple audio URLs into one via ffmpeg.
 * @param {string[]} audioUrls - Array of S3 URLs.
 * @param {string} chatId - Chat session ID.
 * @param {number} [maxRetries=3] - Retry count.
 * @returns {Promise<string>} URL of combined audio file.
 */
async function concatenateAudioWithRetry(audioUrls: string[], chatId: string, maxRetries = 3): Promise<string> {
    let attempt = 0;
    let lastError: any = null;
    while (attempt < maxRetries) {
        try {
            return await concatenateAudioFromS3_concatDemuxer(audioUrls, chatId);
        } catch (err) {
            lastError = err;
            attempt++;
            console.error(`Audio concatenation failed (attempt ${attempt}):`, err);
            if (attempt < maxRetries) {
                await new Promise(res => setTimeout(res, 1000 * attempt));
            }
        }
    }
    throw lastError;
}

/**
 * Download parts, run ffmpeg concat demuxer, upload result to S3.
 * @param {string[]} audioUrls - URLs of audio parts.
 * @param {string} chatId - Chat session identifier.
 * @returns {Promise<string>} Final combined audio URL.
 */
async function concatenateAudioFromS3_concatDemuxer(
  audioUrls: string[],
  chatId: string
): Promise<string> {
  // 1. Use the OS temp dir
  const tmpDir = path.join(os.tmpdir(), `chat_${chatId}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  // 2. Download each piece
  const localFiles: string[] = [];
  for (let i = 0; i < audioUrls.length; i++) {
    const url = audioUrls[i];
    const localPath = path.join(tmpDir, `part_${i}.wav`);
    const resp = await axios.get(url, { responseType: 'arraybuffer' });
    fs.writeFileSync(localPath, Buffer.from(resp.data));
    localFiles.push(localPath);
  }

  // 3. Build concat.txt with forward‑slash paths
  const listFile = path.join(tmpDir, 'concat.txt');
  const lines = localFiles.map((abs) => {
    // turn "C:\Users\..." into "C:/Users/..."
    const posix = abs.replace(/\\/g, '/');
    return `file '${posix}'`;
  });
  fs.writeFileSync(listFile, lines.join('\n'));

  // 4. Run ffmpeg‑static concat demuxer
  await new Promise<void>((resolve, reject) => {
    const ffmpegBin = `"${ffmpegStatic}"`;
    // forward‑slash for the listFile too:
    const listPosix = listFile.replace(/\\/g, '/');
    const outputFile = path.join(tmpDir, 'final_combined.wav');
    const cmd = `${ffmpegBin} -y -f concat -safe 0 -i "${listPosix}" -c copy "${outputFile}"`;
    exec(cmd, (err, _stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve();
    });
  });

  // 5. Upload to S3
  const outputPath = path.join(tmpDir, 'final_combined.wav');
  const buffer = fs.readFileSync(outputPath);
  const s3Key = `podcast-audio/chat_${chatId}_final_${Date.now()}.wav`;
  await new Upload({
    client: s3Client,
    params: {
      Bucket: process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME!,
      Key: s3Key,
      Body: buffer,
      ContentType: 'audio/wav',
      ContentDisposition: 'inline',
    },
  }).done();

  // 6. Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });

  return `https://${process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME}.s3.${process.env.NEXT_PUBLIC_AWS_REGION}.amazonaws.com/${s3Key}`;
}



/**
 * Process and store podcast audio: TTS per dialogue, concat, cleanup, DynamoDB update.
 * @param {string} script - Final polished podcast script.
 * @param {string} chatId - Chat session ID.
 * @param {string} user_id - User identifier.
 * @param {string} createdAt - Timestamp string for the session.
 */
async function processAndStorePodcastAudio(script: string, chatId: string, user_id: string, createdAt: string) {
    const dialogues = extractDialoguesRobust(script);
    const audioResults: { speaker: string; text: string; audioUrl: string }[] = [];
    const s3AudioUrls: string[] = [];

    // Generate and upload individual audio files
    for (let i = 0; i < dialogues.length; i++) {
        const { speaker, text } = dialogues[i];
        try {
            // Generate audio with Murf
            const murfResponse = await generateMurfAudioWithRetry(text, speaker);
            const audioFileUrl = murfResponse.audioFile || murfResponse.audioUrl || murfResponse.url || '';

            let s3AudioUrl = '';
            if (audioFileUrl) {
                // Download audio from Murf and upload to S3
                const audioBuffer = await downloadAudioToBuffer(audioFileUrl);
                const s3FileName = `podcast-audio/chat_${chatId}_${i}_${speaker}_${Date.now()}.wav`;
                s3AudioUrl = await uploadBufferToS3(audioBuffer, s3FileName, 'audio/wav');
                s3AudioUrls.push(s3AudioUrl);
            }

            audioResults.push({ speaker, text, audioUrl: s3AudioUrl });
            // console.log(`Generated and uploaded audio for ${speaker}: ${s3AudioUrl}`);
        } catch (err) {
            console.error(`Failed to generate/upload audio for ${speaker}:`, err);
            audioResults.push({ speaker, text, audioUrl: '' });
        }
    }

    // Concatenate all audio files and upload final version
    let finalPodcastUrl = '';
    const validAudioUrls = s3AudioUrls.filter(Boolean);
    if (validAudioUrls.length > 1) {
        finalPodcastUrl = await concatenateAudioWithRetry(validAudioUrls, chatId);
        // console.log("Final combined podcast audio URL:", finalPodcastUrl);
    } else if (validAudioUrls.length === 1) {
        finalPodcastUrl = validAudioUrls[0];
        // console.log("Single podcast audio URL:", finalPodcastUrl);
    } else {
        // console.log("No audio files to combine.");
    }
    for (const s3AudioUrl of validAudioUrls) {
        try {
            // Extract the S3 key from the URL
            const urlParts = s3AudioUrl.split('/');
            const s3Key = urlParts.slice(3).join('/'); // Remove 'https://bucket.s3.region.amazonaws.com/'
            deleteFromS3(s3Key);
            // console.log('S3 delete successful for', s3Key);
        } catch (s3Error) {
            console.error('S3 deletion error:', s3Error);
            console.warn('Failed to delete from S3:', s3AudioUrl);
        }
    }
    // Store in DynamoDB with retry logic
    const maxRetries = 5;
    let attempt = 0;
    let success = false;
    let lastError: any = null;

    while (attempt < maxRetries && !success) {
        try {
            await docClient.send(new UpdateCommand({
                TableName: ChatConfig.tableName,
                Key: { user_id, createdAt },
                UpdateExpression: "SET podcast = :podcast, podcastFinal = :finalUrl, podcastProcessingStatus = :status",
                ExpressionAttributeValues: {
                    ":podcast": audioResults,
                    ":finalUrl": finalPodcastUrl,
                    ":status": "COMPLETED",
                },
            }));
            success = true;
            // console.log("Podcast audio URLs and COMPLETED status stored in DynamoDB chat table.");
        } catch (err) {
            lastError = err;
            attempt++;
            console.error(`DynamoDB update failed (attempt ${attempt}):`, err);
            if (attempt < maxRetries) {
                // Optional: add a delay before retrying
                await new Promise(res => setTimeout(res, 1000 * attempt));
            }
        }
    }

    if (!success) {
        throw lastError;
    }
}


/**
 * Shared Redis connection for BullMQ.
 * @constant {IORedis.Redis} connection
 * @requires REDIS_URL
 */
const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: null
});

/**
 * BullMQ worker to process podcast generation jobs.
 * @constant {Worker<ProcessPodcasts>} podcastWorker
 */
const podcastWorker = new Worker<ProcessPodcasts>(
    'processPodcast',
    async (job) => {
        // console.log('Processing podcast job with new RAG workflow:', job.data);
        const { DocIdList, chatId, user_id, createdAt } = job.data;

        try {
            // Set status to PROCESSING
            await docClient.send(new UpdateCommand({
                TableName: ChatConfig.tableName,
                Key: { user_id, createdAt },
                UpdateExpression: "SET podcastProcessingStatus = :status",
                ExpressionAttributeValues: { ":status": "PROCESSING" },
            }));

            const tone = "conversational and informative"
            // --- PHASE 1: PREPARATION ---
            // Step 1 is assumed to be completed before this worker is called.
            // Chunks are already in Qdrant. We just need to fetch them.
            const allChunks = await getChunksByDocIds(DocIdList); // You need to implement or use your existing getChunksByDocIds
            // console.log(`Fetched ${allChunks.length} chunks from Qdrant for document(s) [${DocIdList.join(', ')}].`);
            if (allChunks.length === 0) {
                console.error("No chunks found for the given documents. Aborting job.");
                // Optionally update the chat with an error message
                return;
            }

            // --- PHASE 2: OUTLINING ---
            // Step 2.1: Summarize main points from each batch of 10 chunks
            const batchSize = 10;
            const mainPointsBatches: string[] = [];
            for (let i = 0; i < allChunks.length; i += batchSize) {
                const batch = allChunks.slice(i, i + batchSize);
                const mainPoints = await summarizeChunkBatch(batch);
                mainPointsBatches.push(mainPoints);
            }

            // Step 2.2: Generate a comprehensive summary from all main points
            const summary = await generateComprehensiveSummaryFromMainPoints(mainPointsBatches);

            // Step 3: Generate a Structured Podcast Outline
            const outline = await generatePodcastOutline(summary, tone);
            if (outline.length < 3) {
                throw new Error("Failed to generate a valid outline from the document summary.");
            }
            // console.log("Successfully generated podcast outline:", outline);

            // --- PHASE 3: WRITING THE SCRIPT ---
            // Step 4: Generate the Script for Each Outline Point
            const scriptSections: string[] = [];
            for (const point of outline) {
                // 4a: Retrieve relevant chunks for this outline point
                const relevantChunks = await searchRelevantChunks(point, DocIdList);

                // 4b: Generate the script for this section
                if (relevantChunks.length > 0) {
                    const sectionScript = await generateScriptSection(point, relevantChunks);
                    scriptSections.push(sectionScript);
                    // console.log(`-> Script generated for section: "${point}"`);
                } else {
                    // console.log(`-> No relevant chunks found for section: "${point}". Skipping.`);
                }
            }

            // --- PHASE 4: FINAL ASSEMBLY ---
            // Step 5: Assemble and Polish the Final Script
            const draftScript = scriptSections.join('\n\n---\n\n');
            const finalPodcastScript = await polishFinalScript(draftScript);
            // Step 6: Extract dialogues for further processing or storage
            await processAndStorePodcastAudio(finalPodcastScript, chatId, user_id, createdAt);

            // The status is set to COMPLETED inside processAndStorePodcastAudio
        } catch (error) {
            console.error(`Error in podcast worker for job ${job.id}:`, error);
            // Set status to FAILED on error
            await docClient.send(new UpdateCommand({
                TableName: ChatConfig.tableName,
                Key: { user_id, createdAt },
                UpdateExpression: "SET podcastProcessingStatus = :status",
                ExpressionAttributeValues: { ":status": "FAILED" },
            }));
            // Re-throw the error to make the job fail in BullMQ
            throw error;
        }
    },
    { connection,concurrency:3 }
);

podcastWorker.on('completed', (job) => {
    
});

podcastWorker.on('failed', (job, err) => {
    console.error(`Podcast job ${job?.id} failed:`, err);
});


/**
 * Retrieve all text chunks from Qdrant for given document IDs using scroll API.
 * @param {string[]} docIds - Array of document IDs.
 * @returns {Promise<string[]>} All fetched text chunks.
 */
async function getChunksByDocIds(docIds: string[]): Promise<string[]> {
    const allChunks: string[] = [];
    for (const docId of docIds) {
        // Using scroll API to fetch all points for a documentId
        let nextOffset: string | number | undefined = 0;
        do {
            const result = await qdrantClient.scroll(COLLECTION_NAME, {
                filter: { must: [{ key: 'documentId', match: { value: docId } }] },
                with_payload: true,
                limit: 350, // Fetch in batches of 350
                offset: nextOffset,
            });
            const texts = result.points.map(pt => pt.payload?.text).filter(Boolean) as string[];
            allChunks.push(...texts);
            if (result.next_page_offset === undefined)
                nextOffset = result.next_page_offset;
        } while (nextOffset);
    }
    return allChunks;
}