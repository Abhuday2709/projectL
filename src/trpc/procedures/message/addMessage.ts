import { z } from 'zod';
import { procedure } from '../../trpc'; // Adjusted import path
import { MessageConfig, type Message } from '../../../../models/messageModel'; // Adjusted import path
import { TRPCError } from '@trpc/server';
import {
  PutCommand,
  DynamoDBDocumentClient
} from "@aws-sdk/lib-dynamodb";
import { dynamoClient } from '@/lib/AWS/AWS_CLIENT';
// import { generateResponse } from '@/lib/gemini'; // Removed - AI response is handled by getAiResponseProcedure
import { v4 as uuidv4 } from 'uuid';
// Create a document client using DynamoDB client instance
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const addMessageProcedure = procedure
  .input(z.object({
    chatId: z.string(),
    text: z.string()
  }))
  .mutation(async ({ input }): Promise<Message> => { // Should now return only the userMessage
    try {
      // Save the user message
      const userMessage: Message = {
        messageId: uuidv4(),
        chatId: input.chatId,
        text: input.text,
        isUserMessage: true,
        createdAt: new Date().toISOString()
      };

      // console.log('Saving user message in addMessageProcedure:', userMessage);

      await docClient.send(new PutCommand({
        TableName: MessageConfig.tableName,
        Item: userMessage
      }));

      // All AI response generation, document fetching, and AI message saving is removed from here.
      // That logic is now handled by getAiResponseProcedure and orchestrated in ChatContext.tsx.

      return userMessage; // Return only the saved user message

    } catch (error) {
      console.error('Failed to save user message in addMessageProcedure:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to save user message',
        cause: error
      });
    }
  }); 