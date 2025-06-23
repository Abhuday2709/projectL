import { Message as IMessage } from '../../../models/messageModel'
import { cn } from '@/lib/utils'

interface UserMessageProps {
  message: IMessage
  isOptimistic?: boolean
}

function UserMessage({ message, isOptimistic }: UserMessageProps) {
  return (
    <div
      className={cn('flex items-end gap-2 p-4 justify-end', {
        'opacity-100': isOptimistic
      })}
    >
      <div className="flex flex-col space-y-2 text-sm w-[50%] mx-2 order-1 items-end">
        <div className="px-4 py-2 rounded-lg flex items-center gap-2 bg-blue-600 text-white">
          {message.text}
        </div>
      </div>

      <div className="w-6 h-6 flex items-center justify-center rounded-full order-2 bg-blue-600 text-white">
        <svg
          className='w-full h-full'
          viewBox='0 0 24 24'
          fill='currentColor'
        >
          <path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' />
        </svg>
      </div>
    </div>
  )
}

export default UserMessage 