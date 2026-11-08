import { describe, expect, it } from 'vitest';
import { chunkPdfPages } from './pdf-chunker.js';

describe('chunkPdfPages', () => {
  it('keeps chunks within their source page and preserves page citations', () => {
    const chunks = chunkPdfPages(
      [
        { page: 1, text: 'alpha beta gamma delta epsilon zeta' },
        { page: 2, text: 'eta theta iota kappa lambda mu' },
      ],
      { size: 4, overlap: 1 }
    );

    expect(chunks).toEqual([
      { pageStart: 1, pageEnd: 1, chunkIndex: 0, text: 'alpha beta gamma delta' },
      { pageStart: 1, pageEnd: 1, chunkIndex: 1, text: 'delta epsilon zeta' },
      { pageStart: 2, pageEnd: 2, chunkIndex: 2, text: 'eta theta iota kappa' },
      { pageStart: 2, pageEnd: 2, chunkIndex: 3, text: 'kappa lambda mu' },
    ]);
  });

  it('removes embedded NUL characters from chunks stored as PostgreSQL text', () => {
    const chunks = chunkPdfPages([{ page: 1, text: 'First\u0000 page material' }]);

    expect(chunks).toEqual([
      { pageStart: 1, pageEnd: 1, chunkIndex: 0, text: 'First page material' },
    ]);
  });

  it('drops blank pages and rejects invalid chunk settings', () => {
    expect(chunkPdfPages([{ page: 1, text: '  \n\t ' }])).toEqual([]);
    expect(() => chunkPdfPages([], { size: 0, overlap: 0 })).toThrow(
      'Chunk size must be a positive integer'
    );
    expect(() => chunkPdfPages([], { size: 2, overlap: -1 })).toThrow(
      'Chunk overlap must be a non-negative integer'
    );
    expect(() => chunkPdfPages([], { size: 2, overlap: 2 })).toThrow(
      'Chunk overlap must be smaller than chunk size'
    );
  });
});
