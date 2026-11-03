import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { IPdfPageText } from './pdf-chunker.js';

export interface IPdfTextExtraction {
  pages: IPdfPageText[];
  pageCount: number;
}

export class PdfTextExtractor {
  async extract(
    buffer: Uint8Array,
    maxPages: number,
    maxExtractedChars = 1_000_000
  ): Promise<IPdfTextExtraction> {
    if (!Number.isInteger(maxPages) || maxPages < 1) {
      throw new Error('PDF page limit must be a positive integer');
    }

    let loadingTask: ReturnType<typeof getDocument> | undefined;
    try {
      loadingTask = getDocument({
        data: Uint8Array.from(buffer),
        isEvalSupported: false,
        useSystemFonts: true,
        verbosity: 0,
      });
      const document = await loadingTask.promise;
      if (document.numPages > maxPages) {
        throw new Error(`PDF exceeds the ${maxPages} page limit`);
      }

      const pages: IPdfPageText[] = [];
      let extractedChars = 0;
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        const content = await page.getTextContent();
        const text = content.items
          .map((item) => ('str' in item ? item.str : ''))
          .filter(Boolean)
          .join(' ')
          .replace(/\s+/gu, ' ')
          .trim();
        extractedChars += text.length;
        if (extractedChars > maxExtractedChars) {
          throw new Error('PDF exceeds the extracted text limit');
        }
        if (text) pages.push({ page: pageNumber, text });
        page.cleanup();
      }

      if (pages.length === 0) throw new Error('PDF contains no extractable text');
      return { pages, pageCount: document.numPages };
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.startsWith('PDF exceeds the ') ||
          error.message === 'PDF contains no extractable text' ||
          error.message === 'PDF exceeds the extracted text limit' ||
          error.message === 'PDF page limit must be a positive integer')
      ) {
        throw error;
      }
      throw new Error('PDF could not be parsed', { cause: error });
    } finally {
      await loadingTask?.destroy();
    }
  }
}
