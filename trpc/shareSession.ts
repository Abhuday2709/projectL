import { router } from './trpc';
import { getByChatIdProcedure } from './procedures/shareSession/getByChatId';
import { updateShareSessionProcedure } from './procedures/shareSession/updateShareSession';
import { getByShareIdProcedure } from './procedures/shareSession/getByShareId';

export const shareSessionRouter = router({
    getByChatId: getByChatIdProcedure,
    updateShareSession: updateShareSessionProcedure,
    getByShareId: getByShareIdProcedure,
});