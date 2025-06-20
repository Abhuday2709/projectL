"use client"

import { useState, useEffect, use } from "react"
import { useParams, useRouter } from "next/navigation"
// shadcn component imports
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { CategoryType, QuestionType, Results } from "@/lib/utils"
import Sidebar from "@/components/Sidebar"
import MaxWidthWrapper from "@/components/MaxWidthWrapper"
import { trpc } from "@/app/_trpc/client"
import UploadButton from "@/components/UploadButton"
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@clerk/nextjs"
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react"
import { ScoringSession, scoringSessionConfig } from "../../../../../models/scoringReviewModel"
import { dynamoClient } from "@/lib/AWS/AWS_CLIENT"
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb"
import ResultDisplay from "@/components/ResultDisplay"

const docClient = DynamoDBDocumentClient.from(dynamoClient);

export default function QualifyPageForDosument() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const params = useParams();
  const reviewId = params.reviewId as string;
  const { toast } = useToast();
  const {
    data: documents = [],
    refetch: refetchDocuments,
    isLoading: isLoadingDocuments,
  } = trpc.documents.getStatus.useQuery({ chatId: reviewId },
    { enabled: !!reviewId }); // Use reviewId as chatId

  const { data: category, refetch: catRefetch } = trpc.category.getCategories.useQuery(
    userId ? { user_id: userId } : { user_id: "" },
    { enabled: !!userId }
  );
  const { data: question, refetch: QustionRefetch } = trpc.question.getQuestions.useQuery(
    userId ? { user_id: userId } : { user_id: "" },
    { enabled: !!userId }
  );
  const { data: scoringSessionData, refetch: scoringSessionRefetch } = trpc.scoringSession.getScoringSession.useQuery(
    userId ? { user_id: userId } : { user_id: "" },
    { enabled: !!userId }
  );
  // State
  const [categories, setCategories] = useState<CategoryType[]>([])
  const [questions, setQuestions] = useState<QuestionType[]>([])
  const [scoringSession, setScoringSession] = useState<ScoringSession>();
  const [answers, setAnswers] = useState<Record<string, 0 | 1 | 2>>({})
  const [missingQuestionIds, setMissingQuestionIds] = useState<string[]>([])
  const [results, setResults] = useState<Results[]>([])
  const deleteDocument = trpc.documents.delete.useMutation();
  const [recommendation, setRecommendation] = useState<string>("");
  const [confirmDelete, setConfirmDelete] = useState<null | { docId: string; s3Key: string; uploadedAt: string; chatId: string }>(null);


  const handleDeleteDocument = async (docId: string, s3Key: string, uploadedAt: string, chatId: string) => {
    try {
      await deleteDocument.mutateAsync({ chatId, docId, s3Key, uploadedAt });
      // 2. Clear the scoring session's answers, scores, and recommendation in DynamoDB
      if (scoringSession?.user_id && scoringSession?.createdAt) {
        await docClient.send(
          new UpdateCommand({
            TableName: scoringSessionConfig.tableName,
            Key: {
              user_id: scoringSession.user_id,
              createdAt: scoringSession.createdAt,
            },
            UpdateExpression: "REMOVE answers, scores", // Remove these attributes
          })
        );
      }

      setAnswers({});
      setResults([]);
      setRecommendation("");
      if (question){
        setMissingQuestionIds(question.map(q => q.evaluationQuestionId));
      } // Reset to all questions
      toast({ title: "Document deleted" });
      refetchDocuments();
    } catch (err) {
      toast({ title: "Failed to delete", description: (err as Error).message, variant: "destructive" });
    }
  };

  useEffect(() => {
    if (scoringSession && scoringSession.answers) {
      // Convert array of {questionId, answer} to { [questionId]: answer }
      const loadedAnswers: Record<string, 0 | 1 | 2> = {};
      scoringSession.answers.forEach(ans => {
        // Only set answers for questions that are in missingQuestionIds
        if (missingQuestionIds.includes(ans.questionId)) {
          loadedAnswers[ans.questionId] = ans.answer as 0 | 1 | 2;
        }
      });
      setAnswers(loadedAnswers);
    }
  }, [scoringSession]);

  // Fetch categories & questions
  useEffect(() => {
    if (category) setCategories(category);
  }, [category]);

  useEffect(() => {
    if (question) {
      setQuestions(question);
    }
  }, [question]);

  useEffect(() => {
    if (scoringSessionData) {
      setScoringSession(scoringSessionData[0]);
    }
  }, [scoringSessionData]);

  useEffect(() => {
    if (documents.length > 0) {
      // Get the most recent document's missingQuestionIds
      const latestDoc = documents[0];
      if (latestDoc.missingQuestionIds) {
        setMissingQuestionIds(latestDoc.missingQuestionIds);
      }
    }
  }, [documents]);

  useEffect(() => {
    if (missingQuestionIds && question) {
      const filteredQuestions = question.filter(q => missingQuestionIds.includes(q.evaluationQuestionId));
      setQuestions(filteredQuestions);
    }

  }, [question, missingQuestionIds]);

  // Handle individual answer selection
  const handleAnswerChange = (questionId: string, value: 0 | 1 | 2) => {
    setAnswers({ ...answers, [questionId]: value })
  }

  // Submit scores
  const handleSubmit = async () => {
    const formattedAnswers = Object.entries(answers).map(([questionId, answer]) => ({
      answer,
      questionId,
    }));
    const currentSession = scoringSession
    const currentAnswers: { questionId: string; answer: number }[] =
      currentSession?.answers || [];

    // Filter out any currentAnswers that are overridden by formattedAnswers
    const filteredCurrentAnswers = currentAnswers.filter(
      (ans) => !formattedAnswers.some((f) => f.questionId === ans.questionId)
    );

    // Merge into one array, with formattedAnswers first
    const mergedAnswers = [...formattedAnswers, ...filteredCurrentAnswers];
    // console.log("Merged answers array:", mergedAnswers);

    // Calculate results for each category
    const categoryScores = categories.reduce((acc, cat) => {
      acc[cat.categoryId] = 0;
      return acc;
    }, {} as Record<string, number>);

    // For each merged answer, look up its question to add to category score
    mergedAnswers.forEach((ans) => {
      const matchingQuestion = question?.find(
        (q) => q.evaluationQuestionId === ans.questionId
      );
      if (matchingQuestion) {
        const catId = matchingQuestion.categoryId;
        categoryScores[catId] = (categoryScores[catId] || 0) + ans.answer;
      } else {
        console.warn(`No matching question found for answer ID: ${ans.questionId}`);
      }
    });
    // console.log("Category scores:", categoryScores);

    // Prepare results array for UI
    const resultsArr = categories.map((cat) => {
      const questionsInCategory = question?.filter(
        (q) => q.categoryId === cat.categoryId
      );
      return {
        categoryName: cat.categoryName,
        score: categoryScores[cat.categoryId] ?? 0,
        total: questionsInCategory?.length ? questionsInCategory.length : 0,
      };
    });
    // console.log("Results array:", resultsArr);
    setResults(resultsArr);
    const cat1 = Math.round((resultsArr[0]?.score * 100) / (resultsArr[0]?.total * 2));
    const cat2 = Math.round((resultsArr[1]?.score * 100) / (resultsArr[1]?.total * 2));
    // console.log("Recommendation based on categories:", getRecommendation(cat1, cat2));


    setRecommendation(getRecommendation(cat1, cat2));
    // Update DynamoDB: store the mergedAnswers array (not a Map) and scores
    await docClient.send(
      new UpdateCommand({
        TableName: scoringSessionConfig.tableName,
        Key: {
          user_id: currentSession?.user_id,
          createdAt: currentSession?.createdAt || new Date().toISOString(),
        },
        UpdateExpression: "SET answers = :answers, scores = :scores,recommendation = :recommendation",
        ExpressionAttributeValues: {
          ":answers": mergedAnswers,
          ":scores": categoryScores,
          ":recommendation": getRecommendation(cat1, cat2),
        },
      })
    );

    await scoringSessionRefetch();
  };
  const router = useRouter()

  function getRecommendation(abilityPct: number, attractPct: number) {
    // Row: Ability to Win, Col: Attractiveness
    if (abilityPct < 50 && attractPct < 50) return "❌ No Bid";
    if (abilityPct < 50 && attractPct <= 100) return "⏳ Faster Closure";
    if (abilityPct <= 100 && attractPct < 50) return "🔧 Build Capability";
    if (abilityPct <= 100 && attractPct <= 100) return "✅ Bid to Win";
    return "";
  }

  if (!isLoaded || !userId) {
    return <div>Loading...</div>;
  }
  return (
    <div className="flex bg-gray-100 m-2">
      <Sidebar />
      <MaxWidthWrapper className="ml-64">
        <div className="flex flex-col ">
          {/* Top Bar with Name, Progress, Submit, and Close Chat */}
          <div className="h-16 border-b bg-white px-4 flex items-center justify-between shadow-sm rounded-t-lg">
            {/* Left: Name and Progress */}
            <div className="flex items-center gap-6">
              <h1 className="text-xl font-semibold text-gray-800">{scoringSession?.name}</h1>
              {questions.length > 0 && (
                <span className="text-sm text-gray-600">
                  {Object.keys(answers).length} of {questions.length} questions answered
                </span>
              )}
            </div>
            {/* Center: Submit Button */}
            <div className="flex-1 flex justify-center">
              <Button
                onClick={handleSubmit}
                disabled={
                  questions.length === 0 ||
                  Object.keys(answers).length < questions.length ||
                  Object.values(answers).some((v) => v === undefined)
                }
                className="w-full sm:w-auto max-w-xs"
              >
                Score & Submit
              </Button>
            </div>
            {/* Right: Close Chat */}
            <div className="flex items-center">
              <Button variant="default" onClick={() => router.push('/dashboard/temp')}>
                Close Chat
              </Button>
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden max-h-[calc(100vh-9rem)] rounded-b-lg">
            {/* Left Panel - Questions */}
            <div className="w-full lg:w-3/5 border-r bg-white overflow-y-auto h-[calc(100vh-9rem)]">
              <div className="p-4 lg:p-6">
                <div className="mb-6">
                  {isLoadingDocuments ? (
                    <div className="text-gray-500 text-sm flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading document...
                    </div>
                  ) : documents.length === 0 ? (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <UploadButton
                        chatId={reviewId}
                        forReview={true}
                        onUploadSuccess={() => refetchDocuments()}
                        user_id={userId}
                        createdAt={scoringSession?.createdAt || new Date().toISOString()}
                      />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {documents.map((doc) => {
                        const isQueued = doc.processingStatus === 'QUEUED';
                        const isProcessing = doc.processingStatus === 'PROCESSING';
                        const isFailed = doc.processingStatus === 'FAILED';
                        const isCompleted = doc.processingStatus === 'COMPLETED';

                        return (
                          <div key={doc.docId} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 border">
                            <div className={`flex-1 flex items-center gap-3 ${!isCompleted ? 'cursor-not-allowed opacity-70' : ''}`}>
                              {isCompleted && <CheckCircle2 size={20} className="text-green-500 flex-shrink-0" />}
                              {isQueued && <Clock size={20} className="text-yellow-500 flex-shrink-0" />}
                              {isProcessing && <Loader2 className="h-5 w-5 animate-spin text-blue-500 flex-shrink-0" />}
                              {isFailed && <XCircle size={20} className="text-red-500 flex-shrink-0" />}
                              <div className="min-w-0 flex-1">
                                <span className="text-sm font-medium text-gray-900 truncate block">{doc.fileName}</span>
                                {(isProcessing || isQueued || isFailed) && (
                                  <span className="text-xs text-gray-500 capitalize">
                                    {doc.processingStatus?.toLowerCase()}
                                  </span>
                                )}
                              </div>
                            </div>
                            {!(isQueued || isProcessing) && (
                              <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setConfirmDelete({
                              docId: doc.docId,
                              s3Key: doc.s3Key,
                              uploadedAt: doc.uploadedAt,
                              chatId: doc.chatId
                            })}
                          >
                            Delete
                          </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <Accordion type="multiple" className="space-y-4">
                  {categories.map((cat) => (
                    <AccordionItem key={cat.categoryId} value={cat.categoryId} className="border border-gray-200 rounded-lg">
                      <AccordionTrigger className="text-lg font-medium px-4 py-3 hover:bg-gray-50">
                        {cat.categoryName}
                      </AccordionTrigger>
                      <AccordionContent className="px-4 py-4">
                        <div className="space-y-4">
                          {questions
                            .filter((q) => q.categoryId === cat.categoryId)
                            .map((q) => (
                              <div key={q.evaluationQuestionId} className="bg-gray-50 p-4 rounded-lg">
                                <div className="mb-3">
                                  <span className="text-sm font-medium text-gray-900">{q.text}</span>
                                </div>
                                <RadioGroup
                                  value={String(answers[q.evaluationQuestionId] ?? '')}
                                  onValueChange={(val) =>
                                    handleAnswerChange(q.evaluationQuestionId, Number(val) as 0 | 1 | 2)
                                  }
                                  className="flex flex-wrap gap-4"
                                >
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="0" id={`${q.evaluationQuestionId}-no`} />
                                    <Label htmlFor={`${q.evaluationQuestionId}-no`} className="text-sm font-medium cursor-pointer">No</Label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="1" id={`${q.evaluationQuestionId}-maybe`} />
                                    <Label htmlFor={`${q.evaluationQuestionId}-maybe`} className="text-sm font-medium cursor-pointer">Maybe</Label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="2" id={`${q.evaluationQuestionId}-yes`} />
                                    <Label htmlFor={`${q.evaluationQuestionId}-yes`} className="text-sm font-medium cursor-pointer">Yes</Label>
                                  </div>
                                </RadioGroup>
                              </div>
                            ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </div>

            {/* Right Panel - Results */}
            <div className="w-full lg:w-2/5 bg-white overflow-y-auto h-[calc(100vh-9rem)] ">
              <div className="p-4 ">
                <ResultDisplay results={results} recommendation={recommendation}/>
              </div>
            </div>
          </div>
        </div>
      </MaxWidthWrapper>
      <Dialog open={!!confirmDelete} onOpenChange={open => !open && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
          </DialogHeader>
          <div>Are you sure you want to delete this document? This will also remove all scores, recommendations, and answers related to it.</div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirmDelete) {
                  handleDeleteDocument(
                    confirmDelete.docId,
                    confirmDelete.s3Key,
                    confirmDelete.uploadedAt,
                    confirmDelete.chatId
                  );
                  setConfirmDelete(null);
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}