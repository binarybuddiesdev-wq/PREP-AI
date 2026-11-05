export const createStudyChatIdempotencyKey = (): string => {
  const randomId = globalThis.crypto?.randomUUID?.();
  const fallbackId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `prep-study-chat-${randomId ?? fallbackId}`;
};
