import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { QdrantClient } from '@qdrant/js-client-rest';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoClient } from '@/lib/AWS/AWS_CLIENT';
import { generateEmbeddings, generateResponse } from '@/lib/gemini';
import { MessageConfig, type Message } from '../../../../../models/messageModel';
import { v4 as uuidv4 } from 'uuid';

const qdrant = new QdrantClient({ host: process.env.QDRANT_HOST!, port: parseInt(process.env.QDRANT_PORT!) });
const msgClient = DynamoDBDocumentClient.from(dynamoClient);

export async function POST(request: NextRequest) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

    const body = await request.json().catch(() => null);
    if (!body || !body.chatId || !body.userMessage)
        return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    const { chatId, userMessage } = body;
    try {
        const embedding = await generateEmbeddings(userMessage);
        const results = await qdrant.search(process.env.QDRANT_COLLECTION_NAME!, {
            vector: embedding,
            filter: { must: [{ key: 'chatId', match: { value: chatId } }] },
            limit: 5,
            with_payload: true,
        });

        const contexts = results
            .map(r => (r.payload?.text as string) || '')
            .filter(Boolean);

        const aiText = await generateResponse(userMessage, contexts);
        const aiMsg: Message = { messageId: uuidv4(), chatId, text: aiText, isUserMessage: false, createdAt: new Date().toISOString(), isLoading: false };

        await msgClient.send(new PutCommand({ TableName: MessageConfig.tableName, Item: aiMsg }));
        return NextResponse.json(aiMsg);
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'AI response failed' }, { status: 500 });
    }
}
