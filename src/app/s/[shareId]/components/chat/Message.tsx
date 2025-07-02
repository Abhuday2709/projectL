import { Message as IMessage } from '@/models/messageModel'
import UserMessage from './UserMessage'
import AIMessage from './AIMessage'

interface MessageProps {
  message: IMessage
  isNextMessageSamePerson?: boolean
}

function Message({ message, isNextMessageSamePerson }: MessageProps) {
  if (message.isUserMessage) {
    return <UserMessage message={message} isNextMessageSamePerson={isNextMessageSamePerson} />
  }

  return <AIMessage message={message} isNextMessageSamePerson={isNextMessageSamePerson} />
}

export default Message