
import { awsRouter } from './aws';
import { categoryRouter } from './categories';
import { chatRouter } from './chat';
import { documentsRouter } from './documents';
import { messagesRouter } from './message';
import { getAiResponseProcedure } from './procedures/ai/getAiResponse';
import { questionsRouter } from './questions';
import { reviewRouter } from './reviews';
import { scoringSessionRouter } from './scoringSession';
import { router } from './trpc';
import { userRouter } from './user';
export const appRouter = router({
    chat: chatRouter,
    user: userRouter,
    aws: awsRouter,
    documents: documentsRouter,
    messages: messagesRouter,
    getAiResponse: getAiResponseProcedure,
    review:reviewRouter,
    category:categoryRouter,
    question:questionsRouter,
    scoringSession: scoringSessionRouter
});
// export type definition of API
export type AppRouter = typeof appRouter;