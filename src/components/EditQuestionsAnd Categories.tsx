// components/EditQuestionsAndCategories.tsx
import { QuestionType } from "@/lib/utils"
import { useState } from "react"
import { Button } from "./ui/button"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Category } from "@/models/categoryModel"

/**
 * EditQuestionsAndCategories React component to edit evaluation questions and category settings.
 *
 * @param {Object} props - The component props.
 * @param {string} props.userId - The ID of the user.
 * @param {Category[]} props.categories - Array of category objects.
 * @param {QuestionType[]} props.questions - Array of question objects.
 * @param {() => void} props.onClose - Callback when closing the dialog.
 *
 * @returns {JSX.Element} A React component rendering the editing interface.
 *
 * @example
 * <EditQuestionsAndCategories userId="123" categories={categories} questions={questions} onClose={() => {}} />
 */
export default function EditQuestionsAndCategories({
  userId,
  categories,
  questions,
  onClose,
}: {
  userId: string
  categories: Category[]
  questions: QuestionType[]
  onClose: () => void
}) {
  // Local state clones
  const [localCategories, setLocalCategories] = useState<Category[]>([...categories])
  const [localQuestions, setLocalQuestions] = useState<QuestionType[]>([...questions])
  const [isSaving, setIsSaving] = useState(false)

  const { toast } = useToast()
  const [invalidCutoffs, setInvalidCutoffs] = useState<Record<string, boolean>>({})
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogType, setDialogType] = useState<"addQuestion" | "editQuestion" | null>(null)
  const [dialogValue, setDialogValue] = useState("")
  const [dialogTargetId, setDialogTargetId] = useState<string | null>(null)
  const [dialogCategoryId, setDialogCategoryId] = useState<string | null>(null)
  /**
   * Opens the dialog for adding a new question.
   *
   * @param {string} categoryId - The category identifier to which the question will be added.
   *
   * @example
   * openAddQuestionDialog("cat-123");
   */
  const openAddQuestionDialog = (categoryId: string) => {
    setDialogType("addQuestion")
    setDialogCategoryId(categoryId)
    setDialogValue("")
    setDialogOpen(true)
  }
  /**
   * Opens the dialog for editing an existing question.
   *
   * @param {string} questionId - The identifier of the question to edit.
   * @param {string} currentText - The current text of the question.
   *
   * @example
   * openEditQuestionDialog("q-123", "Current question text");
   */
  const openEditQuestionDialog = (questionId: string, currentText: string) => {
    setDialogType("editQuestion")
    setDialogTargetId(questionId)
    setDialogValue(currentText)
    setDialogOpen(true)
  }
  /**
   * Handles the confirmation for both adding and editing a question.
   *
   * Side effects: Updates localQuestions state and shows a toast notification.
   *
   * @example
   * handleDialogConfirm();
   */
  const handleDialogConfirm = () => {
    if (dialogType === "addQuestion" && dialogCategoryId) {
      if (!dialogValue.trim()) return
      const added = {
        questionId: crypto.randomUUID(),
        user_id: userId,
        categoryId: dialogCategoryId,
        text: dialogValue.trim(),
        uploadedAt: new Date().toISOString(),
      }
      setLocalQuestions([...localQuestions, added])
      toast({ title: "Question added", description: `Question "${dialogValue.trim()}" was added.` })
    }
    if (dialogType === "editQuestion" && dialogTargetId) {
      setLocalQuestions(
        localQuestions.map((qq) =>
          qq.questionId === dialogTargetId ? { ...qq, text: dialogValue.trim() } : qq
        )
      )
      toast({ title: "Question edited", description: `Question updated to "${dialogValue.trim()}".` })
    }
    setDialogOpen(false)
    setDialogType(null)
    setDialogValue("")
    setDialogTargetId(null)
    setDialogCategoryId(null)
  }
  /**
   * Deletes a question from the local state.
   *
   * @param {string} questionId - The identifier of the question to delete.
   *
   * @example
   * handleDeleteQuestion("q-123");
   */
  const handleDeleteQuestion = async (questionId: string) => {
    setLocalQuestions(localQuestions.filter((qq) => qq.questionId !== questionId))
  }
  /**
   * Updates the qualification cutoff for a given category.
   *
   * @param {string} categoryId - The identifier of the category.
   * @param {number} newCutoff - The new qualification cutoff value.
   *
   * @example
   * handleQualificationCutoffChange("cat-123", 60);
   */
  const handleQualificationCutoffChange = (categoryId: string, newCutoff: number) => {

    const isValid = newCutoff >= 0 && newCutoff <= 100
    setInvalidCutoffs(prev => ({ ...prev, [categoryId]: !isValid }))
    setLocalCategories(
      localCategories.map((cat) =>
        cat.categoryId === categoryId
          ? { ...cat, qualificationCutoff: newCutoff }
          : cat
      )
    )
  }
  /**
   * Reviews the local changes and synchronizes them with the backend via API calls.
   *
   * Side effects: Sends POST, DELETE, and PUT requests; shows toast notifications.
   *
   * @example
   * handleReviewAndConfirm();
   */
  const handleReviewAndConfirm = async () => {
    setIsSaving(true)

    // Questions diff
    const originalQIds = new Set(questions.map((q) => q.questionId))
    const localQIds = new Set(localQuestions.map((q) => q.questionId))

    const addedQs = localQuestions.filter((q) => !originalQIds.has(q.questionId))
    const deletedQs = questions.filter((q) => !localQIds.has(q.questionId))
    const updatedQs = localQuestions.filter((q) => {
      const orig = questions.find((o) => o.questionId === q.questionId)
      return orig && orig.text !== q.text
    })

    // Categories diff
    const updatedCategories = localCategories.filter((cat) => {
      const orig = categories.find((o) => o.categoryId === cat.categoryId)
      return orig && orig.qualificationCutoff !== cat.qualificationCutoff
    })

    try {
      for (const q of addedQs) {
        const res = await fetch(`/api/evaluation-questions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categoryId: q.categoryId,
            text: q.text,
            uploadedAt: q.uploadedAt || new Date().toISOString(),
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || "adding questions failed")
        }
      }
      for (const q of deletedQs) {
        const res = await fetch(`/api/evaluation-questions`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId: q.questionId,
            uploadedAt: q.uploadedAt || new Date().toISOString(),
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || "deleting questions failed")
        }
      }
      for (const q of updatedQs) {
        const res = await fetch(`/api/evaluation-questions`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId: q.questionId,
            text: q.text,
            uploadedAt: q.uploadedAt
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || "updating questions failed")
        }
      }

      // Sync Categories via Next.js API
      for (const cat of updatedCategories) {
        const res = await fetch(`/api/category/updateCategory`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categoryId: cat.categoryId,
            categoryName: cat.categoryName,
            qualificationCutoff: cat.qualificationCutoff,
            createdAt: cat.createdAt
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || "Category update failed")
        }
      }

      onClose()
      toast({ title: "Changes saved", description: "Your changes have been saved successfully." })
    } catch (err) {
      toast({
        title: "Failed to save changes",
        description: (err as Error).message,
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6 min-w-[500px] p-6 bg-gradient-to-br from-[#F9F7F7] to-[#DBE2EF] h-full">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-[#112D4E] mb-2">Edit Questions & Categories</h2>
        <p className="text-[#3F72AF] opacity-80">Manage your evaluation questions and category settings</p>
      </div>

      {localCategories.map((cat) => (
        <div key={cat.categoryId} className="bg-white border-2 border-[#DBE2EF] p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-[#112D4E] mb-3">{cat.categoryName}</h3>

              {/* Qualification Cutoff Section */}
              <div className="bg-[#F9F7F7] p-4 rounded-lg border border-[#DBE2EF] mb-4">
                <Label htmlFor={`cutoff-${cat.categoryId}`} className="text-sm font-medium text-[#3F72AF] mb-2 block">
                  Qualification Cutoff (%)
                </Label>
                <div className="flex items-center space-x-3">
                  <Input
                    id={`cutoff-${cat.categoryId}`}
                    type="number"
                    min="0"
                    max="100"
                    value={cat.qualificationCutoff}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10)
                      handleQualificationCutoffChange(cat.categoryId, isNaN(val) ? 0 : val)
                    }}
                    className={[
                      "w-24",
                      invalidCutoffs[cat.categoryId]
                        ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                        : "border-[#3F72AF] focus:border-[#112D4E] focus:ring-[#112D4E]",
                    ].join(" ")}
                  />
                  <span className="text-sm text-[#3F72AF]">
                    Minimum score required to qualify in this category
                  </span>
                </div>
              </div>
            </div>

            <div className="ml-4">
              <Button
                size="sm"
                onClick={() => openAddQuestionDialog(cat.categoryId)}
                className="bg-[#3F72AF] hover:bg-[#112D4E] text-white transition-colors duration-200"
              >
                Add Question
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-[#3F72AF] uppercase tracking-wide">Questions</h4>
            {localQuestions
              .filter((q) => q.categoryId === cat.categoryId)
              .map((q, index) => (
                <div key={q.questionId} className="bg-[#F9F7F7] p-4 rounded-lg border border-[#DBE2EF] hover:bg-white transition-colors duration-200">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <span className="text-xs text-[#3F72AF] font-medium">Q{index + 1}</span>
                      <p className="text-[#112D4E] mt-1">{q.text}</p>
                    </div>
                    <div className="flex space-x-2 ml-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditQuestionDialog(q.questionId, q.text)}
                        className="border-[#3F72AF] text-[#3F72AF] hover:bg-[#3F72AF] hover=text-[#112D4E] transition-colors duration-200"
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteQuestion(q.questionId)}
                        className="border-red-400 text-red-600 hover:bg-red-500 hover=text-white transition-colors duration-200"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

            {localQuestions.filter((q) => q.categoryId === cat.categoryId).length === 0 && (
              <div className="text-center py-8 text-[#3F72AF] opacity-60">
                <p>No questions in this category yet.</p>
                <p className="text-sm">Click "Add Question" to get started.</p>
              </div>
            )}
          </div>
        </div>
      ))}

      <div className="flex justify-end pt-6 border-t border-[#DBE2EF]">
        <Button
          onClick={handleReviewAndConfirm}
          disabled={isSaving||Object.values(invalidCutoffs).some(Boolean)}
          className="bg-[#112D4E] hover:bg-[#3F72AF] text-white px-8 py-2 mb-4 transition-colors duration-200"
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-white border-2 border-[#DBE2EF]">
          <DialogHeader>
            <DialogTitle className="text-[#112D4E] text-lg">
              {dialogType === "addQuestion" && "Add New Question"}
              {dialogType === "editQuestion" && "Edit Question"}
            </DialogTitle>
            <DialogDescription className="text-[#3F72AF]">
              {dialogType === "addQuestion" && "Enter the text for your new evaluation question."}
              {dialogType === "editQuestion" && "Modify the question text as needed."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={dialogValue}
              onChange={(e) => setDialogValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleDialogConfirm()
              }}
              placeholder="Enter question text..."
              className="border-[#3F72AF] focus:border-[#112D4E] focus:ring-[#112D4E]"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="border-[#DBE2EF] text-[#3F72AF] hover:bg-[#F9F7F7]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDialogConfirm}
              className="bg-[#3F72AF] hover:bg-[#112D4E] text-white"
            >
              {dialogType === "addQuestion" ? "Add Question" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
