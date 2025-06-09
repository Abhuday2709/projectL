import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


export const ACCEPTED_MIME_TYPES = {
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
} as const; 

export const ACCEPTED_FILE_TYPES = new Set(Object.keys(ACCEPTED_MIME_TYPES));

export function isNetworkScienceEmail(email: string): boolean {
  return email.toLowerCase().endsWith('@networkscience.ai');
}

// types.ts
export interface CategoryType {
  user_id: string
  categoryId: string
  categoryName: string
  order: number
}

export interface QuestionType {
  user_id: string
  evaluationQuestionId: string
  text: string
  categoryId: string
  order: number
  isMaster?: boolean
}

export interface AnswerType {
  questionId: string
  answer: "No" | "Maybe" | "Yes"
  score: 0 | 1 | 2
}

export interface ScoringResult {
  totalAttractiveness: number
  totalAbility: number
  quadrantLabel: string
}
