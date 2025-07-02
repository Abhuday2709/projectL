import { Message as IMessage } from '@/models/messageModel'
import { cn } from '@/lib/utils'
import { Sparkles, Bot, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'

interface AIMessageProps {
  message: IMessage
  isOptimistic?: boolean 
}

function AIMessage({ message, isOptimistic }: AIMessageProps) {
  const [copied, setCopied] = useState(false)

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  const handleCopy = async () => {
    if (message.text && !message.isLoading) {
      await navigator.clipboard.writeText(message.text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className=''>
{!message.isLoading && (
  <div className='flex items-start gap-3  group'>
      <div className={cn(
        'w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full order-1 shadow-sm transition-all duration-300 flex-shrink-0',
        'bg-gradient-to-r from-[#DBE2EF] to-[#F9F7F7] border-2 border-[#3F72AF]/20',
        'hover:shadow-md hover:scale-110 transform',
      )}>
          {!isOptimistic && !message.isLoading && <Bot className='w-4 h-4 sm:w-5 sm:h-5 text-[#3F72AF]' />}
      </div>
  
      <div className="flex flex-col space-y-2 max-w-[85%] sm:max-w-[75%] md:max-w-[70%] order-2 items-start">
        
        <div 
          className={cn(
            'px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm transition-all duration-300 relative overflow-hidden',
            'bg-white/80 backdrop-blur-sm border border-[#DBE2EF]/50 text-[#112D4E]',
            'hover:shadow-md hover:bg-white/90 transform'
          )}
        >
          {/* Background Pattern */}
          <div className='absolute inset-0 bg-gradient-to-br from-[#F9F7F7]/50 to-transparent opacity-50'></div>
          
          {/* Content */}
          <div className='relative z-10'>
            {
              typeof(message.text) === 'string' ? (
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown 
                  components={{
                    p: ({ children }) => <p className="text-[#112D4E] leading-relaxed mb-2 last:mb-0">{children}</p>,
                    strong: ({ children }) => <strong className="text-[#112D4E] font-semibold">{children}</strong>,
                    em: ({ children }) => <em className="text-[#3F72AF] italic">{children}</em>,
                    code: ({ children }) => (
                      <code className="bg-[#DBE2EF] text-[#112D4E] px-1.5 py-0.5 rounded text-xs font-mono">
                        {children}
                      </code>
                    ),
                    pre: ({ children }) => (
                      <pre className="bg-[#112D4E] text-[#F9F7F7] p-3 rounded-lg overflow-x-auto text-sm font-mono">
                        {children}
                      </pre>
                    ),
                  }}
                >
                  {message.text}
                </ReactMarkdown>
              </div>
            ) : (
              message.text
            )
            }
          </div>

          {/* Decorative Corner */}
          <div className='absolute -bottom-1 -left-1 w-4 h-4 bg-gradient-to-tr from-transparent to-[#DBE2EF]/20 rounded-br-2xl'></div>
        </div>


        {!message.isLoading && (
          <div className={cn(
            'flex items-center gap-3 text-xs text-[#3F72AF]/70 transition-opacity duration-300',
            'opacity-0 group-hover:opacity-100'
          )}>
            <span>{formatTime(message.createdAt)}</span>
            
            {/* Copy Button */}
            <button
              onClick={handleCopy}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-md transition-all duration-200',
                'hover:bg-[#DBE2EF]/30 hover:text-[#3F72AF]',
                {
                  'text-green-600': copied,
                  'text-[#3F72AF]/70': !copied
                }
              )}
            >
              {copied ? (
                <>
                  <Check className='h-3 w-3' />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className='h-3 w-3' />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
      </div>)
}
    </div>
  )
}

export default AIMessage