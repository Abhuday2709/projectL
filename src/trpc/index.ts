
import { awsRouter } from './aws';
import { chatRouter } from './chat';
import { documentsRouter } from './documents';
import { reviewRouter } from './reviews';
import { shareSessionRouter } from './shareSession';
import { router } from './trpc';
export const appRouter = router({
    chat: chatRouter,
    aws: awsRouter,
    documents: documentsRouter,
    review:reviewRouter,
    shareSession:shareSessionRouter
});
// export type definition of API
export type AppRouter = typeof appRouter;