import { Message as IMessage } from '@/models/messageModel'
import UserMessage from './UserMessage'
import AIMessage from './AIMessage'

interface MessageProps {
  message: IMessage
  isOptimistic?: boolean
}

function Message({ message, isOptimistic }: MessageProps) {
  if (message.isUserMessage) {
    return <UserMessage message={message} isOptimistic={isOptimistic} />
  }

  return <AIMessage message={message} isOptimistic={isOptimistic} />
}

export default Message