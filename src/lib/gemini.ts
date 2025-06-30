import { GoogleGenerativeAI } from '@google/generative-ai';
import { Message } from '../../models/messageModel';

if (!process.env.GEMINI_API_KEY) {
    throw new Error('Missing GEMINI_API_KEY environment variable');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function generateResponse(
    userMessage: string,
    documentContext: string[],
    recentMessages: Message[] = []
): Promise<string> {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        
        // Format conversation history
        const conversationHistory = recentMessages.length > 0
            ? recentMessages.map(msg => 
                `${msg.isUserMessage ? 'User' : 'Assistant'}: ${msg.text}`
            ).join('\n')
            : '';
        
        // Prepare document context
        const documentContextText = documentContext.length > 0
            ? `\n\nRELEVANT CONTEXT:\n${documentContext.map((doc, i) => ` ${doc}`).join('\n\n')}`
            : '';
        
        // Enhanced prompt with better instructions
        const prompt = `Use the following pieces of context (or previous conversaton if needed) to answer the users question in markdown format.

        Use the following pieces of context (or previous conversaton if needed) to answer the users question in markdown format. \nIf you don't know the answer, just say that you don't know, don't try to make up an answer.

        ${conversationHistory ? `CONVERSATION HISTORY:\n${conversationHistory}\n` : ''}
        CURRENT USER QUESTION: ${userMessage}${documentContextText}
        INSTRUCTIONS:
    RESPONSE QUALITY:
    - Be comprehensive but concise
    - Provide specific examples when helpful
    - Structure your response logically
    - Address all parts of the user's question

    TONE: Be professional, helpful, and conversational. Adapt your tone to match the context of the conversation.

    ACCURACY: If you're uncertain about something, express that uncertainty rather than guessing.

    Please provide your response now:`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        console.log('Gemini API Response:', response.text());
        
        return response.text();
    } catch (error) {
        console.error('Gemini API Error:', {
            error,
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            userMessage,
            contextLength: documentContext.length
        });
        
        if (error instanceof Error) {
            if (error.message.includes('API key')) {
                throw new Error('Invalid or missing Gemini API key');
            }
            if (error.message.includes('quota')) {
                throw new Error('Gemini API quota exceeded');
            }
        }
        
        throw new Error(`Failed to generate response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

export async function generateEmbeddings(text: string): Promise<number[]> {
    try {
        const model = genAI.getGenerativeModel({ model: "embedding-001" });
        const result = await model.embedContent(text);
        const embedding = result.embedding;
        return embedding.values;
    } catch (error) {
        console.error('Gemini API Error (Embeddings):', {
            error,
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            text
        });

        if (error instanceof Error) {
            if (error.message.includes('API key')) {
                throw new Error('Invalid or missing Gemini API key for embeddings');
            }
            if (error.message.includes('quota')) {
                throw new Error('Gemini API quota exceeded for embeddings');
            }
        }
        throw new Error(`Failed to generate embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}