export type CodingDifficulty = 'Easy' | 'Medium' | 'Hard';

export interface ICodingProblemSummary {
  id: string;
  title: string;
  slug: string;
  description: string;
  difficulty: CodingDifficulty;
  topic: string;
  isSolved: boolean;
}

export interface ICodingProblemExample {
  input: unknown[];
  output: unknown;
  explanation?: string;
}

export interface ICodingProblem {
  id: string;
  title: string;
  slug: string;
  description: string;
  difficulty: CodingDifficulty;
  topic: string;
  examples: ICodingProblemExample[];
  constraints: string[];
  codeJs: string;
  codeTs: string;
  codePy: string;
}
