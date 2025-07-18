import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBDocumentClient, PutCommand, DeleteCommand, UpdateCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoClient } from '@/lib/AWS/AWS_CLIENT';
import { v4 as uuidv4 } from 'uuid';
import { Question, QuestionConfig } from '@/models/questionsModel';

const evalClient = DynamoDBDocumentClient.from(dynamoClient);

// Create question
export async function POST(request: NextRequest) {
    const {categoryId, text, uploadedAt } = await request.json();
    if (!categoryId || !text || !uploadedAt) {
        return NextResponse.json({ message: 'Invalid input' }, { status: 400 });
    }
    const id = uuidv4();
    const item = {questionId: id, categoryId, text ,uploadedAt};
    await evalClient.send(new PutCommand({ TableName: QuestionConfig.tableName, Item: item }));
    return NextResponse.json(item, { status: 201 });
}

// List questions
export async function GET(request: NextRequest) {
    try {
        const result = await evalClient.send(new ScanCommand({ TableName: QuestionConfig.tableName}));    
        const sortedItems = (result.Items as Question[]).sort((a, b) => {
            return new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
        });
        return NextResponse.json(sortedItems);
    } catch (err) {
        console.error(err);
        return NextResponse.json({ message: 'Fetch error' }, { status: 500 });
    }
} 

// Update question
export async function PUT(request: NextRequest) {
    const { questionId, text, uploadedAt } = await request.json();
    if (!questionId || !text || !uploadedAt) return NextResponse.json({ message: 'Invalid input' }, { status: 400 });
    await evalClient.send(new UpdateCommand({ TableName: QuestionConfig.tableName, Key: { questionId, uploadedAt }, UpdateExpression: 'set #text = :t', ExpressionAttributeNames: { '#text': 'text' }, ExpressionAttributeValues: { ':t': text } }));
    return NextResponse.json({ success: true });
}

// Delete question
export async function DELETE(request: NextRequest) {
    const { questionId, uploadedAt } = await request.json();
    if (!questionId || !uploadedAt) return NextResponse.json({ message: 'Invalid input' }, { status: 400 });
    await evalClient.send(new DeleteCommand({ TableName: QuestionConfig.tableName, Key: { questionId, uploadedAt } }));
    return NextResponse.json({ success: true });
}