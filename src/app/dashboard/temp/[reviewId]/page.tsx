"use client"

import { useUser, UserButton } from "@clerk/nextjs"
import { useState, useEffect } from "react"
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
import { Input } from "@/components/ui/input"

import { RadarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ScatterChart, Scatter, ReferenceLine } from "recharts"
import { CategoryType, QuestionType } from "@/lib/utils"
import Sidebar from "@/components/Sidebar"
import MaxWidthWrapper from "@/components/MaxWidthWrapper"

export default function QualifyPageForDosument() {
  const { user } = useUser()
  const userId = user?.id!

  // State
  const [categories, setCategories] = useState<CategoryType[]>([])
  const [questions, setQuestions] = useState<QuestionType[]>([])
  const [answers, setAnswers] = useState<Record<string, 0 | 1 | 2>>({})
  const [missingQuestionIds, setMissingQuestionIds] = useState<string[]>([])
  const [docFile, setDocFile] = useState<File | null>(null)
  const [docKey, setDocKey] = useState<string | null>(null)
  const [results, setResults] = useState<{
    totalA: number
    totalB: number
    quadrant: string
  } | null>(null)

  // Fetch categories & questions
  useEffect(() => {
    async function loadQuestions() {
      const catRes = await fetch(`/api/categories/${userId}`)
      const catData = await catRes.json()
      setCategories(catData)

      const qRes = await fetch(`/api/questions/${userId}`)
      const qData = await qRes.json()
      setQuestions(qData)
    }
    if (userId) loadQuestions()
  }, [userId])

  // Handle doc upload → S3 → get docKey
  useEffect(() => {
    if (!docFile) return
    const upload = async () => {
      const formData = new FormData()
      formData.append("file", docFile)
      formData.append("userId", userId)
      const res = await fetch("/api/upload-document", {
        method: "POST",
        body: formData,
      })
      const { docKey: key } = await res.json()
      setDocKey(key)
    }
    upload()
  }, [docFile])

  // Call Gemini after docKey & questions are ready
  useEffect(() => {
    if (docKey && questions.length > 0) {
      const callGemini = async () => {
        const payload = {
          userId,
          docKey,
          questions: questions.map((q) => ({ id: q.evaluationQuestionId, text: q.text }))
        }
        const res = await fetch("/api/qualify/document", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const { missingQuestionIds, answeredQuestionIds } = await res.json()
        setMissingQuestionIds(missingQuestionIds)
        // Pre-fill answered ones as Yes (score=2), if you prefer
        const initialAnswers: Record<string, 0 | 1 | 2> = {}
        answeredQuestionIds.forEach((qid: string) => (initialAnswers[qid] = 2))
        setAnswers(initialAnswers)
      }
      callGemini()
    }
  }, [docKey, questions])

  // Handle individual answer selection
  const handleAnswerChange = (questionId: string, value: 0 | 1 | 2) => {
    setAnswers({ ...answers, [questionId]: value })
  }

  // Submit scores
  const handleSubmit = async () => {
    const payload = {
      userId,
      docKey,
      answers: Object.entries(answers).map(([questionId, score]) => ({
        questionId,
        answer: score === 2 ? "Yes" : score === 1 ? "Maybe" : "No",
        score,
      })),
    }
    const res = await fetch("/api/submit-scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    setResults({
      totalA: data.totalAttractiveness,
      totalB: data.totalAbility,
      quadrant: data.quadrantLabel,
    })
  }

  // Render categories & questions
  return (
    <div className="flex">
      <Sidebar />
      <MaxWidthWrapper className="ml-64">
        <div className="flex flex-col ">
          {/* Top Navbar from your existing layout */}
          <header className="h-16 border-b px-4 flex items-center justify-between">
            <h1 className="text-xl font-semibold">Opportunity Qualifier</h1>
          </header>

          <div className="flex flex-1 overflow-hidden">
            {/* Left Pane */}
            <div className="w-full md:w-3/5 border-r overflow-y-auto p-4">
              <div className="mb-4 space-y-2">
                <Label htmlFor="document">Upload Document (PDF/DOCX)</Label>
                <Input
                  id="document"
                  type="file"
                  accept=".pdf,.docx"
                  onChange={(e) => e.target.files && setDocFile(e.target.files[0])}
                />
              </div>

              <Accordion type="multiple" className="space-y-4">
                {categories.map((cat) => (
                  <AccordionItem key={cat.categoryId} value={cat.categoryId}>
                    <AccordionTrigger className="text-lg font-medium">
                      {cat.categoryName}
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4">
                        {questions
                          .filter((q) => q.categoryId === cat.categoryId)
                          .map((q) => (
                            <div key={q.evaluationQuestionId} className="flex items-center justify-between gap-4">
                              <span className="text-sm">{q.text}</span>
                              <RadioGroup
                                value={String(answers[q.evaluationQuestionId])}
                                onValueChange={(val) =>
                                  handleAnswerChange(q.evaluationQuestionId, Number(val) as 0 | 1 | 2)
                                }
                                className="flex space-x-2"
                              >
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="0" id={`${q.evaluationQuestionId}-no`} />
                                  <Label htmlFor={`${q.evaluationQuestionId}-no`}>No</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="1" id={`${q.evaluationQuestionId}-maybe`} />
                                  <Label htmlFor={`${q.evaluationQuestionId}-maybe`}>Maybe</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="2" id={`${q.evaluationQuestionId}-yes`} />
                                  <Label htmlFor={`${q.evaluationQuestionId}-yes`}>Yes</Label>
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

            {/* Right Pane */}
            <div className="w-full md:w-2/5 p-4 flex flex-col items-center justify-center">
              {!results ? (
                <div className="text-gray-500">Submit to view results</div>
              ) : (
                <>
                  <div className="mb-4 text-center">
                    <div className="text-lg font-semibold">
                      Attractiveness: {results.totalA} / 100
                    </div>
                    <div className="text-lg font-semibold">
                      Ability to Win: {results.totalB} / 100
                    </div>
                    <div className="mt-2 text-xl font-bold">{results.quadrant}</div>
                  </div>

                  <div className="w-full h-64">
                    {/* 2×2 Chart using Recharts */}
                    <ScatterChart
                      width={350}
                      height={350}
                      margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                    >
                      {/* Vertical & Horizontal Lines at 50 */}
                      <ReferenceLine x={50} stroke="#ccc" />
                      <ReferenceLine y={50} stroke="#ccc" />

                      {/* The Data Point */}
                      <Scatter
                        name="Opportunity"
                        data={[{ x: results.totalA, y: results.totalB }]}
                        fill="#000"
                      />

                      <XAxis
                        type="number"
                        dataKey="x"
                        name="Attractiveness"
                        domain={[0, 100]}
                        tickCount={6}
                      />
                      <YAxis
                        type="number"
                        dataKey="y"
                        name="Ability to Win"
                        domain={[0, 100]}
                        tickCount={6}
                      />
                      <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                    </ScatterChart>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="h-16 border-t px-4 flex items-center justify-between">
            <Button
              onClick={handleSubmit}
              disabled={
                questions.length === 0 ||
                Object.keys(answers).length < questions.length ||
                Object.values(answers).some((v) => v === undefined)
              }
            >
              Score & Submit
            </Button>
          </div>
        </div>
      </MaxWidthWrapper>
    </div>
  )
}
