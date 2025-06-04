import { z } from 'zod';
import { procedure } from '../../trpc'; // Adjusted import path
import { MessageConfig, type Message } from '../../../../models/messageModel'; // Adjusted import path
import { TRPCError } from '@trpc/server';
import {
  PutCommand,
  DynamoDBDocumentClient
} from "@aws-sdk/lib-dynamodb";
import { dynamoClient } from '@/lib/AWS/AWS_CLIENT';
import { v4 as uuidv4 } from 'uuid';

// Create a document client using DynamoDB client instance
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const saveUserMessageProcedure = procedure
  .input(z.object({
    chatId: z.string(),
    text: z.string()
  }))
  .mutation(async ({ input }): Promise<Message> => {
    try {
      const userMessage: Message = {
        messageId: uuidv4(),
        chatId: input.chatId,
        text: input.text,
        isUserMessage: true,
        createdAt: new Date().toISOString()
      };

      await docClient.send(new PutCommand({
        TableName: MessageConfig.tableName,
        Item: userMessage
      }));

      return userMessage;
    } catch (error) {
      console.error('Failed to save user message:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to save user message',
        cause: error
      });
    }
  }); 