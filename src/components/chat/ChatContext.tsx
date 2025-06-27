import React, { createContext, ReactNode, useState } from 'react'
import { Message } from '../../../models/messageModel'
import { useInfiniteQuery, useQueryClient, useMutation } from '@tanstack/react-query'

export interface MessagesResponse {
  items: Message[];
  nextCursor?: string;
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
  addMessage: () => {},
  message: '',
  handleInputChange: () => {},
  isLoading: false,
  messages: [],
  hasMore: false,
  loadMoreMessages: () => {},
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

  const { data, fetchNextPage, hasNextPage, isLoading: isMessagesLoading } = useInfiniteQuery({
    queryKey: ['messages.list', { chatId }],
    queryFn: ({ pageParam }) => {
      const url = new URL('/api/message', window.location.origin);
      url.searchParams.set('chatId', chatId);
      url.searchParams.set('limit', '10');
      if (pageParam) {
        url.searchParams.set('cursor', pageParam);
      }
      return fetch(url.toString()).then(res => res.json());
    },
    getNextPageParam: (lastPage: MessagesResponse) => lastPage.nextCursor,
    refetchOnWindowFocus: true,
    refetchInterval: 1000,
    initialPageParam: undefined,
  })

  const messages = data?.pages.flatMap((page: MessagesResponse) => page.items) ?? []

  const addMessageMutation = useMutation({
    mutationFn: (payload: { chatId: string; text: string }) =>
      fetch('/api/message/saveUserMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(res => res.json()),
    onMutate: async ({ chatId, text }) => {
      setIsGeneratingResponse(true)
      await queryClient.cancelQueries({ queryKey: ['messages.list', { chatId }] })
      const previous = queryClient.getQueryData(['messages.list', { chatId }])

      const optimisticUserMessage: Message = {
        messageId: crypto.randomUUID(),
        chatId,
        text,
        isUserMessage: true,
        createdAt: new Date().toISOString(),
      }
      const tempAiMessage: Message = {
        messageId: 'temp-ai-' + crypto.randomUUID(),
        chatId,
        text: '',
        isUserMessage: false,
        createdAt: new Date().toISOString(),
        isLoading: true,
      }

      queryClient.setQueryData(['messages.list', { chatId }], (old: any) => ({
        pages: [
          {
            items: [optimisticUserMessage, tempAiMessage, ...(old?.pages[0]?.items || [])],
            nextCursor: old?.pages[0]?.nextCursor,
          },
          ...(old?.pages.slice(1) || []),
        ],
        pageParams: old?.pageParams || [],
      }))

      setMessage('')
      return { previous, tempAiId: tempAiMessage.messageId, userText: text }
    },
    onSuccess: async (_data, variables, context) => {
      if (context?.tempAiId && context?.userText) {
        const currentChatId = variables.chatId
        const currentUserText = context.userText
        const currentTempAiId = context.tempAiId

        try {
          const res = await fetch('/api/message/getAiResponse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId: currentChatId, userMessage: currentUserText }),
          })
          if (!res.ok) throw new Error('AI response failed')
          const savedAiMessage: Message = await res.json()

          queryClient.setQueryData(['messages.list', { chatId: currentChatId }], (old: any) => {
            let found = false
            const pages = old.pages.map((page: any) => ({
              ...page,
              items: page.items.map((msg: Message) => {
                if (msg.messageId === currentTempAiId) {
                  found = true
                  return { ...savedAiMessage, isLoading: false }
                }
                return msg
              }),
            }))
            if (!found) {
              pages[0].items.unshift({ ...savedAiMessage, isLoading: false })
            }
            return { ...old, pages }
          })
        } catch (err) {
          console.error('Error getting AI response:', err)
          queryClient.setQueryData(['messages.list', { chatId: currentChatId }], (old: any) => {
            const pages = old.pages.map((page: any) => ({
              ...page,
              items: page.items.map((msg: Message) =>
                msg.messageId === currentTempAiId
                  ? { ...msg, text: 'Error: Could not get AI response.', isLoading: false }
                  : msg
              ),
            }))
            return { ...old, pages }
          })
        } finally {
          setIsGeneratingResponse(false)
          queryClient.invalidateQueries({ queryKey: ['messages.list', { chatId: currentChatId }] })
        }
      } else {
        console.error('Missing context for AI call')
        setIsGeneratingResponse(false)
      }
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['messages.list', { chatId: _vars.chatId }], context.previous)
      }
      setIsGeneratingResponse(false)
    },
    onSettled: (_data, error, vars) => {
      if (error) {
        queryClient.invalidateQueries({ queryKey: ['messages.list', { chatId: vars.chatId }] })
        setIsGeneratingResponse(false)
      }
    },
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)
  const addMessage = () => message.trim() && addMessageMutation.mutate({ chatId, text: message })
  const isLoading = isMessagesLoading || addMessageMutation.isPending || isGeneratingResponse

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
      }}>
      {children}
    </ChatContext.Provider>
  )
}