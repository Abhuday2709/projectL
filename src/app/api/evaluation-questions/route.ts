import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBDocumentClient, PutCommand, DeleteCommand, UpdateCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoClient } from '@/lib/AWS/AWS_CLIENT';
import { v4 as uuidv4 } from 'uuid';
import { EvaluationQuestionConfig, type EvaluationQuestion } from '@/models/evaluationQuestionModel';

const evalClient = DynamoDBDocumentClient.from(dynamoClient);

// Create question
export async function POST(request: NextRequest) {
    const { userId, categoryId, questionText, order } = await request.json();
    if (!userId || !categoryId || !questionText || typeof order !== 'number') {
        return NextResponse.json({ message: 'Invalid input' }, { status: 400 });
    }
    const id = uuidv4();
    const item = { user_id: userId, evaluationQuestionId: id, categoryId, text: questionText, order };
    await evalClient.send(new PutCommand({ TableName: EvaluationQuestionConfig.tableName, Item: item }));
    return NextResponse.json(item, { status: 201 });
}

// List questions
export async function GET(request: NextRequest) {
    try {
        const result = await evalClient.send(new ScanCommand({ TableName: EvaluationQuestionConfig.tableName}));        
        return NextResponse.json(result.Items as EvaluationQuestion[]);
    } catch (err) {
        console.error(err);
        return NextResponse.json({ message: 'Fetch error' }, { status: 500 });
    }
}

// Update question
export async function PUT(request: NextRequest) {
    const { userId, evaluationQuestionId, questionText } = await request.json();
    if (!userId || !evaluationQuestionId || !questionText) return NextResponse.json({ message: 'Invalid input' }, { status: 400 });
    await evalClient.send(new UpdateCommand({ TableName: EvaluationQuestionConfig.tableName, Key: { user_id: userId, evaluationQuestionId }, UpdateExpression: 'set #text = :t', ExpressionAttributeNames: { '#text': 'text' }, ExpressionAttributeValues: { ':t': questionText } }));
    return NextResponse.json({ success: true });
}

// Delete question
export async function DELETE(request: NextRequest) {
    const { userId, evaluationQuestionId } = await request.json();
    if (!userId || !evaluationQuestionId) return NextResponse.json({ message: 'Invalid input' }, { status: 400 });
    await evalClient.send(new DeleteCommand({ TableName: EvaluationQuestionConfig.tableName, Key: { user_id: userId, evaluationQuestionId } }));
    return NextResponse.json({ success: true });
}
