import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoClient } from '@/lib/AWS/AWS_CLIENT';
import { UserConfig } from '@/models/userModel';
import { auth } from '@clerk/nextjs/server';

const docClient = DynamoDBDocumentClient.from(dynamoClient);

export async function GET(req: NextRequest) {
    try {
        // console.log('Fetching user role...');
        
          const { userId } = await auth();      
        if (!userId) {
            return NextResponse.json(
                { error: 'Unauthorized - No user ID found' },
                { status: 401 }
            );
        }
        // console.log('Authenticated user ID:', userId);
        
        // Fetch user data from DynamoDB
        const getUserCommand = new GetCommand({
            TableName: UserConfig.tableName,
            Key: {
                user_id: userId, // Assuming your DynamoDB table uses 'user_id' as the primary key
            },
        });
        const result = await docClient.send(getUserCommand);
        // console.log('DynamoDB result:', result.Item);
        if (!result.Item) {
            // User not found in database, default to 'user' role
            return NextResponse.json(
                { role: 'user' },
                { status: 200 }
            );
        }
        // console.log('User data fetched:', result);
        
        // Return the user's role (default to 'user' if role field doesn't exist)
        const userRole = result.Item.role;
        // console.log('User role fetched:', userRole);
        return NextResponse.json(
            { role: userRole },
            { status: 200 }
        );
    } catch (error) {
        console.error('Error fetching user role:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// Optional: POST method to update user role (admin only)
export async function POST(req: NextRequest) {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json(
                { error: 'Unauthorized - No user ID found' },
                { status: 401 }
            );
        }

        // First, check if the current user is an admin
        const getCurrentUserCommand = new GetCommand({
            TableName: UserConfig.tableName,
            Key: {
                user_id: userId,
            },
        });

        const currentUserResult = await docClient.send(getCurrentUserCommand);
        
        if (!currentUserResult.Item || currentUserResult.Item.role !== 'admin') {
            return NextResponse.json(
                { error: 'Forbidden - Admin access required' },
                { status: 403 }
            );
        }

        const body = await req.json();
        const { targetUserId, newRole } = body;

        if (!targetUserId || !newRole) {
            return NextResponse.json(
                { error: 'Missing required fields: targetUserId and newRole' },
                { status: 400 }
            );
        }

        if (!['admin', 'user'].includes(newRole)) {
            return NextResponse.json(
                { error: 'Invalid role. Must be "admin" or "user"' },
                { status: 400 }
            );
        }

        // Update the target user's role
        const updateUserCommand = new UpdateCommand({
            TableName: UserConfig.tableName,
            Key: {
                user_id: targetUserId,
            },
            UpdateExpression: 'SET #role = :role',
            ExpressionAttributeNames: {
                '#role': 'role',
            },
            ExpressionAttributeValues: {
                ':role': newRole,
            },
            ReturnValues: 'ALL_NEW',
        });

        const updateResult = await docClient.send(updateUserCommand);

        return NextResponse.json(
            { 
                message: 'User role updated successfully',
                user: updateResult.Attributes 
            },
            { status: 200 }
        );

    } catch (error) {
        console.error('Error updating user role:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}