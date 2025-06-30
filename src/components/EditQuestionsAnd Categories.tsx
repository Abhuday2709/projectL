// components/EditQuestionsAndCategories.tsx
import { CategoryType, QuestionType } from "@/lib/utils"
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
  const [isSaving, setIsSaving] = useState(false)

  const { toast } = useToast()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogType, setDialogType] = useState<"addQuestion" | "editQuestion" | null>(null)
  const [dialogValue, setDialogValue] = useState("")
  const [dialogTargetId, setDialogTargetId] = useState<string | null>(null)
  const [dialogCategoryId, setDialogCategoryId] = useState<string | null>(null)

  const openAddQuestionDialog = (categoryId: string) => {
    setDialogType("addQuestion")
    setDialogCategoryId(categoryId)
    setDialogValue("")
    setDialogOpen(true)
  }

  const openEditQuestionDialog = (questionId: string, currentText: string) => {
    setDialogType("editQuestion")
    setDialogTargetId(questionId)
    setDialogValue(currentText)
    setDialogOpen(true)
  }

  const handleDialogConfirm = () => {
    if (dialogType === "addQuestion" && dialogCategoryId) {
      if (!dialogValue.trim()) return
      const order =
        Math.max(
          0,
          ...localQuestions
            .filter((q) => q.categoryId === dialogCategoryId)
            .map((q) => q.order ?? 0)
        ) + 1
      const added = {
        evaluationQuestionId: crypto.randomUUID(),
        user_id: userId,
        categoryId: dialogCategoryId,
        text: dialogValue.trim(),
        order,
        isMaster: false,
      }
      setLocalQuestions([...localQuestions, added])
      toast({ title: "Question added", description: `Question "${dialogValue.trim()}" was added.` })
    }
    if (dialogType === "editQuestion" && dialogTargetId) {
      setLocalQuestions(
        localQuestions.map((qq) =>
          qq.evaluationQuestionId === dialogTargetId ? { ...qq, text: dialogValue.trim() } : qq
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

  const handleDeleteQuestion = async (questionId: string) => {
    setLocalQuestions(localQuestions.filter((qq) => qq.evaluationQuestionId !== questionId))
  }

  const handleQualificationCutoffChange = (categoryId: string, newCutoff: number) => {
    setLocalCategories(
      localCategories.map((cat) =>
        cat.categoryId === categoryId
          ? { ...cat, qualificationCutoff: newCutoff }
          : cat
      )
    )
  }

  const handleReviewAndConfirm = async () => {
    setIsSaving(true)

    // Questions diff
    const originalQIds = new Set(questions.map((q) => q.evaluationQuestionId))
    const localQIds = new Set(localQuestions.map((q) => q.evaluationQuestionId))

    const addedQs = localQuestions.filter((q) => !originalQIds.has(q.evaluationQuestionId))
    const deletedQs = questions.filter((q) => !localQIds.has(q.evaluationQuestionId))
    const updatedQs = localQuestions.filter((q) => {
      const orig = questions.find((o) => o.evaluationQuestionId === q.evaluationQuestionId)
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
            userId,
            order: q.order,
            categoryId: q.categoryId,
            questionText: q.text,
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
            userId,
            evaluationQuestionId: q.evaluationQuestionId,
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
            userId,
            evaluationQuestionId: q.evaluationQuestionId,
            questionText: q.text,
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
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            order: cat.order,
            categoryId: cat.categoryId,
            categoryName: cat.categoryName,
            qualificationCutoff: cat.qualificationCutoff,
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
    <div className="space-y-6 min-w-[500px] p-6 bg-gradient-to-br from-[#F9F7F7] to-[#DBE2EF] min-h-screen">
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
                    value={cat.qualificationCutoff || 50}
                    onChange={(e) => handleQualificationCutoffChange(cat.categoryId, parseInt(e.target.value) || 0)}
                    className="w-24 border-[#3F72AF] focus:border-[#112D4E] focus:ring-[#112D4E]"
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
                <div key={q.evaluationQuestionId} className="bg-[#F9F7F7] p-4 rounded-lg border border-[#DBE2EF] hover:bg-white transition-colors duration-200">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <span className="text-xs text-[#3F72AF] font-medium">Q{index + 1}</span>
                      <p className="text-[#112D4E] mt-1">{q.text}</p>
                    </div>
                    <div className="flex space-x-2 ml-4">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => openEditQuestionDialog(q.evaluationQuestionId, q.text)}
                        className="border-[#3F72AF] text-[#3F72AF] hover:bg-[#3F72AF] hover=text-[#112D4E] transition-colors duration-200"
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteQuestion(q.evaluationQuestionId)}
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
          disabled={isSaving}
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
