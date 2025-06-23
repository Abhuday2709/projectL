import React, { createContext, ReactNode, useState } from 'react'
import { Message } from '../../../models/messageModel'
import { useMutation, useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { trpc } from '@/app/_trpc/client'


export interface MessagesResponse {
  items: Message[];
  nextCursor?: string | undefined;
}

type StreamResponse = {
  addMessage: () => void
  message: string
  handleInputChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void
  isLoading: boolean
  messages: Message[]
  hasMore: boolean
  loadMoreMessages: () => void
  isGeneratingResponse: boolean
}

export const ChatContext = createContext<StreamResponse>({
  addMessage: () => { },
  message: '',
  handleInputChange: () => { },
  isLoading: false,
  messages: [],
  hasMore: false,
  loadMoreMessages: () => { },
  isGeneratingResponse: false
})

interface Props {
  chatId: string
  children: ReactNode
}

export const ChatContextProvider = ({ chatId, children }: Props) => {
  const [message, setMessage] = useState<string>('')
  const [isGeneratingResponse, setIsGeneratingResponse] = useState(false)
  const queryClient = useQueryClient()

  // Update the useInfiniteQuery to use TRPC's useInfiniteQuery
  const { data, fetchNextPage, hasNextPage, isLoading: isMessagesLoading} = trpc.messages.list.useInfiniteQuery(
    {
      chatId,
      limit: 10
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      refetchOnWindowFocus: true,
      refetchInterval: 1000,
    }
  );

  const messages = data?.pages.flatMap((page) => page.items) ?? []

  // Mutation for getting AI response - defined without callbacks here
  const getAiResponseMutation = trpc.getAiResponse.useMutation();

  const addMessageMutation = trpc.messages.add.useMutation({
    onMutate: async ({ chatId, text }) => {
      setIsGeneratingResponse(true);
      await queryClient.cancelQueries({ queryKey: ['messages.list', { chatId }] });
      const previousMessages = queryClient.getQueryData(['messages.list', { chatId }]);

      const optimisticUserMessage: Message = {
        messageId: crypto.randomUUID(),
        chatId,
        text,
        isUserMessage: true,
        createdAt: new Date().toISOString(),
      };

      const tempAiMessage: Message = {
        messageId: 'temp-ai-' + crypto.randomUUID(),
        chatId,
        text: '',
        isUserMessage: false,
        createdAt: new Date().toISOString(),
        isLoading: true,
      };

      queryClient.setQueryData(['messages.list', { chatId }], (old: any) => ({
        pages: [
          {
            items: [optimisticUserMessage, tempAiMessage, ...(old?.pages[0]?.items || [])],
            nextCursor: old?.pages[0]?.nextCursor,
          },
          ...(old?.pages.slice(1) || []),
        ],
        pageParams: old?.pageParams || [],
      }));

      setMessage('');
      return { previousMessages, tempAiMessageId: tempAiMessage.messageId, userMessageText: text };
    },
    onSuccess: (data, variables, context) => {
        if (context?.tempAiMessageId && context?.userMessageText) {
            const currentChatId = variables.chatId;
            const currentUserMessage = context.userMessageText;
            const currentTempAiMessageId = context.tempAiMessageId;

            getAiResponseMutation.mutate(
                { // Procedure Input for getAiResponse
                    chatId: currentChatId,
                    userMessage: currentUserMessage,
                },
                { // Mutation Options with callbacks that close over currentTempAiMessageId
                    onSuccess: (savedAiMessage: Message) => { // savedAiMessage is the full Message object
                        queryClient.setQueryData(['messages.list', { chatId: currentChatId }], (old: any) => {
                            let updated = false;
                            const newPages = old.pages.map((page: any) => ({
                                ...page,
                                items: page.items.map((msg: Message) => {
                                    if (msg.messageId === currentTempAiMessageId) {
                                        updated = true;
                                        // Replace temp message with the actual saved AI message, ensuring all fields are updated
                                        return { 
                                            ...savedAiMessage, // Spread the complete saved message
                                            isLoading: false, // Explicitly ensure isLoading is false
                                        }; 
                                    }
                                    return msg;
                                }),
                            }));
                            if (!updated) { // Fallback if temp message wasn't found
                                console.warn('Optimistic AI message not found for update, adding new message.');
                                const newAiMessage: Message = {
                                    ...savedAiMessage, // Use the complete saved message
                                    isLoading: false,
                                };
                                if (newPages.length > 0 && newPages[0].items) {
                                    newPages[0].items.unshift(newAiMessage);
                                } else {
                                     newPages[0] = { items: [newAiMessage], nextCursor: undefined };
                                }
                            }
                            return { ...old, pages: newPages };
                        });
                    },
                    onError: (error) => {
                        console.error("Error getting AI response:", error);
                        queryClient.setQueryData(['messages.list', { chatId: currentChatId }], (old: any) => {
                            const newPages = old.pages.map((page: any) => ({
                                ...page,
                                items: page.items.map((msg: Message) => {
                                    if (msg.messageId === currentTempAiMessageId) {
                                        return { ...msg, text: "Error: Could not get AI response.", isLoading: false };
                                    }
                                    return msg;
                                }),
                            }));
                            return { ...old, pages: newPages };
                        });
                    },
                    onSettled: () => {
                        setIsGeneratingResponse(false);
                        queryClient.invalidateQueries({ queryKey: ['messages.list', { chatId: currentChatId }] });
                    }
                }
            );
        } else {
            console.error("Missing context for AI call after adding message");
            setIsGeneratingResponse(false);
        }
    },
    onError: (err, newMessage, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(['messages.list', { chatId: newMessage.chatId }], context.previousMessages);
      }
      setIsGeneratingResponse(false);
    },
    onSettled: (data, error, variables, context) => {
      if (error) {
        queryClient.invalidateQueries({ queryKey: ['messages.list', { chatId: variables.chatId }] });
        setIsGeneratingResponse(false);
      }
    }
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value)
  }

  const addMessage = () => {
    if (!message.trim()) return
    
    addMessageMutation.mutate({
      chatId,
      text: message
    })
  }

  const isLoading = isMessagesLoading || addMessageMutation.isPending || isGeneratingResponse; // isGeneratingResponse is now more accurate

  return (
    <ChatContext.Provider
      value={{
        addMessage,
        message,
        handleInputChange,
        isLoading,
        messages,
        hasMore: !!hasNextPage,
        loadMoreMessages: () => fetchNextPage(),
        isGeneratingResponse
      }}
    >
      {children}
    </ChatContext.Provider>
  )
}