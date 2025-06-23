import { router } from './trpc';
import { createReviewProcedure } from './procedures/review/createReview';
import { deleteReviewProcedure } from './procedures/review/deleteReview';
import { getReviewsProcedure } from './procedures/review/getReviews';
// import { getReviewByIdProcedure } from './procedures/review/getReviewById';

export const reviewRouter = router({
    createReview: createReviewProcedure,
    deleteReview: deleteReviewProcedure,
    getReviews: getReviewsProcedure,
    // getReviewById: getReviewByIdProcedure,
});