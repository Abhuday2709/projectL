
import { awsRouter } from './aws';
import { chatRouter } from './chat';
import { documentsRouter } from './documents';
import { router } from './trpc';
export const appRouter = router({
    chat: chatRouter,
    aws: awsRouter,
    documents: documentsRouter
});
// export type definition of API
export type AppRouter = typeof appRouter;