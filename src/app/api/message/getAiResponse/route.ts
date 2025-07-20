import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { QdrantClient } from '@qdrant/js-client-rest';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
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
        }

        // Fetch last 8 recent messages for this chat
        const messagesQuery = new QueryCommand({
            TableName: MessageConfig.tableName,
            KeyConditionExpression: 'chatId = :cid',
            ExpressionAttributeValues: { ':cid': shareId || chatId },
            ScanIndexForward: false,
            Limit: 8,
        });
        const messagesResult = await docClient.send(messagesQuery);
        const recentMessages = (messagesResult.Items || []) as Message[];
        const chronologicalMessages = recentMessages.reverse();

        const embedding = await generateEmbeddings(userMessage);
        
        // Step 2: Search Qdrant for document contexts
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
                return `Source Document: ${doc.fileName}\n---\n${docContexts.join('\n\n')}`;
            }
            return null;
        });

        const documentContexts = (await Promise.all(contextPromises)).filter(Boolean) as string[];
        
        // Step 3: Search for Network Science questions and fetch corresponding answers
        const aboutQuestions = await qdrant.search(process.env.QDRANT_COLLECTION_NAME_2!, {
            vector: embedding,
            limit: 3,
            with_payload: true,
        });
        // console.log(`Found ${aboutQuestions.length} relevant Network Science questions for the query.`);
        
        // Fetch answers from DynamoDB for the matched questions
        const networkScienceQA: string[] = [];
        
        for (const questionResult of aboutQuestions) {
            if (questionResult.payload?.id) {
                try {
                    const getAnswerCommand = new GetCommand({
                        TableName: 'projectL-NetworkScienceQuestion', // Replace with your actual table name
                        Key: {
                            QuestionID: questionResult.payload.id // Assuming 'id' corresponds to the partition key
                        }
                    });
                    
                    const answerResult = await docClient.send(getAnswerCommand);
                    
                    if (answerResult.Item) {
                        const question = questionResult.payload?.question || 'Unknown question';
                        const answer = answerResult.Item.Answer || 'No answer found';
                        networkScienceQA.push(`Q: ${question}\nA: ${answer}`);
                    }
                } catch (error) {
                    console.error(`Error fetching answer for question ID ${questionResult.payload.id}:`, error);
                }
            }
        }
        // console.log(networkScienceQA);
        
        // Pass all contexts to generateResponse
        const aiText = await generateResponse(userMessage, documentContexts, chronologicalMessages, networkScienceQA);

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