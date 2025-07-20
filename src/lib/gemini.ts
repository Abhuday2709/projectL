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
 * @param {string[]} [networkScienceQA=[]] – Network Science Q&A pairs.
 * @returns {Promise<string>} The generated reply in Markdown format.
 * @throws {Error} On API key issues, quota issues, or generation failures.
 */
export async function generateResponse(
    userMessage: string,
    documentContext: string[],
    recentMessages: Message[] = [],
    networkScienceQA: string[] = []
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

        // Prepare document context
        const documentContextText = documentContext.length > 0
            ? `RELEVANT DOCUMENTS:\n${documentContext.join('\n---\n')}`
            : '';

        // Prepare Network Science Q&A context
        const networkScienceQAText = networkScienceQA.length > 0
            ? `NETWORK SCIENCE KNOWLEDGE BASE:\n${networkScienceQA.join('\n---\n')}`
            : '';

        // Combine all contexts
        const allContexts = [documentContextText, networkScienceQAText].filter(Boolean);
        const contextText = allContexts.length > 0 
            ? allContexts.join('\n\n') 
            : 'No relevant context provided.';

        // --- THE IMPROVED PROMPT ---
        const systemInstruction = `You are an expert assistant specializing in answering questions with a focus on Network Science topics. Your task is to answer the user's question in a clear, concise, and helpful manner, formatted in Markdown.

PRIORITY RULES:
1. **Network Science Priority:** If the user's question is related to Network Science concepts, definitions, history, or theory, prioritize information from the "NETWORK SCIENCE KNOWLEDGE BASE" section.
2. **Document Priority:** If the question is not about Network Science fundamentals, prioritize information from the "RELEVANT DOCUMENTS" section.
3. **Synthesize Information:** Base your answer on the provided context and conversation history.
4. **Handle Unknowns:** If the answer cannot be found in any of the provided sources (neither Network Science knowledge base nor documents), respond with "I don't know" or "I don't have enough information to answer that question."

RESPONSE GUIDELINES:
- **Do Not Reference Sources:** Formulate a direct answer. DO NOT say "according to the document," "the knowledge base states," or any similar phrases. Act as if you already know the information.
- **Be Conversational:** Maintain a professional and helpful tone. Address the user directly.
- **Be Accurate:** Only provide information that is explicitly supported by the context provided.
- **Prioritize Relevance:** Focus on answering the specific question asked rather than providing general information.`;

        // Combine history with the new user request
        const contents = [
            ...conversationHistory,
            {
                role: 'user' as const,
                parts: [{
                    text: `
                    ${contextText}
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
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            ]
        });

        const response = result.response;
        const responseText = response.text();

        // Check if the response indicates lack of information
        const lowerCaseResponse = responseText.toLowerCase();
        if (lowerCaseResponse.includes("don't know") || 
            lowerCaseResponse.includes("no information") || 
            lowerCaseResponse.includes("cannot find") ||
            responseText.trim() === "-1") {
            return "I don't know";
        }

        return responseText;

    } catch (error) {
        console.error('Gemini API Error:', {
            error,
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            userMessage,
            contextLength: documentContext.length,
            networkScienceQALength: networkScienceQA.length
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