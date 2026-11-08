export interface IPdfPageText {
  page: number;
  text: string;
}

export interface IPdfChunk {
  chunkIndex: number;
  pageStart: number;
  pageEnd: number;
  text: string;
}

export interface IPdfChunkOptions {
  size: number;
  overlap: number;
}

const DEFAULT_OPTIONS: IPdfChunkOptions = { size: 512, overlap: 64 };

/**
 * Splits page text on whitespace-token boundaries. The page boundary is kept
 * so citations remain precise; the model adapter independently enforces its
 * context window before sending any chunk to a provider.
 */
export function chunkPdfPages(
  pages: IPdfPageText[],
  options: IPdfChunkOptions = DEFAULT_OPTIONS
): IPdfChunk[] {
  if (!Number.isInteger(options.size) || options.size < 1) {
    throw new Error('Chunk size must be a positive integer');
  }
  if (!Number.isInteger(options.overlap) || options.overlap < 0) {
    throw new Error('Chunk overlap must be a non-negative integer');
  }
  if (options.overlap >= options.size) {
    throw new Error('Chunk overlap must be smaller than chunk size');
  }

  const chunks: IPdfChunk[] = [];
  const step = options.size - options.overlap;

  for (const page of pages) {
    const tokens = page.text
      .split(String.fromCharCode(0))
      .join(' ')
      .trim()
      .split(/\s+/u)
      .filter(Boolean);
    if (tokens.length === 0) continue;

    for (let offset = 0; offset < tokens.length; offset += step) {
      const text = tokens.slice(offset, offset + options.size).join(' ');
      chunks.push({
        chunkIndex: chunks.length,
        pageStart: page.page,
        pageEnd: page.page,
        text,
      });
      if (offset + options.size >= tokens.length) break;
    }
  }

  return chunks;
}
