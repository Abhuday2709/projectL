// components/EditQuestionsAndCategories.tsx
import { CategoryType, QuestionType } from "@/lib/utils"
import { useState } from "react"
import { Button } from "./ui/button"
import { trpc } from "@/app/_trpc/client";

export default function EditQuestionsAndCategories({
  userId,
  categories,
  questions,
  onClose,
}: {
  userId: string
  categories: CategoryType[]
  questions: QuestionType[]
  onClose: () => void
}) {
  // Local state clones
  const [localCategories, setLocalCategories] = useState<CategoryType[]>([...categories])
  const [localQuestions, setLocalQuestions] = useState<QuestionType[]>([...questions])
  const [isSaving, setIsSaving] = useState(false);

  const createCategory = trpc.category.createCategory.useMutation();
  const deleteCategory = trpc.category.deleteCategory.useMutation();
  const updateCategoryName = trpc.category.updateCategoryName.useMutation();

  const createQuestion = trpc.question.createQuestion.useMutation();
  const deleteQuestion = trpc.question.deleteQuestion.useMutation();
  const editQuestion = trpc.question.updateQuestion.useMutation();

  // Handlers for categories
  const handleAddCategory = async () => {
    const newCatName = prompt("Enter new category name:")
    if (!newCatName) return
    const order = localCategories.length + 1
    const newCat = {
      categoryId: crypto.randomUUID(),
      categoryName: newCatName,
      user_id: userId,
      order,
      isMaster: false,
    }
    setLocalCategories([...localCategories, newCat])
  }

  const handleEditCategory = async (catId: string) => {
    const cat = localCategories.find((c) => c.categoryId === catId);
    const newName = prompt("New name for category:", cat?.categoryName);
    if (!newName || newName === cat?.categoryName) return;
    setLocalCategories(
      localCategories.map((c) => (c.categoryId === catId ? { ...c, categoryName: newName } : c))
    );
  };

  const handleDeleteCategory = async (catId: string) => {
    if (localCategories.length <= 2) {
      alert("You must have at least 2 categories.");
      return;
    }
    setLocalCategories(localCategories.filter((c) => c.categoryId !== catId));
    setLocalQuestions(localQuestions.filter((q) => q.categoryId !== catId));
  };

  // Handlers for questions
  const handleAddQuestion = async (categoryId: string) => {
    const newQ = prompt("Enter new question text:");
    if (!newQ) return;
    const order =
      Math.max(
        0,
        ...localQuestions
          .filter((q) => q.categoryId === categoryId)
          .map((q) => q.order ?? 0)
      ) + 1;
    const added = {
      evaluationQuestionId: crypto.randomUUID(),
      user_id: userId,
      categoryId,
      text: newQ,
      order,
      isMaster: false,
    }
    setLocalQuestions([...localQuestions, added]);
  };

  const handleEditQuestion = async (questionId: string) => {
    const q = localQuestions.find((qq) => qq.evaluationQuestionId === questionId);
    const newText = prompt("Edit question text:", q?.text);
    if (!newText || newText === q?.text) return;
    //await editQuestion.mutateAsync({ userId, questionId, questionText: newText });
    setLocalQuestions(
      localQuestions.map((qq) =>
        qq.evaluationQuestionId === questionId ? { ...qq, text: newText } : qq
      )
    );
  };

  const handleDeleteQuestion = async (questionId: string) => {
    setLocalQuestions(localQuestions.filter((qq) => qq.evaluationQuestionId !== questionId));
  };

  const handleReviewAndConfirm = async () => {
    setIsSaving(true);

    // Categories
    const originalCatIds = new Set(categories.map((c) => c.categoryId));
    const localCatIds = new Set(localCategories.map((c) => c.categoryId));

    // Added categories
    const addedCats = localCategories.filter((c) => !originalCatIds.has(c.categoryId));
    console.log("Added categories:", addedCats);
    
    // Deleted categories
    const deletedCats = categories.filter((c) => !localCatIds.has(c.categoryId));
    console.log("Deleted categories:", deletedCats);
    // Updated categories
    const updatedCats = localCategories.filter((c) => {
      const orig = categories.find((o) => o.categoryId === c.categoryId);
      return orig && orig.categoryName !== c.categoryName;
    });
    console.log("Updated categories:", updatedCats);
    

    // Questions
    const originalQIds = new Set(questions.map((q) => q.evaluationQuestionId));
    const localQIds = new Set(localQuestions.map((q) => q.evaluationQuestionId));

    // Added questions
    const addedQs = localQuestions.filter((q) => !originalQIds.has(q.evaluationQuestionId));
    console.log("Added questions:", addedQs);
    // Deleted questions
    const deletedQs = questions.filter((q) => !localQIds.has(q.evaluationQuestionId));

    console.log("Deleted questions:", deletedQs);
    // Updated questions
    const updatedQs = localQuestions.filter((q) => {
      const orig = questions.find((o) => o.evaluationQuestionId === q.evaluationQuestionId);
      return orig && orig.text !== q.text;
    });
    console.log("Updated questions:", updatedQs);

    try {
      // Categories
      for (const cat of addedCats) {
        await createCategory.mutateAsync({
          userId,
          categoryName: cat.categoryName,
          order: cat.order,
        });
      }
      for (const cat of deletedCats) {
        await deleteCategory.mutateAsync({
          userId,
          order: cat.order,
          categoryId: cat.categoryId,
        });
      }
      for (const cat of updatedCats) {
        await updateCategoryName.mutateAsync({
          userId,
          order: cat.order,
          categoryId: cat.categoryId,
          categoryName: cat.categoryName,
        });
      }

      // Questions
      for (const q of addedQs) {
        await createQuestion.mutateAsync({
          userId,
          categoryId: q.categoryId,
          questionText: q.text,
          order: q.order,
        });
      }
      for (const q of deletedQs) {
        await deleteQuestion.mutateAsync({
          userId,
          evaluationQuestionId: q.evaluationQuestionId,
        });
      }
      for (const q of updatedQs) {
        await editQuestion.mutateAsync({
          userId,
          evaluationQuestionId: q.evaluationQuestionId,
          questionText: q.text,
        });
      }

      onClose();
    } catch (err) {
      alert("Failed to save changes: " + (err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4 min-w-[400px]">
      {localCategories.map((cat) => (
        <div key={cat.categoryId} className="border p-2 rounded">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-medium">{cat.categoryName}</h3>
            <div className="space-x-2">
              <Button size="sm" onClick={() => handleEditCategory(cat.categoryId)}>
                Rename
              </Button>
              <Button size="sm" variant="destructive" onClick={() => handleDeleteCategory(cat.categoryId)}>
                Delete
              </Button>
              <Button size="sm" onClick={() => handleAddQuestion(cat.categoryId)}>
                Add Question
              </Button>
            </div>
          </div>
          <ul className="space-y-1">
            {localQuestions
              .filter((q) => q.categoryId === cat.categoryId)
              .map((q) => (
                <li key={q.evaluationQuestionId} className="flex justify-between items-center">
                  <span>{q.text}</span>
                  <div className="space-x-2">
                    <Button size="sm" onClick={() => handleEditQuestion(q.evaluationQuestionId)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteQuestion(q.evaluationQuestionId)}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
          </ul>
        </div>
      ))}

      <div className="flex justify-between mt-4">
        <Button onClick={handleAddCategory}>+ Add Category</Button>
        <Button variant="secondary" onClick={handleReviewAndConfirm}>
          Review & Confirm
        </Button>
      </div>
    </div>
  )
}
