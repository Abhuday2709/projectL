import { dynamoClient } from "@/lib/AWS/AWS_CLIENT";
import { UserConfig } from "@/models/userModel";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const docClient = DynamoDBDocumentClient.from(dynamoClient);

////////////////////////////////////////////////////////////////////////////////
// API Route: PATCH /api/admin/updateUserRole/[userId]
// Updates a user's admin status and Clerk metadata.
////////////////////////////////////////////////////////////////////////////////
export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        const { userId } = await params;
        const { isAdmin } = await req.json();
        const role = isAdmin ? 'admin' : 'user'; // Remove string comparison since isAdmin should be boolean

        await docClient.send(
            new UpdateCommand({
                TableName: UserConfig.tableName,
                Key: { user_id: userId },
                UpdateExpression: "SET #role = :role",
                ExpressionAttributeNames: {
                    "#role": "role" // Add this to avoid reserved keyword conflicts
                },
                ExpressionAttributeValues: {
                    ":role": role,
                },
            })
        );

        // Update Clerk user metadata
        const client = await clerkClient();
        await client.users.updateUser(userId, {
            publicMetadata: {
                role,
            },
        });

        return NextResponse.json(
            { message: "User role updated successfully" },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error updating user role:", error);
        return NextResponse.json(
            { error: "Failed to update user role" },
            { status: 500 }
        );
    }
}