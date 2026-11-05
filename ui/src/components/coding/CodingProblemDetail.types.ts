import type { ICodingProblem } from '@/core';

export interface ICodingProblemDetailProps {
  problem: ICodingProblem;
  onBack: () => void;
}
