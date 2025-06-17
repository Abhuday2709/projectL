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

import { RadarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ScatterChart, Scatter, ReferenceLine, ResponsiveContainer, ReferenceArea, ReferenceDot, Cell } from "recharts"
import { CategoryType, QuestionType, Results } from "@/lib/utils"
import Sidebar from "@/components/Sidebar"
import MaxWidthWrapper from "@/components/MaxWidthWrapper"
import { trpc } from "@/app/_trpc/client"
import UploadButton from "@/components/UploadButton"
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@clerk/nextjs"
import { AlertTriangle, CheckCircle2, Clock, Loader2, XCircle } from "lucide-react"
import { ScoringSession, scoringSessionConfig } from "../../../../../models/scoringReviewModel"
import { dynamoClient } from "@/lib/AWS/AWS_CLIENT"
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb"
import { set } from "zod"

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

  const handleDeleteDocument = async (docId: string, s3Key: string, uploadedAt: string, chatId: string) => {
    try {
      await deleteDocument.mutateAsync({ chatId, docId, s3Key, uploadedAt });
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
    if (missingQuestionIds.length > 0 && question) {
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
    console.log("Merged answers array:", mergedAnswers);

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
    console.log("Category scores:", categoryScores);

    // Update DynamoDB: store the mergedAnswers array (not a Map) and scores
    await docClient.send(
      new UpdateCommand({
        TableName: scoringSessionConfig.tableName,
        Key: {
          user_id: currentSession?.user_id,
          createdAt: currentSession?.createdAt || new Date().toISOString(),
        },
        UpdateExpression: "SET answers = :answers, scores = :scores",
        ExpressionAttributeValues: {
          ":answers": mergedAnswers,
          ":scores": categoryScores,
        },
      })
    );

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
    console.log("Results array:", resultsArr);
    setResults(resultsArr);
    const cat1 = Math.round((resultsArr[0]?.score * 100) / (resultsArr[0]?.total * 2));
    const cat2 = Math.round((resultsArr[1]?.score * 100) / (resultsArr[1]?.total * 2));
    console.log("Category 1 percentage:", cat1);
    console.log("Category 2 percentage:", cat2);
    console.log("Recommendation based on categories:", getRecommendation(cat1, cat2));


    setRecommendation(getRecommendation(cat1, cat2));
    await scoringSessionRefetch();
  };
  const router = useRouter()
  
  function getRecommendation(abilityPct: number, attractPct: number) {
    // Row: Ability to Win, Col: Attractiveness
    if (abilityPct < 50 && attractPct < 50) return "❌ No Bid";
    if (abilityPct < 50 && attractPct < 75) return "⏳ Faster Closure";
    if (abilityPct < 50 && attractPct <= 100) return "⏳ Faster Closure";
    if (abilityPct < 75 && attractPct < 75) return "✅ Bid to Win";
    if (abilityPct < 75 && attractPct < 50) return "🔧 Build Capability";
    if (abilityPct <= 100 && attractPct < 50) return "🔧 Build Capability";
    if (abilityPct < 75 && attractPct <= 100) return "✅ Bid to Win";
    if (abilityPct <= 100 && attractPct < 75) return "✅ Bid to Win";
    if (abilityPct <= 100 && attractPct <= 100) return "✅ Bid to Win";
    return "";
  }

  if (!isLoaded || !userId) {
    return <div>Loading...</div>;
  }
   const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold text-sm">Your Score:</p>
          <p className="text-sm text-blue-600">Attractiveness: {data.x.toFixed(1)}%</p>
          <p className="text-sm text-green-600">Ability to Win: {data.y.toFixed(1)}%</p>
        </div>
      );
    }
    return null;
  };
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
                                onClick={() => handleDeleteDocument(doc.docId, doc.s3Key, doc.uploadedAt, doc.chatId)}
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
                {results.length < 2 ? (
                  <div className="flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <p className="text-gray-500 text-lg">Submit to view results</p>
                      <p className="text-gray-400 text-sm mt-2">Complete the evaluation to see your scoring matrix</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {/* Score Summary */}
                    <div className="mb-4">
                      <h2 className="text-xl font-bold text-gray-900 mb-2">Evaluation Results</h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-2">
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                          <div className="text-sm font-medium text-blue-800">{results[0]?.categoryName}</div>
                          <div className="text-xl font-bold text-blue-900">
                            {results[0]?.score}/{results[0]?.total * 2}
                          </div>
                          <div className="text-sm text-blue-600">
                            {Math.round((results[0]?.score * 100) / (results[0]?.total * 2))}%
                          </div>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                          <div className="text-sm font-medium text-green-800">{results[1]?.categoryName}</div>
                          <div className="text-xl font-bold text-green-900">
                            {results[1]?.score}/{results[1]?.total * 2}
                          </div>
                          <div className="text-sm text-green-600">
                            {Math.round((results[1]?.score * 100) / (results[1]?.total * 2))}%
                          </div>
                        </div>
                      </div>
                      
                      {/* Recommendation */}
                      <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-2 rounded-lg border border-purple-200">
                        <div className="text-sm font-medium text-purple-800 mb-1 flex justify-center">Recommendation</div>
                        <div className="text-xl font-bold text-purple-900 flex justify-center">{recommendation}</div>
                      </div>
                    </div>
                    {/* Enhanced Chart */}
                    <div className="flex-1 min-h-0">
                      <div className="w-full">
                        <ResponsiveContainer width="100%" height={300}>
                          <ScatterChart
                            margin={{ top: 0, right: 0, bottom: 20, left: 0 }}
                          >
                            {/* Enhanced Quadrant backgrounds with better colors */}
                            <ReferenceArea x1={0} x2={50} y1={0} y2={50} fill="#fca5a5" fillOpacity={0.3} />
                            <ReferenceArea x1={50} x2={75} y1={0} y2={50} fill="#fbbf24" fillOpacity={0.3} />
                            <ReferenceArea x1={75} x2={100} y1={0} y2={50} fill="#fbbf24" fillOpacity={0.3} />
                            <ReferenceArea x1={0} x2={50} y1={50} y2={100} fill="#60a5fa" fillOpacity={0.3} />
                            <ReferenceArea x1={50} x2={100} y1={75} y2={100} fill="#34d399" fillOpacity={0.3} />
                            <ReferenceArea x1={50} x2={100} y1={50} y2={75} fill="#34d399" fillOpacity={0.3} />

                            {/* Grid lines for better readability */}
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            
                            {/* Reference lines for quadrant divisions */}
                            <ReferenceLine x={50} stroke="#9ca3af" strokeDasharray="2 2" />
                            <ReferenceLine y={50} stroke="#9ca3af" strokeDasharray="2 2" />
                            
                            {/* Enhanced Axes */}
                            <XAxis
                              type="number"
                              dataKey="x"
                              name="Attractiveness"
                              domain={[0, 100]}
                              tick={{ fontSize: 12, fill: '#374151' }}
                              tickLine={{ stroke: '#9ca3af' }}
                              axisLine={{ stroke: '#9ca3af' }}
                              label={{ 
                                value: "Attractiveness %", 
                                position: "insideBottom", 
                                offset: -10,
                                style: { textAnchor: 'middle', fill: '#374151', fontSize: '12px', fontWeight: 'bold' }
                              }}
                            />
                            <YAxis
                              type="number"
                              dataKey="y"
                              name="Ability to Win"
                              domain={[0, 100]}
                              tick={{ fontSize: 12, fill: '#374151' }}
                              tickLine={{ stroke: '#9ca3af' }}
                              axisLine={{ stroke: '#9ca3af' }}
                              label={{ 
                                value: "Ability to Win %", 
                                angle: -90, 
                                position: "insideLeft",
                                style: { textAnchor: 'middle', fill: '#374151', fontSize: '12px', fontWeight: 'bold' }
                              }}
                            />
                            
                            {/* Enhanced Tooltip */}
                            <Tooltip content={<CustomTooltip />} />
                            
                            {/* Your review's point with enhanced styling */}
                            <Scatter 
                              name="Your Score" 
                              data={[{ 
                                x: Math.round((results[0]?.score * 100) / (results[0]?.total * 2)), 
                                y: Math.round((results[1]?.score * 100) / (results[1]?.total * 2)) 
                              }]} 
                              fill="#8b5cf6"
                            >
                              <Cell fill="#8b5cf6" stroke="#ffffff" strokeWidth={3} />
                            </Scatter>

                            {/* Enhanced Quadrant Labels with better positioning */}
                            <ReferenceDot x={25} y={25} r={0} isFront={true} 
                              label={{ value: "❌ No Bid", position: "center", fill: "#dc2626", fontWeight: "bold", fontSize: 11 }} />
                            <ReferenceDot x={75} y={25} r={0} isFront={true} 
                              label={{ value: "🔧 Build Capability", position:"center", fill: "#d97706", fontWeight: "bold", fontSize: 11 }} />
                            <ReferenceDot x={25} y={75} r={0} isFront={true} 
                              label={{ value: "⏳ Faster Closure", position: "center", fill: "#2563eb", fontWeight: "bold", fontSize: 10 }} />
                            <ReferenceDot x={75} y={75} r={0} isFront={true} 
                              label={{ value: "✅ Bid to Win", position: "center", fill: "#059669", fontWeight: "bold", fontSize: 11 }} />
                          </ScatterChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </MaxWidthWrapper>
    </div>
  )
}