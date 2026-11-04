export interface IPracticePolicy {
  isPremium: boolean;
  totalQuestions: 10 | 30;
}

export const getPracticePolicy = (role: string): IPracticePolicy => {
  const isPremium = role === 'PREMIUM' || role === 'ADMIN';

  return {
    isPremium,
    totalQuestions: isPremium ? 30 : 10,
  };
};
