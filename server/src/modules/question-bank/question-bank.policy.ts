export type TQuestionBankKind = 'theory' | 'coding';

export type TTheoryDifficulty = 'Junior' | 'Mid' | 'Senior';
export type TCodingDifficulty = 'Easy' | 'Medium' | 'Hard';

export interface IQuestionBankPolicy {
  target: number;
  lowWater: number;
  batchSize: number;
  difficulties: readonly string[];
}

const policies: Record<TQuestionBankKind, IQuestionBankPolicy> = {
  theory: {
    target: 50,
    lowWater: 20,
    batchSize: 10,
    difficulties: ['Junior', 'Mid', 'Senior'],
  },
  coding: {
    target: 20,
    lowWater: 8,
    batchSize: 1,
    difficulties: ['Easy', 'Medium', 'Hard'],
  },
};

export const getQuestionBankPolicy = (kind: TQuestionBankKind): IQuestionBankPolicy =>
  policies[kind];
