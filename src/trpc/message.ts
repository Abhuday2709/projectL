import { router } from './trpc';
import { type Message } from '../../models/messageModel';
import { listMessagesProcedure } from './procedures/message/listMessages';
import { saveUserMessageProcedure } from './procedures/message/saveUserMessage';
import { addMessageProcedure } from './procedures/message/addMessage';

export interface MessagesResponse {
  items: Message[];
  nextCursor?: string;
}

export const messagesRouter = router({
  list: listMessagesProcedure,
  saveUserMessage: saveUserMessageProcedure,
  add: addMessageProcedure
});