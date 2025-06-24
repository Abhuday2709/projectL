"use client"

// React and Next.js imports
import { useState, useEffect, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"

// Custom components and utilities
import Sidebar from "@/components/Sidebar"
import MaxWidthWrapper from "@/components/MaxWidthWrapper"
import UploadButton from "@/components/UploadButton"
import ResultDisplay from "@/components/ResultDisplay"

// Shadcn UI component imports
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle } from "@/components/ui/dialog"

// TRPC and data-related imports
import { trpc } from "@/app/_trpc/client"
import { Results } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@clerk/nextjs"

// AWS and Database imports
import { ScoringSession, scoringSessionConfig } from "../../../../../models/scoringReviewModel"
import { dynamoClient } from "@/lib/AWS/AWS_CLIENT"
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb"

// Icon imports
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react"

// Initialize the DynamoDB Document Client
const docClient = DynamoDBDocumentClient.from(dynamoClient)

// Define a type for the document to be deleted for better type safety
type DocumentToDelete = {
  docId: string
  s3Key: string
  uploadedAt: string
  chatId: string
}

/**
 * A page component for scoring and qualifying a document based on a set of questions.
 * It allows users to upload a document, view AI-answered questions, manually answer
 * remaining questions, and submit for a final score and recommendation.
 */
export default function DocumentScoringPage() {
  const { isLoaded, userId } = useAuth()
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()

  // Extract reviewId from URL parameters, ensuring it's a string
  const reviewId = params.reviewId as string

  // =================================================================
  // Data Fetching using tRPC
  // =================================================================
  const { data: documents = [], refetch: refetchDocuments, isLoading: isLoadingDocuments } = trpc.documents.getStatus.useQuery(
    { chatId: reviewId },
    { enabled: !!reviewId }
  )

  const { data: allCategories = [], refetch: refetchCategories } = trpc.category.getCategories.useQuery(
    userId ? { user_id: userId } : { user_id: "" },
    { enabled: !!userId }
  )

  const { data: allQuestions = [], refetch: refetchQuestions } = trpc.question.getQuestions.useQuery(
    userId ? { user_id: userId } : { user_id: "" },
    { enabled: !!userId }
  )

  const { data: scoringSessionData, refetch: refetchScoringSession } = trpc.review.getReviews.useQuery(
    userId ? { user_id: userId } : { user_id: "" },
    { enabled: !!userId && !!reviewId }
  )

  // Update the memoized active scoring session:
  const activeScoringSession: ScoringSession | undefined = useMemo(() =>
    scoringSessionData?.find((session: ScoringSession) =>
      session.user_id === userId && session.scoringSessionId === reviewId
    ),
    [scoringSessionData, userId, reviewId]
  )

  // =================================================================
  // Sorted Categories - Ability to Win first, then Attractiveness
  // =================================================================
  const sortedCategories = useMemo(() => {
    const sorted = [...allCategories].sort((a, b) => {
      // Put "Ability to Win" first
      if (a.categoryName.toLowerCase().includes('ability')) return -1;
      if (b.categoryName.toLowerCase().includes('ability')) return 1;
      // Then sort by order
      return a.order - b.order;
    });
    return sorted;
  }, [allCategories]);

  // =================================================================
  // Component State
  // =================================================================

  // State for user's answers. Format: { [questionId]: answerValue }
  const [userAnswers, setUserAnswers] = useState<Record<string, 0 | 1 | 2>>({})

  // State for the calculated results to be displayed
  const [results, setResults] = useState<Results[]>([])

  // State for the final recommendation string
  const [recommendation, setRecommendation] = useState<string>("")

  // State to manage the delete confirmation dialog
  const [documentToDelete, setDocumentToDelete] = useState<DocumentToDelete | null>(null)

  // State to highlight questions that haven't been answered upon submission
  const [highlightedQuestionIds, setHighlightedQuestionIds] = useState<string[]>([])

  // State for the overall page loading spinner
  const [isPageLoading, setIsPageLoading] = useState(false)

  // =================================================================
  // Derived State and Memoized Values
  // =================================================================

  // IDs of questions that were not answered by the initial AI processing
  const unansweredByAIQuestionIds = useMemo(() => {
    if (documents.length > 0) {
      return documents[0].missingQuestionIds ?? []
    }
    return allQuestions.map(q => q.evaluationQuestionId) // Default to all questions if no doc
  }, [documents, allQuestions])

  // Filter questions that need manual scoring
  const questionsForManualScoring = useMemo(() =>
    allQuestions.filter(q => unansweredByAIQuestionIds.includes(q.evaluationQuestionId)),
    [allQuestions, unansweredByAIQuestionIds]
  )

  // Filter questions that were already answered by the AI
  const questionsAnsweredByAI = useMemo(() =>
    allQuestions.filter(q => !unansweredByAIQuestionIds.includes(q.evaluationQuestionId)),
    [allQuestions, unansweredByAIQuestionIds]
  )

  // =================================================================
  // Effects
  // =================================================================

  // Effect to turn off the page loader when navigation completes
  useEffect(() => {
    setIsPageLoading(false)
  }, [reviewId]) // Using reviewId as it's part of the pathname

  // Effect to pre-fill answers from a loaded scoring session
  useEffect(() => {
    if (activeScoringSession?.answers) {
      const loadedAnswers = activeScoringSession.answers.reduce((acc, ans) => {
        acc[ans.questionId] = ans.answer as 0 | 1 | 2
        return acc
      }, {} as Record<string, 0 | 1 | 2>)
      setUserAnswers(loadedAnswers)
    }
  }, [activeScoringSession])

  // =================================================================
  // Handlers and Mutations
  // =================================================================

  const { mutateAsync: deleteDocumentMutation } = trpc.documents.delete.useMutation()

  /**
   * Handles deleting a document and clearing all associated scoring data.
   */
  const handleDeleteDocument = async (docToDelete: DocumentToDelete) => {
    const { chatId, docId, s3Key, uploadedAt } = docToDelete
    try {
      await deleteDocumentMutation({ chatId, docId, s3Key, uploadedAt })

      if (activeScoringSession?.user_id && activeScoringSession?.createdAt) {
        await docClient.send(
          new UpdateCommand({
            TableName: scoringSessionConfig.tableName,
            Key: {
              user_id: activeScoringSession.user_id,
              createdAt: activeScoringSession.createdAt,
            },
            UpdateExpression: "REMOVE answers, scores, recommendation",
          })
        )
      }

      // Reset local state
      setUserAnswers({})
      setResults([])
      setRecommendation("")
      setHighlightedQuestionIds([])

      toast({ title: "Document and scores deleted successfully." })
      refetchDocuments() // Refetch to show the empty state
      refetchScoringSession() // Refetch to clear session data
    } catch (err) {
      toast({
        title: "Failed to delete document",
        description: (err as Error).message,
        variant: "destructive",
      })
    } finally {
      setDocumentToDelete(null)
    }
  }

  /**
   * Updates the state when a user selects an answer for a question.
   */
  const handleAnswerChange = (questionId: string, value: 0 | 1 | 2) => {
    setUserAnswers(prev => ({ ...prev, [questionId]: value }))
    setHighlightedQuestionIds(prev => prev.filter(id => id !== questionId))
  }

  /**
   * Generates a recommendation based on category scores and qualification cutoffs.
   * @param abilityPct - The percentage score for the 'Ability to Win' category (Y axis).
   * @param attractPct - The percentage score for the 'Attractiveness' category (X axis).
   * @param abilityQualCutoff - The qualification cutoff for Ability to Win category.
   * @param attractQualCutoff - The qualification cutoff for Attractiveness category.
   */
  function getRecommendation(abilityPct: number, attractPct: number, abilityQualCutoff: number, attractQualCutoff: number): string {
    // Both below qualification cutoff
    if (abilityPct < abilityQualCutoff && attractPct < attractQualCutoff) return "❌ No Bid";
    
    // Both above qualification cutoff  
    if (abilityPct >= abilityQualCutoff && attractPct >= attractQualCutoff) return "✅ Bid to Win";
    
    // Ability to Win above cutoff, Attractiveness below cutoff
    if (abilityPct >= abilityQualCutoff && attractPct < attractQualCutoff) return "🔧 Build Capability";
    
    // Ability to Win below cutoff, Attractiveness above cutoff
    if (abilityPct < abilityQualCutoff && attractPct >= attractQualCutoff) return "⏳ Faster Closure";
    
    return ""; // Default case
  }

  /**
   * Validates answers, calculates scores, and submits them to the database.
   */
  const handleSubmitScores = async () => {
    // 1. Validate that all required questions are answered
    const unansweredIds = questionsForManualScoring
      .filter(q => userAnswers[q.evaluationQuestionId] === undefined)
      .map(q => q.evaluationQuestionId)

    if (unansweredIds.length > 0) {
      setHighlightedQuestionIds(unansweredIds)
      toast({
        title: "Please answer all questions",
        description: `${unansweredIds.length} question(s) still need to be answered.`,
        variant: "destructive",
      })
      return
    }
    setHighlightedQuestionIds([])

    // 2. Format and merge answers - FIXED LOGIC
    // Only create "User provided answer" for questions that were actually answered manually
    const manuallyAnsweredQuestionIds = questionsForManualScoring.map(q => q.evaluationQuestionId);

    const newlyAnswered = Object.entries(userAnswers)
      .filter(([questionId]) => manuallyAnsweredQuestionIds.includes(questionId))
      .map(([questionId, answer]) => ({
        questionId,
        answer,
        reasoning: "User provided answer"
      }))

    // Keep existing AI answers with their original reasoning
    const previousAnswers = activeScoringSession?.answers?.filter(
      (ans) => !manuallyAnsweredQuestionIds.includes(ans.questionId)
    ).map(ans => ({
      ...ans,
      reasoning: ans.reasoning || "AI generated answer" // Fallback for existing data
    })) ?? []

    const allAnswers = [...newlyAnswered, ...previousAnswers]

    // 3. Calculate category scores using sorted categories
    const scoresByCategoryId = sortedCategories.reduce((acc, cat) => {
      acc[cat.categoryId] = 0;
      return acc;
    }, {} as Record<string, number>);

    allAnswers.forEach((ans) => {
      const question = allQuestions.find(q => q.evaluationQuestionId === ans.questionId)
      if (question) {
        scoresByCategoryId[question.categoryId] += ans.answer
      }
    })

    // 4. Prepare results for UI display using sorted categories (Ability to Win first)
    const calculatedResults = sortedCategories.map((cat) => {
      const questionsInCategory = allQuestions.filter(q => q.categoryId === cat.categoryId)
      return {
        categoryId: cat.categoryId,
        categoryName: cat.categoryName,
        score: scoresByCategoryId[cat.categoryId] ?? 0,
        total: questionsInCategory.length,
        qualificationCutoff: cat.qualificationCutoff,
      }
    })
    setResults(calculatedResults)

    // 5. Calculate percentages and get recommendation
    // calculatedResults[0] = Ability to Win (Y-axis), calculatedResults[1] = Attractiveness (X-axis)
    const abilityPercentage = Math.round((calculatedResults[0]?.score * 100) / (calculatedResults[0]?.total * 2)) || 0;
    const attractivenessPercentage = Math.round((calculatedResults[1]?.score * 100) / (calculatedResults[1]?.total * 2)) || 0;
    
    const abilityQualCutoff = calculatedResults[0]?.qualificationCutoff || 50;
    const attractQualCutoff = calculatedResults[1]?.qualificationCutoff || 50;
    
    const finalRecommendation = getRecommendation(abilityPercentage, attractivenessPercentage, abilityQualCutoff, attractQualCutoff);
    setRecommendation(finalRecommendation);

    // 6. Update DynamoDB with the new answers, scores, and recommendation
    try {
      if (!activeScoringSession?.user_id || !activeScoringSession?.createdAt) {
        toast({
          title: "Error",
          description: "No active scoring session found",
          variant: "destructive"
        });
        return;
      }

      await docClient.send(
        new UpdateCommand({
          TableName: scoringSessionConfig.tableName,
          Key: {
            user_id: activeScoringSession.user_id,
            createdAt: activeScoringSession.createdAt,
          },
          UpdateExpression: "SET answers = :answers, scores = :scores, recommendation = :recommendation",
          ExpressionAttributeValues: {
            ":answers": allAnswers,
            ":scores": scoresByCategoryId,
            ":recommendation": finalRecommendation,
          },
        })
      )
      await refetchScoringSession()
      toast({ title: "Scores submitted successfully!" });
    } catch (error) {
      console.error("Error submitting scores:", error);
      toast({
        title: "Error submitting scores",
        description: (error as Error).message,
        variant: "destructive"
      });
    }
  }

  // =================================================================
  // Render Logic
  // =================================================================

  // Combined loading state for the main spinner
  const showLoader = isPageLoading || isLoadingDocuments || !isLoaded || !userId

  if (!isLoaded || !userId) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <Loader2 className="h-12 w-12 text-[#3F72AF] animate-spin" />
      </div>
    )
  }

  return (
    <>
      {showLoader && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-white/70 backdrop-blur-sm">
          <Loader2 className="h-12 w-12 text-[#3F72AF] animate-spin" />
        </div>
      )}
      <div className="flex bg-[#F9F7F7] m-1 sm:m-2">
        <Sidebar />
        <MaxWidthWrapper className="lg:ml-64 w-full">
          <div className="flex flex-col">
            {/* Top Bar */}
            <div className="h-auto sm:h-16 border-b bg-white border-[#DBE2EF] p-2 sm:px-4 flex flex-col sm:flex-row items-start sm:items-center justify-between shadow-sm rounded-t-lg gap-2 sm:gap-0">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-6 w-full sm:w-auto">
                <h1 className="text-lg sm:text-xl font-semibold text-[#112D4E] truncate">
                  {activeScoringSession?.name}
                </h1>
                {questionsForManualScoring.length > 0 && (
                  <span className="text-xs sm:text-sm text-[#3F72AF] whitespace-nowrap">
                    {questionsForManualScoring.filter(q => userAnswers[q.evaluationQuestionId] !== undefined).length} of {questionsForManualScoring.length} questions answered
                  </span>
                )}
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                <Button
                  onClick={handleSubmitScores}
                  className="w-full sm:w-auto sm:max-w-xs bg-gradient-to-r from-[#3F72AF] to-[#112D4E] hover:from-[#2A5A8B] hover:to-[#0B1E32] text-sm sm:text-base"
                >
                  Score & Submit
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setIsPageLoading(true); router.push('/dashboard/temp') }}
                  className="w-full sm:w-auto border-[#3F72AF] text-[#3F72AF] hover:bg-[#DBE2EF] text-sm sm:text-base"
                >
                  Close Chat
                </Button>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row flex-1 overflow-hidden rounded-b-lg">
              {/* Left Panel - Questions */}
              <div className="w-full lg:w-3/5 lg:border-r border-[#DBE2EF] bg-white overflow-y-auto lg:h-[calc(100vh-9rem)] order-2 lg:order-1 p-3 sm:p-4 lg:p-6">
                {/* Document Status and Upload Section */}
                <div className="mb-6">
                  {isLoadingDocuments ? (
                    <div className="text-[#3F72AF] text-sm flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading document...
                    </div>
                  ) : documents.length === 0 ? (
                    <UploadButton
                      chatId={reviewId}
                      forReview={true}
                      onUploadSuccess={refetchDocuments}
                      user_id={userId}
                      createdAt={activeScoringSession?.createdAt || new Date().toISOString()}
                    />
                  ) : (
                    <div className="space-y-3">
                      {documents.map((doc) => (
                        <div key={doc.docId} className="flex items-center justify-between bg-[#F9F7F7] rounded-lg px-4 py-3 border border-[#DBE2EF]">
                          {/* Document Info and Status */}
                          <div className={`flex-1 flex items-center gap-3 min-w-0 ${doc.processingStatus !== 'COMPLETED' ? 'cursor-not-allowed opacity-70' : ''}`}>
                            {doc.processingStatus === 'COMPLETED' && <CheckCircle2 size={20} className="text-green-500 flex-shrink-0" />}
                            {doc.processingStatus === 'QUEUED' && <Clock size={20} className="text-yellow-500 flex-shrink-0" />}
                            {doc.processingStatus === 'PROCESSING' && <Loader2 className="h-5 w-5 animate-spin text-[#3F72AF] flex-shrink-0" />}
                            {doc.processingStatus === 'FAILED' && <XCircle size={20} className="text-red-500 flex-shrink-0" />}
                            <div className="min-w-0 flex-1">
                              <span className="text-sm font-medium text-[#112D4E] truncate block">{doc.fileName}</span>
                              {doc.processingStatus !== 'COMPLETED' && (
                                <span className="text-xs text-[#3F72AF] capitalize">{doc.processingStatus?.toLowerCase()}</span>
                              )}
                            </div>
                          </div>
                          {/* Delete Button */}
                          {doc.processingStatus !== 'QUEUED' && doc.processingStatus !== 'PROCESSING' && (
                            <Button size="sm" variant="destructive" onClick={() => setDocumentToDelete(doc)} className="text-sm ml-2 flex-shrink-0">
                              Delete
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Unanswered Questions Section */}
                <div className="mb-8">
                  <h2 className="text-lg font-semibold text-[#112D4E] mb-2">Unanswered Questions</h2>
                  <Accordion type="multiple" className="space-y-4">
                    {sortedCategories.map((cat) => {
                      const categoryUnansweredQuestions = questionsForManualScoring.filter(q => q.categoryId === cat.categoryId);
                      if (categoryUnansweredQuestions.length === 0) return null;

                      return (
                        <AccordionItem key={cat.categoryId} value={cat.categoryId} className="border border-[#DBE2EF] rounded-lg">
                          <AccordionTrigger className="text-lg font-medium px-4 py-3 hover:bg-[#F9F7F7] text-[#112D4E] text-left">
                            {cat.categoryName}
                          </AccordionTrigger>
                          <AccordionContent className="px-4 py-4">
                            <div className="space-y-4">
                              {categoryUnansweredQuestions.map((q) => (
                                <div key={q.evaluationQuestionId} className={`bg-[#F9F7F7] p-4 rounded-lg border ${highlightedQuestionIds.includes(q.evaluationQuestionId) ? 'border-red-500 bg-red-50' : ''}`}>
                                  <div className="mb-3 flex items-center gap-2">
                                    <span className="text-sm font-medium text-[#112D4E] leading-relaxed">{q.text}</span>
                                    <span className={`ml-2 px-2 py-0.5 text-xs rounded ${highlightedQuestionIds.includes(q.evaluationQuestionId) ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                      {highlightedQuestionIds.includes(q.evaluationQuestionId) ? 'Please answer' : 'Not answered by AI'}
                                    </span>
                                  </div>
                                  <RadioGroup value={String(userAnswers[q.evaluationQuestionId] ?? '')} onValueChange={(val) => handleAnswerChange(q.evaluationQuestionId, Number(val) as 0 | 1 | 2)} className="flex flex-wrap gap-4">
                                    <div className="flex items-center space-x-2">
                                      <RadioGroupItem value="0" id={`${q.evaluationQuestionId}-no`} className="border-[#3F72AF] text-[#3F72AF]" />
                                      <Label htmlFor={`${q.evaluationQuestionId}-no`} className="text-sm font-medium cursor-pointer">No</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <RadioGroupItem value="1" id={`${q.evaluationQuestionId}-maybe`} className="border-[#3F72AF] text-[#3F72AF]" />
                                      <Label htmlFor={`${q.evaluationQuestionId}-maybe`} className="text-sm font-medium cursor-pointer">Maybe</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <RadioGroupItem value="2" id={`${q.evaluationQuestionId}-yes`} className="border-[#3F72AF] text-[#3F72AF]" />
                                      <Label htmlFor={`${q.evaluationQuestionId}-yes`} className="text-sm font-medium cursor-pointer">Yes</Label>
                                    </div>
                                  </RadioGroup>
                                </div>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </div>

                {/* Answered Questions Section */}
                <div>
                  <h2 className="text-lg font-semibold text-[#112D4E] mb-2 mt-8">Answered Questions</h2>
                  <Accordion type="multiple" className="space-y-4">
                    {sortedCategories.map((cat) => {
                      const categoryAnsweredQuestions = questionsAnsweredByAI.filter(q => q.categoryId === cat.categoryId);
                      if (categoryAnsweredQuestions.length === 0) return null;

                      return (
                        <AccordionItem key={cat.categoryId} value={cat.categoryId} className="border border-[#DBE2EF] rounded-lg">
                          <AccordionTrigger className="text-lg font-medium px-4 py-3 hover:bg-[#F9F7F7] text-[#112D4E] text-left">
                            {cat.categoryName}
                          </AccordionTrigger>
                          <AccordionContent className="px-4 py-4">
                            <div className="space-y-4">
                              {categoryAnsweredQuestions.map((q) => {
                                const answer = activeScoringSession?.answers?.find(ans => ans.questionId === q.evaluationQuestionId);
                                const answerText = answer?.answer === 0 ? "No" : answer?.answer === 1 ? "Maybe" : answer?.answer === 2 ? "Yes" : "Not found";
                                const reasoning = answer?.reasoning || "No reasoning available";

                                return (
                                  <div key={q.evaluationQuestionId} className="bg-[#F9F7F7] p-4 rounded-lg border border-green-400">
                                    <div className="mb-3 flex items-center gap-2">
                                      <span className="text-sm font-medium text-[#112D4E] leading-relaxed">{q.text}</span>
                                      <span className="ml-2 px-2 py-0.5 text-xs rounded bg-green-100 text-green-800">Answered by AI</span>
                                    </div>
                                    <div className="mt-2 text-sm font-semibold text-[#3F72AF]">
                                      Answer: {answerText}
                                    </div>
                                    <div className="mt-1 text-xs text-[#112D4E] italic">
                                      Reasoning: {reasoning}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </div>
              </div>

              {/* Right Panel - Results */}
              <div className="w-full lg:w-2/5 bg-white overflow-y-auto lg:h-[calc(100vh-9rem)] order-1 lg:order-2 border-b lg:border-b-0 border-[#DBE2EF]">
                <div className="p-4">
                  <div className="lg:hidden mb-3">
                    <h2 className="text-lg font-semibold text-[#112D4E]">Results</h2>
                  </div>
                  <ResultDisplay results={results} recommendation={recommendation} />
                </div>
              </div>
            </div>
          </div>
        </MaxWidthWrapper>

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!documentToDelete} onOpenChange={open => !open && setDocumentToDelete(null)}>
          <DialogContent className="bg-[#F9F7F7] max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-[#112D4E]">Delete Document</DialogTitle>
            </DialogHeader>
            <div className="text-[#3F72AF]">
              Are you sure you want to delete this document? This will permanently remove all scores, recommendations, and answers associated with it.
            </div>
            <DialogFooter className="sm:justify-end gap-2">
              <Button variant="outline" onClick={() => setDocumentToDelete(null)} className="border-[#3F72AF] text-[#3F72AF] hover:bg-[#DBE2EF]">
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => documentToDelete && handleDeleteDocument(documentToDelete)}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  )
}