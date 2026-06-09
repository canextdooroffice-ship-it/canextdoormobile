export interface MCQQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswerIndex: number; // 0 = A, 1 = B, 2 = C, 3 = D
  explanation: string;
}

export interface SubjectiveQuestion {
  id: string;
  question: string;
  marks: number;
  suggestedAnswer: string;
}

export interface MockTestPaper {
  id: string;
  title: string;
  type: 'MCQ' | 'Subjective';
  totalMarks: number;
  questions: MCQQuestion[] | SubjectiveQuestion[];
}

export const MOCK_TESTS_DATA: Record<string, Record<string, MockTestPaper[]>> = {
  Final: {},
  Intermediate: {},
  Foundation: {}
};
