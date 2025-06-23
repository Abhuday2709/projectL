import { router } from './trpc';
import { getCategoriesProcedure } from './procedures/category/getCategory';
import { createCategoryProcedure } from './procedures/category/createCategory';
import { deleteCategoryProcedure } from './procedures/category/deleteCategory';
import { updateCategoryNameProcedure } from './procedures/category/updateCategoryName';

export const categoryRouter = router({
    getCategories: getCategoriesProcedure,
    createCategory: createCategoryProcedure,
    deleteCategory: deleteCategoryProcedure, // Assuming deleteCategoryProcedure is similar to createCategory
    updateCategoryName: updateCategoryNameProcedure, // Assuming updateCategoryProcedure is similar to createCategory
});