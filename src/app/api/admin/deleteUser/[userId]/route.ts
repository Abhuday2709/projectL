import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { NextResponse } from "next/server";
import { UserConfig } from "../../../../../../models/userModel";
import { clerkClient } from "@clerk/nextjs/server"; // Import Clerk server SDK

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export async function DELETE(
    request: Request,
    { params }: { params: { userId: string } }
) {
    try {
        const userId = params.userId;
        if (!userId) {
            return NextResponse.json(
                { error: "userId parameter required" },
                { status: 400 }
            );
        }

        // Delete from DynamoDB
        const command = new DeleteCommand({
            TableName: UserConfig.tableName,
            Key: { user_id: userId },
        });
        await docClient.send(command);

        // Delete from Clerk
        try {
            const client = await clerkClient();
            await client.users.deleteUser(userId);
        } catch (clerkError) {
            // Log but don't fail the whole operation if Clerk deletion fails
            console.error("Clerk deletion error:", clerkError);
        }

        return NextResponse.json({ message: "User deleted successfully" });
    } catch (error) {
        console.error("Delete user error:", error);
        return NextResponse.json(
            { error: "Failed to delete user" },
            { status: 500 }
        );
    }
}