// components/EditQuestionsAndCategories.tsx
import { CategoryType, QuestionType } from "@/lib/utils"
import { useState } from "react"
import { Button } from "./ui/button"
import { trpc } from "@/app/_trpc/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

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

  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<"addCategory" | "editCategory" | "addQuestion" | "editQuestion" | null>(null);
  const [dialogValue, setDialogValue] = useState("");
  const [dialogTargetId, setDialogTargetId] = useState<string | null>(null);
  const [dialogCategoryId, setDialogCategoryId] = useState<string | null>(null);

  const openAddCategoryDialog = () => {
    setDialogType("addCategory");
    setDialogValue("");
    setDialogOpen(true);
  };

  const openEditCategoryDialog = (catId: string, currentName: string) => {
    setDialogType("editCategory");
    setDialogTargetId(catId);
    setDialogValue(currentName);
    setDialogOpen(true);
  };

  const openAddQuestionDialog = (categoryId: string) => {
    setDialogType("addQuestion");
    setDialogCategoryId(categoryId);
    setDialogValue("");
    setDialogOpen(true);
  };

  const openEditQuestionDialog = (questionId: string, currentText: string) => {
    setDialogType("editQuestion");
    setDialogTargetId(questionId);
    setDialogValue(currentText);
    setDialogOpen(true);
  };

  const handleDialogConfirm = () => {
    if (dialogType === "addCategory") {
      if (!dialogValue.trim()) return;
      const order = localCategories.length + 1;
      const newCat = {
        categoryId: crypto.randomUUID(),
        categoryName: dialogValue.trim(),
        user_id: userId,
        order,
        isMaster: false,
      };
      setLocalCategories([...localCategories, newCat]);
      toast({ title: "Category added", description: `Category "${dialogValue.trim()}" was added.` });
    }
    if (dialogType === "editCategory" && dialogTargetId) {
      setLocalCategories(
        localCategories.map((c) =>
          c.categoryId === dialogTargetId ? { ...c, categoryName: dialogValue.trim() } : c
        )
      );
      toast({ title: "Category renamed", description: `Category renamed to "${dialogValue.trim()}".` });
    }
    if (dialogType === "addQuestion" && dialogCategoryId) {
      if (!dialogValue.trim()) return;
      const order =
        Math.max(
          0,
          ...localQuestions
            .filter((q) => q.categoryId === dialogCategoryId)
            .map((q) => q.order ?? 0)
        ) + 1;
      const added = {
        evaluationQuestionId: crypto.randomUUID(),
        user_id: userId,
        categoryId: dialogCategoryId,
        text: dialogValue.trim(),
        order,
        isMaster: false,
      };
      setLocalQuestions([...localQuestions, added]);
      toast({ title: "Question added", description: `Question "${dialogValue.trim()}" was added.` });
    }
    if (dialogType === "editQuestion" && dialogTargetId) {
      setLocalQuestions(
        localQuestions.map((qq) =>
          qq.evaluationQuestionId === dialogTargetId ? { ...qq, text: dialogValue.trim() } : qq
        )
      );
      toast({ title: "Question edited", description: `Question updated to "${dialogValue.trim()}".` });
    }
    setDialogOpen(false);
    setDialogType(null);
    setDialogValue("");
    setDialogTargetId(null);
    setDialogCategoryId(null);
  };

  const handleDeleteCategory = async (catId: string) => {
    if (localCategories.length <= 2) {
      toast({
        title: "Cannot delete",
        description: "You must have at least 2 categories.",
        variant: "destructive",
      });
      return;
    }
    setLocalCategories(localCategories.filter((c) => c.categoryId !== catId));
    setLocalQuestions(localQuestions.filter((q) => q.categoryId !== catId));
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
    // console.log("Added categories:", addedCats);

    // Deleted categories
    const deletedCats = categories.filter((c) => !localCatIds.has(c.categoryId));
    // console.log("Deleted categories:", deletedCats);
    // Updated categories
    const updatedCats = localCategories.filter((c) => {
      const orig = categories.find((o) => o.categoryId === c.categoryId);
      return orig && orig.categoryName !== c.categoryName;
    });
    // console.log("Updated categories:", updatedCats);


    // Questions
    const originalQIds = new Set(questions.map((q) => q.evaluationQuestionId));
    const localQIds = new Set(localQuestions.map((q) => q.evaluationQuestionId));

    // Added questions
    const addedQs = localQuestions.filter((q) => !originalQIds.has(q.evaluationQuestionId));
    // console.log("Added questions:", addedQs);
    // Deleted questions
    const deletedQs = questions.filter((q) => !localQIds.has(q.evaluationQuestionId));

    // console.log("Deleted questions:", deletedQs);
    // Updated questions
    const updatedQs = localQuestions.filter((q) => {
      const orig = questions.find((o) => o.evaluationQuestionId === q.evaluationQuestionId);
      return orig && orig.text !== q.text;
    });
    // console.log("Updated questions:", updatedQs);

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
      toast({ title: "Changes saved", description: "Your changes have been saved successfully." });
    } catch (err) {
      toast({
        title: "Failed to save changes",
        description: (err as Error).message,
        variant: "destructive",
      });
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
              <Button size="sm" onClick={() => openEditCategoryDialog(cat.categoryId, cat.categoryName)}>Rename</Button>
              <Button size="sm" variant="destructive" onClick={() => handleDeleteCategory(cat.categoryId)}>
                Delete
              </Button>
              <Button size="sm" onClick={() => openAddQuestionDialog(cat.categoryId)}>Add Question</Button>
            </div>
          </div>
          <ul className="space-y-1">
            {localQuestions
              .filter((q) => q.categoryId === cat.categoryId)
              .map((q) => (
                <li key={q.evaluationQuestionId} className="flex justify-between items-center">
                  <span>{q.text}</span>
                  <div className="space-x-2">
                    <Button size="sm" onClick={() => openEditQuestionDialog(q.evaluationQuestionId, q.text)}>Edit</Button>
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
        <Button onClick={openAddCategoryDialog}>+ Add Category</Button>
        <Button variant="secondary" onClick={handleReviewAndConfirm}>
          Review & Confirm
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogType === "addCategory" && "Add Category"}
              {dialogType === "editCategory" && "Rename Category"}
              {dialogType === "addQuestion" && "Add Question"}
              {dialogType === "editQuestion" && "Edit Question"}
            </DialogTitle>
            <DialogDescription>
              {dialogType === "addCategory" && "Enter the new category name."}
              {dialogType === "editCategory" && "Enter the new name for the category."}
              {dialogType === "addQuestion" && "Enter the new question text."}
              {dialogType === "editQuestion" && "Edit the question text."}
            </DialogDescription>
          </DialogHeader>
          <Input
            value={dialogValue}
            onChange={(e) => setDialogValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleDialogConfirm();
            }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleDialogConfirm}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}