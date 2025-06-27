
import { awsRouter } from './aws';
import { chatRouter } from './chat';
import { documentsRouter } from './documents';
import { reviewRouter } from './reviews';
import { shareSessionRouter } from './shareSession';
import { router } from './trpc';
import { userRouter } from './user';
export const appRouter = router({
    chat: chatRouter,
    user: userRouter,
    aws: awsRouter,
    documents: documentsRouter,
    review:reviewRouter,
    shareSession:shareSessionRouter
});
// export type definition of API
export type AppRouter = typeof appRouter;