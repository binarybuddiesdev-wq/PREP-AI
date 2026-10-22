const ROOT_KEY = ['prepai', 'users'] as const;

export const userKeys = {
  all: ROOT_KEY,
  me: () => [...ROOT_KEY, 'me'] as const,
  settings: () => [...ROOT_KEY, 'settings'] as const,
};
