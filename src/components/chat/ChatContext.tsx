import React, { createContext, ReactNode, useEffect, useState } from 'react'
import { Message } from '@/models/messageModel'
import { useMutation } from '@tanstack/react-query'

/** Type definition for chat context response */
type StreamResponse = {
  addMessage: () => void
  message: string
  handleInputChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void
  isLoading: boolean
  messages: Message[]
}

/** Context provider for chat functionality */
export const ChatContext = createContext<StreamResponse>({
  addMessage: () => {},
  message: '',
  handleInputChange: () => {},
  isLoading: false, 
  messages: [],
})

interface Props {
  chatId: string
  shareId?: string
  children: ReactNode
}

/** 
 * Chat context provider component
 * Manages chat state and message handling
 * @param chatId - Unique identifier for the chat session
 * @param shareId - Optional ID for shared chats
 * @param children - Child components to wrap
 */
export const ChatContextProvider = ({ chatId, shareId, children }: Props) => {
  const [message, setMessage] = useState<string>('')
  const [messages, setMessages] = useState<Message[]>([])
  const [isGeneratingResponse, setIsGeneratingResponse] = useState(false)
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  useEffect(() => {
    const fetchMessages = async () => {
      setIsInitialLoading(true);
      try {
        const response = await fetch(`/api/message?chatId=${chatId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch messages');
        }
        const data = await response.json();
        // Reverse the array to display newest messages at the bottom
        setMessages(data.reverse());
      } catch (error) {
        console.error("Error fetching initial messages:", error);
        // Optionally, set an error state here
      } finally {
        setIsInitialLoading(false);
      }
    };

    if (chatId) {
      fetchMessages();
    }
  }, [chatId]);
  /** 
   * Handles message submission and AI response
   * Optimistically updates UI and handles errors
   */
  const addMessageMutation = useMutation({
    mutationFn: (payload: { chatId: string; shareId?: string; text: string }) =>
      fetch('/api/message/saveUserMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(res => res.json()),
    
    onMutate: async ({ text }) => {
      setIsGeneratingResponse(true)
      setMessage('')

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

      setMessages(prev => [tempAiMessage, optimisticUserMessage, ...prev])

      return { tempAiId: tempAiMessage.messageId, userText: text }
    },

    onSuccess: async (savedUserMessage, variables, context) => {
      if (!context?.tempAiId || !context?.userText) return

      try {
        const res = await fetch('/api/message/getAiResponse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId: variables.chatId, shareId: variables.shareId, userMessage: context.userText }),
        })
        if (!res.ok) throw new Error('AI response failed')
        
        const savedAiMessage: Message = await res.json()

        setMessages(prev => prev.map(msg => 
          msg.messageId === context.tempAiId ? { ...savedAiMessage, isLoading: false } : msg
        ))

      } catch (err) {
        console.error('Error getting AI response:', err)
        setMessages(prev => prev.map(msg => 
          msg.messageId === context.tempAiId 
            ? { ...msg, text: 'Error: Could not get AI response.', isLoading: false } 
            : msg
        ))
      } finally {
        setIsGeneratingResponse(false)
      }
    },

    onError: (err, _vars, context) => {
      console.error("Mutation Error:", err)
      setMessages(prev => prev.filter(msg => msg.messageId !== context?.tempAiId))
      setIsGeneratingResponse(false)
    },
  })

  /** Updates message state with input value */
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)

  /** Triggers message submission if message is not empty */
  const addMessage = () => message.trim() && addMessageMutation.mutate({ chatId, text: message })
  const isLoading = addMessageMutation.isPending || isGeneratingResponse || isInitialLoading

  return (
    <ChatContext.Provider
      value={{ 
        addMessage, 
        message, 
        handleInputChange, 
        isLoading, 
        messages, 
      }}>
      {children}
    </ChatContext.Provider>
  )
}