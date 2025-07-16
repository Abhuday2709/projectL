import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import { Message } from '@/models/messageModel';

/**
 * Throws if the Gemini API key is not configured.
 * @throws {Error} If GEMINI_API_KEY is missing.
 */
if (!process.env.GEMINI_API_KEY) {
    throw new Error('Missing GEMINI_API_KEY environment variable');
}
/**
 * Initialized Google Generative AI client.
 * @constant {GoogleGenerativeAI} genAI
 */
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
/**
 * Generate a conversational response using Gemini LLM.
 * @export
 * @async
 * @param {string} userMessage – The user's query text.
 * @param {string[]} documentContext – Array of relevant document snippets.
 * @param {Message[]} [recentMessages=[]] – Recent conversation messages.
 * @returns {Promise<string>} The generated reply in Markdown format.
 * @throws {Error} On API key issues, quota issues, or generation failures.
 */
export async function generateResponse(
    userMessage: string,
    documentContext: string[],
    recentMessages: Message[] = []
): Promise<string> {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        // Format conversation history
        const conversationHistory = recentMessages.length > 0
            ? recentMessages.map(msg => ({
                role: msg.isUserMessage ? 'user' : 'model',
                parts: [{ text: msg.text }]
            }))
            : [];

        // Prepare document context, clearly labeling it for the model
        const documentContextText = documentContext.length > 0
            ? `RELEVANT DOCUMENTS:\n${documentContext.join('\n---\n')}` // Using a separator
            : 'No documents provided.';

        // --- THE IMPROVED PROMPT ---
        const systemInstruction = `You are an expert assistant. Your task is to answer the user's question in a clear, concise, and helpful manner, formatted in Markdown.

RULES:
1.  **Synthesize Information:** Base your answer on the information provided in the "RELEVANT DOCUMENTS" section and the "CONVERSATION HISTORY".
2.  **Do Not Reference the Context:** Formulate a direct answer to the user's question. DO NOT say "according to the document," "the context states," or any similar phrases. Act as if you already know the information.
3.  **Handle Unknowns:** If the answer cannot be found in the provided documents or history, state clearly that you do not have enough information to answer. Do not make up information.
4.  **Be Conversational:** Maintain a professional and helpful tone. Address the user directly.`;

        // Combine history with the new user request
        const contents = [
            ...conversationHistory,
            {
                role: 'user' as const,
                parts: [{
                    text: `
${documentContextText}

USER QUESTION: "${userMessage}"
` }]
            }
        ];

        const result = await model.generateContent({
            contents: contents,
            systemInstruction: {
                role: 'system',
                parts: [{ text: systemInstruction }],
            },
            // Optional: Safety settings can be adjusted if needed
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            ]
        });

        const response = result.response;
        const responseText = response.text();
        // console.log('Gemini API Response:', responseText);

        return responseText;

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
/**
 * Generate an embedding vector for the given text.
 * @export
 * @async
 * @param {string} text – Text to embed.
 * @returns {Promise<number[]>} Array of embedding values.
 * @throws {Error} On API key issues, quota issues, or embedding failures.
 */
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