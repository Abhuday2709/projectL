import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) {
    throw new Error('Missing GEMINI_API_KEY environment variable');
}

// Initialize the Gemini API client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function generateResponse(
    userMessage: string,
    documentContext: string[]
): Promise<string> {
    try {
        // Initialize the model
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        // Prepare the context from documents
        const context = documentContext.length > 0
            ? `Context from documents:\n${documentContext.join('\n\n')}\n\n`
            : '';
        // Create the prompt with formatting instructions
        const prompt = `${context}User message: ${userMessage}\n\nPlease provide a helpful response based on the context and user's message and if the answer is not present in the context, please say so and just say that you don't know. Format your response using HTML tags instead of markdown (don't include \`\`\` html \`\`\`):
        - Use <strong>text</strong> for bold text
        - Use <em>text</em> for italic text
        - Use <h1>text</h1> for main headings
        - Use <h2>text</h2> for subheadings
        - Use <ul><li>item</li></ul> for bullet points
        - Use <ol><li>item</li></ol> for numbered lists
        - Use <p>text</p> for paragraphs
        - Use <code>text</code> for code or technical terms`;

        // Generate response
        const result = await model.generateContent(prompt);
        const response = await result.response;
        
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