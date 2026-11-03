import { BadRequestException } from '@nestjs/common';

const PDF_SIGNATURE = Buffer.from('%PDF-');
const MAX_FILENAME_LENGTH = 180;

export function validatePdfUpload(
  buffer: Buffer,
  filename: string,
  mimetype: string,
  maxBytes: number
): { displayName: string; byteSize: number } {
  if (buffer.byteLength === 0) throw new BadRequestException('PDF file is empty');
  if (buffer.byteLength > maxBytes) {
    throw new BadRequestException(`PDF exceeds the ${maxBytes} byte limit`);
  }
  if (mimetype.toLowerCase() !== 'application/pdf' || !filename.toLowerCase().endsWith('.pdf')) {
    throw new BadRequestException('Only PDF files are supported');
  }
  if (!buffer.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE)) {
    throw new BadRequestException('Upload must contain a valid PDF file');
  }

  const cleanFilename = filename
    .split(/[\\/]/u)
    .pop()!
    .split('')
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join('');
  const displayName = cleanFilename.trim().slice(0, MAX_FILENAME_LENGTH);
  if (!displayName) throw new BadRequestException('PDF filename is invalid');
  return { displayName, byteSize: buffer.byteLength };
}
