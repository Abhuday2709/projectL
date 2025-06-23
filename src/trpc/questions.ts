import { router } from './trpc';
import {getQuestionsProcedure } from './procedures/question/getQuestion';
import { createQuestionProcedure } from './procedures/question/createQuestion';
import { deleteQuestionProcedure } from './procedures/question/deleteQuestion';
import { editQuestionProcedure } from './procedures/question/editQuestion';

export const questionsRouter = router({
    getQuestions: getQuestionsProcedure,
    createQuestion: createQuestionProcedure,
    deleteQuestion: deleteQuestionProcedure, // Assuming deleteQuestionProcedure is similar to createQuestion
    updateQuestion: editQuestionProcedure, // Assuming updateQuestionProcedure is similar to createQuestion
});