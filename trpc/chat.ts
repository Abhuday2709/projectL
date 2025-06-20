import { router } from './trpc';
import { createChatProcedure } from './procedures/chat/createChat';
import { deleteChatProcedure } from './procedures/chat/deleteChat';
import { getChatsProcedure } from './procedures/chat/getChats';
import { getChatByIdProcedure } from './procedures/chat/getChatById';

export const chatRouter = router({
    createChat: createChatProcedure,
    deleteChat: deleteChatProcedure,
    getChats: getChatsProcedure,
    getChatById: getChatByIdProcedure,
});