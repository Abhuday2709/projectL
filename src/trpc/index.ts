
import { awsRouter } from './aws';
import { router } from './trpc';
export const appRouter = router({
    aws: awsRouter
});
// export type definition of API
export type AppRouter = typeof appRouter;