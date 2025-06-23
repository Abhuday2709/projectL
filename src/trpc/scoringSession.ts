import { router } from './trpc';
import { getScoringSessionProcedure } from './procedures/scoringSession/getScoringSession';

export const scoringSessionRouter = router({
    getScoringSession: getScoringSessionProcedure,
});