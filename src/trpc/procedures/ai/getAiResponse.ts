import { z } from "zod";
import { procedure } from "../../trpc";
import { TRPCError } from "@trpc/server";
import { QdrantClient } from "@qdrant/js-client-rest";
import { generateEmbeddings, generateResponse } from "../../../lib/gemini"; // Adjusted path
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb"; // Added
import { dynamoClient } from "@/lib/AWS/AWS_CLIENT"; // Added
import { MessageConfig, type Message } from "../../../../models/messageModel"; // Added
import { v4 as uuidv4 } from 'uuid'; // Added

// Qdrant Client Initialization
const qdrantClient = new QdrantClient({
    host: process.env.QDRANT_HOST || 'localhost',
    port: process.env.QDRANT_PORT ? parseInt(process.env.QDRANT_PORT) : 6333,
});

const QDRANT_COLLECTION_NAME = process.env.QDRANT_COLLECTION_NAME || 'document_embeddings';
const SEARCH_RESULT_LIMIT = 5; // Number of document chunks to retrieve

// DynamoDB Document Client
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const getAiResponseProcedure = procedure
    .input(
        z.object({
            chatId: z.string(),
            userMessage: z.string(),
        })
    )
    .mutation(async ({ input }): Promise<Message> => {
        try {
            const queryEmbedding = await generateEmbeddings(input.userMessage);
            const searchResults = await qdrantClient.search(QDRANT_COLLECTION_NAME, {
                vector: queryEmbedding,
                filter: {
                    must: [
                        {
                            key: 'chatId',
                            match: {
                                value: input.chatId,
                            },
                        },
                    ],
                },
                limit: SEARCH_RESULT_LIMIT,
                with_payload: true,
            });
            const documentContext: string[] = searchResults.map((result) => {
                let contextString = "";
                if (result.payload && typeof result.payload.text === 'string') {
                    contextString = result.payload.text;
                    if (typeof result.payload.fileName === 'string') {
                        // Optional: Add filename to context if useful
                        // contextString = `From file ${result.payload.fileName}:\\n${contextString}`;
                    }
                }
                return contextString;
            }).filter(text => text.length > 0); 
            if (documentContext.length === 0) {
                console.log("No relevant context found in Qdrant for the query.");
            }
            const aiTextResponse = await generateResponse(input.userMessage, documentContext);
            console.log("AI response text generated.");
            const aiMessageToSave: Message = {
                messageId: uuidv4(),
                chatId: input.chatId,
                text: aiTextResponse,
                isUserMessage: false,
                createdAt: new Date().toISOString(),
                isLoading: false, 
            };
            await docClient.send(new PutCommand({
                TableName: MessageConfig.tableName,
                Item: aiMessageToSave,
            }));
            console.log("AI message saved to DynamoDB.");
            return aiMessageToSave;
        } catch (error) {
            console.error("Error in getAiResponseProcedure:", error);
            if (error instanceof TRPCError) {
                throw error;
            }
            const errMsg = error instanceof Error ? error.message : "An unknown error occurred";
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: `Failed to get AI response: ${errMsg}`,
                cause: error,
            });
        }
    }); 