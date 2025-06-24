import { router } from './trpc';
import { getCategoriesProcedure } from './procedures/category/getCategory';
import { updateCategoryNameProcedure } from './procedures/category/updateCategoryName';

export const categoryRouter = router({
    getCategories: getCategoriesProcedure,
    updateCategoryName: updateCategoryNameProcedure,
});