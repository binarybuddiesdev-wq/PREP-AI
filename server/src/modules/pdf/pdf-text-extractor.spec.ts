import { describe, expect, it } from 'vitest';
import { PdfTextExtractor } from './pdf-text-extractor.js';

function createTextPdf(pages: string[]): Buffer {
  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pages.map((_, index) => `${3 + index * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`,
  ];

  pages.forEach((text, index) => {
    const pageObject = 3 + index * 2;
    const contentObject = pageObject + 1;
    const escapedText = text.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
    const stream =
      text === '__MARKED_CONTENT__'
        ? '/Span BMC EMC'
        : `BT /F1 12 Tf 72 720 Td (${escapedText}) Tj ET`;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents ${contentObject} 0 R >>`,
      `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
    );
  });

  let document = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(document));
    document += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(document);
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  document += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('');
  document += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(document);
}

describe('PdfTextExtractor', () => {
  const extractor = new PdfTextExtractor();

  it('extracts page text with stable page numbers', async () => {
    const result = await extractor.extract(
      createTextPdf(['First page material', 'Second page material']),
      10
    );

    expect(result).toEqual({
      pageCount: 2,
      pages: [
        { page: 1, text: 'First page material' },
        { page: 2, text: 'Second page material' },
      ],
    });
  });

  it('rejects malformed PDFs and documents over the page bound', async () => {
    await expect(extractor.extract(createTextPdf(['One']), 0)).rejects.toThrow(
      'PDF page limit must be a positive integer'
    );
    await expect(extractor.extract(Buffer.from('not pdf'), 10)).rejects.toThrow(
      'PDF could not be parsed'
    );
    await expect(extractor.extract(createTextPdf(['One', 'Two']), 1)).rejects.toThrow(
      'PDF exceeds the 1 page limit'
    );
  });

  it('rejects documents without extractable text', async () => {
    await expect(extractor.extract(createTextPdf(['   ']), 10)).rejects.toThrow(
      'PDF contains no extractable text'
    );
    await expect(extractor.extract(createTextPdf(['__MARKED_CONTENT__']), 10)).rejects.toThrow(
      'PDF contains no extractable text'
    );
  });

  it('stops extraction when the configured aggregate text limit is exceeded', async () => {
    await expect(extractor.extract(createTextPdf(['more than five']), 10, 5)).rejects.toThrow(
      'PDF exceeds the extracted text limit'
    );
  });
});
