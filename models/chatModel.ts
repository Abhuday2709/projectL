import { z } from 'zod';

// Podcast dialogue schema
export const PodcastDialogueSchema = z.object({
    speaker: z.string(),
    text: z.string(),
    audioFile: z.string(), // <-- changed from audioUrl to audioFile
});

// Chat Schema Validation
export const ChatSchema = z.object({
    user_id: z.string(), // Partition key - references user_id from Users table
    createdAt: z.string(), // Sort key - ISO timestamp
    chatId: z.string(),
    name: z.string().optional().default("untitled folder"), // Optional chat name
    podcast: z.array(PodcastDialogueSchema).optional(), // Podcast field as array of dialogues
    podcastFinal:z.string().optional(), // Final podcast URL
});

// Chat Type
export type Chat = z.infer<typeof ChatSchema>;

// Table Configuration
export const ChatConfig = {
    tableName: 'chat',
    keys: {
        partition: 'user_id', 
        sort: 'createdAt'
    },
    indexes: {
        chatId: 'chatId-index',
        createdAt: 'createdAt-index'
    }
} as const;