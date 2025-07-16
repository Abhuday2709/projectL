import { Message as IMessage } from '@/models/messageModel'
import { cn } from '@/lib/utils'
import { User, Check, Clock } from 'lucide-react'
/**
 * IMessage
 * --------
 * Type alias for a Message object imported from '@/models/messageModel'.
 *
 * @typedef {import('@/models/messageModel').Message} IMessage
 * @see {@link '@/models/messageModel'}
 */
/**
 * UserMessageProps
 * ----------------
 * Props for the UserMessage component.
 *
 * @property {IMessage} message                     – the message data to render
 * @property {boolean} [isNextMessageSamePerson]    – whether the next message in the thread is from the same sender (affects opacity and icon)
 */

interface UserMessageProps {
  message: IMessage
  isNextMessageSamePerson?: boolean
}
/**
 * UserMessage
 * -----------
 * Renders a single user message bubble with an avatar, text content, timestamp, and status icon.
 *
 * @param {UserMessageProps} props
 * @param {IMessage} props.message                    – the message object (contains `text` and `createdAt`)
 * @param {boolean} [props.isNextMessageSamePerson]   – if true, renders a clock icon and lower opacity
 * @returns {JSX.Element}                             – the rendered React component
 */
function UserMessage({ message, isNextMessageSamePerson }: UserMessageProps) {
  /**
   * formatTime
   * ----------
   * Formats an ISO date string into a human-readable 'HH:MM' local time.
   *
   * @param {string} dateString   – an ISO 8601 date-time string
   * @returns {string}            – formatted local time, e.g. "10:15"
   * @example
   * formatTime("2025-07-16T10:15:00Z"); // "10:15"
   */
  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className='flex items-start gap-3 justify-end group'>
      {/* Message Content */}
      <div className="flex flex-col max-w-[85%] sm:max-w-[70%] md:max-w-[60%] order-1 items-end">
        {/* Message Bubble */}
        <div
          className={cn(
            'px-4 py-3 rounded-2xl rounded-tr-sm shadow-sm transition-all duration-300 relative overflow-hidden',
            'bg-gradient-to-r from-[#3F72AF] to-[#112D4E] text-white',
            'hover:shadow-md hover:scale-[1.02] transform',
            {
              'opacity-70': isNextMessageSamePerson,
              'opacity-100': !isNextMessageSamePerson
            }
          )}
        >
          {/* Background Pattern */}
          <div className='absolute inset-0 bg-white/5 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.1)_1px,transparent_0)] bg-[length:20px_20px] opacity-30'></div>

          {/* Message Text */}
          <div className='relative z-10'>
            <p className='text-sm leading-relaxed break-words whitespace-pre-wrap'>
              {message.text}
            </p>
          </div>

          {/* Decorative Corner */}
          <div className='absolute -bottom-1 -right-1 w-4 h-4 bg-gradient-to-br from-transparent to-white/10 rounded-tl-2xl'></div>
        </div>

        {/* Message Info */}
        <div className={cn(
          'flex items-center gap-2 text-xs text-[#3F72AF]/70 transition-opacity duration-300',
          'opacity-0 group-hover:opacity-100'
        )}>
          <span>{formatTime(message.createdAt)}</span>
          {isNextMessageSamePerson ? (
            <Clock className='h-3 w-3' />
          ) : (
            <Check className='h-3 w-3' />
          )}
        </div>
      </div>

      {/* User Avatar */}
      <div className={cn(
        'w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full order-2 shadow-sm transition-all duration-300',
        'bg-gradient-to-r from-[#3F72AF] to-[#112D4E] text-white',
        'hover:shadow-md hover:scale-110 transform',
      )}>
        <User className='w-4 h-4 sm:w-5 sm:h-5' />
      </div>
    </div>
  )
}

export default UserMessage