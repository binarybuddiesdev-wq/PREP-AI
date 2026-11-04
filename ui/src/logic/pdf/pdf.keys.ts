const PDF_ROOT_KEY = ['prepai', 'pdf'] as const;

export const pdfKeys = {
  all: PDF_ROOT_KEY,
  user: (userId: string) => [...PDF_ROOT_KEY, userId] as const,
  list: (userId: string) => [...PDF_ROOT_KEY, userId, 'list'] as const,
  source: (userId: string, pdfId: string) => [...PDF_ROOT_KEY, userId, 'source', pdfId] as const,
};
