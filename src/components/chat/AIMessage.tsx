import { Message as IMessage } from '../../../models/messageModel'
import { cn } from '@/lib/utils'
import { Sparkles } from 'lucide-react'

interface AIMessageProps {
  message: IMessage
  isOptimistic?: boolean
}

function AIMessage({ message, isOptimistic }: AIMessageProps) {
  return (
    <div
      className={cn('flex items-end gap-2 p-4', {
        'opacity-100': !message.isLoading && !isOptimistic,
        'opacity-75': isOptimistic,
        'opacity-50': message.isLoading && !isOptimistic,
      })}
    >
      <div className="flex flex-col space-y-2 text-sm max-w-[60%] mx-2 order-2 items-start">
        <div className="px-4 py-2 rounded-lg flex items-center gap-2 bg-gray-200 text-gray-900 min-h-[40px]">
          {message.isLoading ? (
            <div className="flex space-x-1 min-w-[60px]">
              <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          ) : (
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: message.text }}
            />
          )}
        </div>
      </div>

      <div className="w-6 h-6 flex items-center justify-center rounded-full order-1 bg-yellow-400 text-white">
        <Sparkles className="w-5 h-5" />
      </div>
    </div>
  )
}

export default AIMessage 