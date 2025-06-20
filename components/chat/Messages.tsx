import React, { useContext, useEffect, useRef } from 'react'
import { ChatContext } from './ChatContext'
import Message from './Message'
import { useIntersection } from '@mantine/hooks'

function Messages() {
  const { messages, isLoading, hasMore, loadMoreMessages } = useContext(ChatContext)
  const containerRef = useRef<HTMLDivElement>(null)

  const { ref, entry } = useIntersection({
    root: null,
    threshold: 0.1,
    rootMargin: '100px'
  })

  useEffect(() => {
    if (entry?.isIntersecting && hasMore && !isLoading) {
      loadMoreMessages()
    }
  }, [entry, hasMore, isLoading, loadMoreMessages])

  return (
    <div ref={containerRef} className='flex flex-col-reverse h-full overflow-y-auto p-3 rounded-lg'>
      {messages.length === 0 && (
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-500">No messages yet. Start the conversation!</p>
        </div>
      )}
      {messages.map((message, i) => {
        const isLastMessage = i === 0
        const isOptimistic = i === 0 && isLoading

        return (
          <div
            key={message.messageId}
            ref={isLastMessage ? ref : undefined}
          >
            <Message 
              message={message} 
              isOptimistic={isOptimistic}
            />
          </div>
        )
      })}
    </div>
  )
}

export default Messages