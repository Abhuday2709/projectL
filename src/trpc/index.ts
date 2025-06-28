
import { awsRouter } from './aws';
import { documentsRouter } from './documents';
import { router } from './trpc';
export const appRouter = router({
    aws: awsRouter,
    documents: documentsRouter
});
// export type definition of API
export type AppRouter = typeof appRouter;