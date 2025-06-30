import React, { createContext, ReactNode, useState } from 'react'
import { Message } from '../../../../../../models/messageModel'
import { useMutation } from '@tanstack/react-query'

type StreamResponse = {
  addMessage: () => void
  message: string
  handleInputChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void
  isLoading: boolean
  messages: Message[]
}

export const ChatContext = createContext<StreamResponse>({
  addMessage: () => {},
  message: '',
  handleInputChange: () => {},
  isLoading: false,
  messages: [],
})

interface Props {
  chatId: string
  shareId: string
  children: ReactNode
}

export const ChatContextProvider = ({ chatId, shareId, children }: Props) => {
  const [message, setMessage] = useState<string>('')
  const [messages, setMessages] = useState<Message[]>([])
  const [isGeneratingResponse, setIsGeneratingResponse] = useState(false)

  const addMessageMutation = useMutation({
    mutationFn: (payload: { chatId: string; shareId: string; text: string }) =>
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

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)
  const addMessage = () => message.trim() && addMessageMutation.mutate({ chatId, shareId, text: message })
  const isLoading = addMessageMutation.isPending || isGeneratingResponse

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