export interface InterviewState {
  currentStage: 'introduction' | 'question' | 'coding' | 'feedback' | 'hint' | 'completed';
  currentQuestion: Question | null;
  conversationHistory: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
  }>;
  codeHistory: string[];
  currentFeedback: string | null;
  hintsUsed: number;
  lastAnalysisTime: number | null;
}

export interface Question {
  id: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  categories: string[];
  examples: Array<{
    input: string;
    output: string;
    explanation?: string;
  }>;
  constraints?: string[];
  starterCode?: string;
  hints?: string[];
}
