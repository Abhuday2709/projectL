import { z } from 'zod';
import { procedure } from '../../trpc'; // Adjusted import path
import { MessageConfig, type Message } from '../../../../models/messageModel'; // Adjusted import path
import { TRPCError } from '@trpc/server';
import {
  QueryCommand,
  DynamoDBDocumentClient
} from "@aws-sdk/lib-dynamodb";
import { dynamoClient } from '@/lib/AWS/AWS_CLIENT';
import { MessagesResponse } from '../../message'; // Adjusted import path

// Create a document client using DynamoDB client instance
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const listMessagesProcedure = procedure
  .input(z.object({
    chatId: z.string(),
    cursor: z.string().optional(),
    limit: z.number().min(1).max(100).default(10)
  }))
  .query(async ({ input }): Promise<MessagesResponse> => {
    const { chatId, cursor, limit } = input;

    try {
      const queryCommand = new QueryCommand({
        TableName: MessageConfig.tableName,
        KeyConditionExpression: 'chatId = :chatId',
        ExpressionAttributeValues: {
          ':chatId': chatId
        },
        Limit: limit,
        ScanIndexForward: false,
        ...(cursor && {
          ExclusiveStartKey: {
            chatId,
            createdAt: cursor
          }
        })
      });

      const result = await docClient.send(queryCommand);

      return {
        items: (result.Items || []) as Message[],
        nextCursor: result.LastEvaluatedKey?.createdAt
      };
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch messages',
        cause: error
      });
    }
  }); 