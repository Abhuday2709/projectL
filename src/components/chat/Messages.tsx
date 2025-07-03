import { useContext, useEffect, useRef, useState } from 'react'
import { ChatContext } from './ChatContext'
import Message from './Message'
import { ArrowDown, Loader2 } from 'lucide-react'

function Messages() {
  const { messages, isLoading } = useContext(ChatContext)
  const containerRef = useRef<HTMLDivElement>(null)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [isNearBottom, setIsNearBottom] = useState(true)

  // Auto-scroll to bottom for new messages
  const scrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }

  // Monitor scroll position
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight
      const nearBottom = distanceFromBottom < 100

      setIsNearBottom(nearBottom)
      setShowScrollButton(!nearBottom && messages.length > 0)
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [messages.length])

  // Auto-scroll on new messages if user is near bottom
  useEffect(() => {
    if (isNearBottom && messages.length > 0) {
      scrollToBottom()
    }
  }, [messages, isNearBottom])

  return (
    <div className='relative h-full'>
      {/* Messages Container */}
      <div
        ref={containerRef}
        className='flex flex-col-reverse h-full overflow-y-auto scroll-smooth px-4 py-6 space-y-4 space-y-reverse scrollbar-thin scrollbar-thumb-[#DBE2EF] scrollbar-track-transparent hover:scrollbar-thumb-[#3F72AF]/50'
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#DBE2EF transparent'
        }}
      >
        {/* Empty State */}
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className='text-center space-y-4 max-w-md'>
              <div className='bg-gradient-to-r from-[#3F72AF] to-[#112D4E] p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center shadow-lg'>
                <svg className='w-8 h-8 text-white' fill='currentColor' viewBox='0 0 24 24'>
                  <path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z' />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-lg text-[#112D4E] mb-2">Ready to Chat!</h3>
                <p className="text-[#3F72AF]/70 text-sm leading-relaxed">
                  Ask me anything about your documents. I'm here to help you find insights and answers.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((message, i) => {
          const isNextMessageSamePerson = (messages[i - 1]?.isUserMessage === messages[i]?.isUserMessage)
          return (
            <Message
              key={message.messageId}
              message={message}
              isNextMessageSamePerson={isNextMessageSamePerson}
            />
          )
        })}
      </div>

      {/* Scroll to Bottom Button */}
      {showScrollButton && (
        <button
          onClick={scrollToBottom}
          className='absolute bottom-6 right-6 bg-gradient-to-r from-[#3F72AF] to-[#112D4E] hover:from-[#112D4E] hover:to-[#3F72AF] text-white p-3 rounded-full shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl border border-white/20 backdrop-blur-sm z-10'
          aria-label='Scroll to bottom'
        >
          <ArrowDown className='h-5 w-5' />
        </button>
      )}

      {/* Loading Overlay for Initial Load */}
      {isLoading && messages.length === 0 && (
        <div className='absolute inset-0 bg-[#F9F7F7]/80 backdrop-blur-sm flex items-center justify-center z-20'>
          <div className='bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-[#DBE2EF]/50'>
            <div className='flex items-center gap-3'>
              <Loader2 className='h-6 w-6 animate-spin text-[#3F72AF]' />
              <span className='text-[#112D4E] font-medium'>Loading conversation...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Messages