const ROOT_KEY = ['prepai', 'users'] as const;

export const userKeys = {
  all: ROOT_KEY,
  me: (userId: string) => [...ROOT_KEY, userId, 'me'] as const,
  settings: (userId: string) => [...ROOT_KEY, userId, 'settings'] as const,
};
