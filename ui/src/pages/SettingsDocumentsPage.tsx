import { useRef, useState } from 'react';
import { Link } from 'react-router';

import { PdfDocumentManager } from '@/components/pdf/PdfDocumentManager';
import { ROUTES } from '@/core';
import {
  usePdfDeleteCommand,
  usePdfReindexCommand,
  usePdfSourcesReader,
  usePdfUploadCommand,
} from '@/logic';

const MAX_PDF_BYTES = 10 * 1024 * 1024;

interface IUploadAttempt {
  file: File;
  idempotencyKey: string;
}

const createIdempotencyKey = () => {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong. Please try again.';

export const SettingsDocumentsPage = () => {
  const sourcesQuery = usePdfSourcesReader();
  const uploadCommand = usePdfUploadCommand();
  const reindexCommand = usePdfReindexCommand();
  const deleteCommand = usePdfDeleteCommand();
  const [uploadAttempt, setUploadAttempt] = useState<IUploadAttempt | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const reindexKeys = useRef(new Map<string, string>());

  const onFilesSelected = async (file: File) => {
    setValidationError(null);
    setUploadError(null);
    setUploadAttempt(null);

    if (
      !file.name.toLowerCase().endsWith('.pdf') ||
      file.type.toLowerCase() !== 'application/pdf'
    ) {
      setValidationError('Choose a PDF file with the application/pdf file type.');
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      setValidationError('This file is larger than the 10 MB upload limit.');
      return;
    }

    try {
      const signature = await file.slice(0, 5).text();
      if (signature !== '%PDF-') {
        setValidationError('This file does not have a valid PDF signature. Choose another PDF.');
        return;
      }
    } catch {
      setValidationError('The selected file could not be read. Choose it again and retry.');
      return;
    }

    setUploadAttempt({ file, idempotencyKey: createIdempotencyKey() });
  };

  const runUpload = (attempt: IUploadAttempt | null) => {
    if (!attempt) return;
    setUploadError(null);
    uploadCommand.mutate(
      {
        file: attempt.file,
        idempotencyKey: attempt.idempotencyKey,
      },
      {
        onSuccess: () => setUploadAttempt(null),
        onError: (error) => setUploadError(getErrorMessage(error)),
      }
    );
  };

  const onReindex = (pdfId: string) => {
    const idempotencyKey = reindexKeys.current.get(pdfId) ?? createIdempotencyKey();
    reindexKeys.current.set(pdfId, idempotencyKey);
    reindexCommand.mutate(
      { pdfId, idempotencyKey },
      { onSuccess: () => reindexKeys.current.delete(pdfId) }
    );
  };

  const onConfirmDelete = () => {
    if (!confirmingDeleteId) return;
    deleteCommand.mutate(
      { pdfId: confirmingDeleteId },
      { onSuccess: () => setConfirmingDeleteId(null) }
    );
  };

  return (
    <div className="space-y-5">
      <nav
        aria-label="Settings sections"
        className="flex items-center gap-2 text-xs text-[var(--dim)]"
      >
        <Link
          to={ROUTES.settings}
          className="text-[var(--text)] hover:text-[var(--accent-strong)] focus-visible:text-[var(--text-h)]"
        >
          Settings
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page" className="text-[var(--text-h)]">
          Documents
        </span>
      </nav>
      <PdfDocumentManager
        sources={sourcesQuery.data ?? []}
        isLoading={sourcesQuery.isPending}
        listError={sourcesQuery.isError ? getErrorMessage(sourcesQuery.error) : null}
        isUploading={uploadCommand.isPending}
        uploadFileName={uploadAttempt?.file.name ?? null}
        uploadError={uploadError}
        validationError={validationError}
        reindexingId={reindexCommand.isPending ? (reindexCommand.variables?.pdfId ?? null) : null}
        deletingId={deleteCommand.isPending ? (deleteCommand.variables?.pdfId ?? null) : null}
        confirmingDeleteId={confirmingDeleteId}
        actionError={
          reindexCommand.error
            ? getErrorMessage(reindexCommand.error)
            : deleteCommand.error
              ? getErrorMessage(deleteCommand.error)
              : null
        }
        onFilesSelected={(file) => void onFilesSelected(file)}
        onUpload={() => runUpload(uploadAttempt)}
        onRetryUpload={() => runUpload(uploadAttempt)}
        onRetryList={() => void sourcesQuery.refetch()}
        onReindex={onReindex}
        onRequestDelete={setConfirmingDeleteId}
        onCancelDelete={() => setConfirmingDeleteId(null)}
        onConfirmDelete={onConfirmDelete}
      />
    </div>
  );
};
