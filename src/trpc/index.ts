
import { awsRouter } from './aws';
import { chatRouter } from './chat';
import { documentsRouter } from './documents';
import { messagesRouter } from './message';
import { getAiResponseProcedure } from './procedures/ai/getAiResponse';
import { router } from './trpc';
import { userRouter } from './user';
export const appRouter = router({
    chat: chatRouter,
    user: userRouter,
    aws: awsRouter,
    documents: documentsRouter,
    messages: messagesRouter,
    getAiResponse: getAiResponseProcedure,
});
// export type definition of API
export type AppRouter = typeof appRouter;