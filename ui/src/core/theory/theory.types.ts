export type TheoryPracticeMode = 'topic' | 'weak' | 'pdf';
export type TheoryDifficulty = 'Junior' | 'Mid' | 'Senior';
export type TheoryAnswerStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface ITheorySession {
  id: string;
  topicId: string | null;
  mode: TheoryPracticeMode;
  difficulty: TheoryDifficulty;
  totalQuestions: number;
  questionsAnswered: number;
  avgScore: number;
  status: 'in_progress' | 'completed';
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
}

export interface ITheorySessionHistory {
  sessions: ITheorySession[];
  total: number;
  page: number;
  limit: number;
}

export interface IStartTheorySessionBody {
  topicId?: string;
  pdfIds?: string[];
  mode: TheoryPracticeMode;
  difficulty: TheoryDifficulty;
  totalQuestions: number;
}

export interface ITheoryQuestion {
  id: string;
  question: string;
  topicId?: string | null;
  difficulty?: TheoryDifficulty;
  citations?: ITheoryQuestionCitation[];
}

export interface ITheoryQuestionCitation {
  pdfId: string;
  displayName: string;
  page: number;
  chunkId: string;
}

export interface ISubmitTheoryAnswerBody {
  questionId?: string | null;
  questionText: string;
  userAnswer: string;
  timeTaken?: number;
}

export interface ITheoryAnswer {
  id: string;
  sessionId: string;
  questionId: string | null;
  questionText: string;
  userAnswer: string;
  aiScore: number | null;
  aiFeedback: string | null;
  evaluationProvider: string | null;
  evaluationModel: string | null;
  evaluationPromptVersion: string | null;
  status: TheoryAnswerStatus;
  failureMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  timeTaken: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ITheorySessionDetail extends ITheorySession {
  answers: ITheoryAnswer[];
}

export interface ITheoryWeakArea {
  topicId: string;
  topicName: string;
  avgScore: number;
  sessionsCount: number;
  lastPracticed: string | null;
}

export interface ITheoryScoreTrendPoint {
  date: string;
  avgScore: number;
}
