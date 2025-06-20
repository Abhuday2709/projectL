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
        // console.log(`Received AI response request for chatId: ${input.chatId}, message: "${input.userMessage}"`);

        try {
            // 1. Generate embedding for the user's message
            const queryEmbedding = await generateEmbeddings(input.userMessage);
            // console.log("User message embedding generated.");

            // 2. Search Qdrant for relevant document chunks
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
                with_payload: true, // We need the payload to get the text
                // with_vector: false, // No need for the vector itself in the result
            });
            // console.log(`Found ${searchResults.length} relevant chunks from Qdrant.`);

            // 3. Prepare context for the LLM
            const documentContext: string[] = searchResults.map((result) => {
                // Assuming payload has a 'text' field and 'fileName' for context
                let contextString = "";
                if (result.payload && typeof result.payload.text === 'string') {
                    contextString = result.payload.text;
                    if (typeof result.payload.fileName === 'string') {
                        // Optional: Add filename to context if useful
                        // contextString = `From file ${result.payload.fileName}:\\n${contextString}`;
                    }
                }
                return contextString;
            }).filter(text => text.length > 0); // Filter out any empty contexts

            if (documentContext.length === 0) {
                console.log("No relevant context found in Qdrant for the query.");
                // Optionally, you could still call generateResponse without context,
                // or return a specific message indicating no context was found.
                // For now, let's try to answer without specific document context.
            }
            
            // console.log("Context prepared for LLM:", documentContext.join('\\n\\n').substring(0, 500) + "..."); // Log a snippet

            // 4. Generate AI response using the retrieved context
            // console.log("Generating AI response with Gemini...");
            const aiTextResponse = await generateResponse(input.userMessage, documentContext);
            console.log("AI response text generated.");

            // 5. Create and save the AI message to DynamoDB
            const aiMessageToSave: Message = {
                messageId: uuidv4(),
                chatId: input.chatId,
                text: aiTextResponse,
                isUserMessage: false,
                createdAt: new Date().toISOString(),
                isLoading: false, // AI message is complete and ready
            };

            await docClient.send(new PutCommand({
                TableName: MessageConfig.tableName,
                Item: aiMessageToSave,
            }));
            console.log("AI message saved to DynamoDB.");

            return aiMessageToSave; // Return the saved AI Message object

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