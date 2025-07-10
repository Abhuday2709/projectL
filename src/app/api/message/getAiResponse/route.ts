import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { QdrantClient } from '@qdrant/js-client-rest';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoClient } from '@/lib/AWS/AWS_CLIENT';
import { generateEmbeddings, generateResponse } from '@/lib/gemini';
import { MessageConfig, type Message } from '@/models/messageModel';
import { v4 as uuidv4 } from 'uuid';
import { Document, DocumentConfig } from '@/models/documentModel';

const qdrant = new QdrantClient({ host: process.env.QDRANT_HOST!, port: parseInt(process.env.QDRANT_PORT!) });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export async function POST(request: NextRequest) {
    // const { userId } = await auth();
    // if (!userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const body = await request.json().catch(() => null);
    if (!body || !body.chatId || !body.userMessage)
        return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    const { chatId, userMessage, shareId } = body;
    try {
        // Step 1: Fetch all documents associated with the chatId from DynamoDB
        const docsQuery = new QueryCommand({
            TableName: DocumentConfig.tableName,
            KeyConditionExpression: 'chatId = :cid',
            ExpressionAttributeValues: { ':cid': chatId },
        });
        const docsResult = await docClient.send(docsQuery);
        const documents = (docsResult.Items || []) as Document[];

        if (documents.length === 0) {
            console.warn(`No documents found for chatId: ${chatId}`);
            // Fallback or error response if no documents are linked to the chat
        }

        // Fetch last 8 recent messages for this chat
        const messagesQuery = new QueryCommand({
            TableName: MessageConfig.tableName,
            KeyConditionExpression: 'chatId = :cid',
            ExpressionAttributeValues: { ':cid': shareId || chatId },
            ScanIndexForward: false, // Descending order (newest first)
            Limit: 8,
        });
        const messagesResult = await docClient.send(messagesQuery);
        const recentMessages = (messagesResult.Items || []) as Message[];

        // Reverse the messages to get chronological order (oldest first)
        const chronologicalMessages = recentMessages.reverse();

        console.log(`Found ${chronologicalMessages.length} recent messages for chatId ${chatId}`);

        const embedding = await generateEmbeddings(userMessage);
        
        // Step 2: Search Qdrant for each document and collect contexts
        const contextPromises = documents.map(async (doc) => {
            const searchResult = await qdrant.search(process.env.QDRANT_COLLECTION_NAME!, {
                vector: embedding,
                filter: { must: [{ key: 'documentId', match: { value: doc.docId } }] },
                limit: 5,
                with_payload: true,
            });
            const docContexts = searchResult
                .map(r => (r.payload?.text as string) || '')
                .filter(Boolean);
            if (docContexts.length > 0) {
                // Step 3: Format the context with the document name
                return `Source Document: ${doc.fileName}\n---\n${docContexts.join('\n\n')}`;
            }
            return null;
        });

        const contexts = (await Promise.all(contextPromises)).filter(Boolean) as string[];

        // Pass the chronological messages and formatted contexts to generateResponse
        const aiText = await generateResponse(userMessage, contexts, chronologicalMessages);

        const aiMsg: Message = {
            messageId: uuidv4(),
            chatId: shareId || chatId,
            text: aiText,
            isUserMessage: false,
            createdAt: new Date().toISOString(),
            isLoading: false,
        };

        await docClient.send(new PutCommand({ TableName: MessageConfig.tableName, Item: aiMsg }));
        return NextResponse.json(aiMsg);

    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'AI response failed' }, { status: 500 });
    }
}