import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

import { PdfLibrary } from '@/components/pdf/PdfLibrary';
import { usePdfContentReader, usePdfDeleteCommand, usePdfSourcesReader } from '@/logic';

interface IPdfContentState {
  sourceId: string | null;
  status: 'idle' | 'loading' | 'ready' | 'failed';
  url: string | null;
  error: string | null;
}

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'The PDF preview could not be loaded.';

export const LibraryPage = () => {
  const loadPdfContent = usePdfContentReader();
  const sourcesQuery = usePdfSourcesReader();
  const deleteCommand = usePdfDeleteCommand();
  const [searchParams, setSearchParams] = useSearchParams();
  const [retryCount, setRetryCount] = useState(0);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [contentState, setContentState] = useState<IPdfContentState>({
    sourceId: null,
    status: 'idle',
    url: null,
    error: null,
  });
  const sources = (sourcesQuery.data ?? []).filter((source) => source.status === 'ready');
  const selectedId = searchParams.get('pdfId');
  const pageFromUrl = Number(searchParams.get('page'));
  const initialPage = Number.isInteger(pageFromUrl) && pageFromUrl > 0 ? pageFromUrl : 1;
  const selectedSource = sources.find((source) => source.id === selectedId) ?? null;

  useEffect(() => {
    if (!sourcesQuery.isPending && !sourcesQuery.isError && selectedId && !selectedSource) {
      setSearchParams({}, { replace: true });
    }
  }, [selectedId, selectedSource, setSearchParams, sourcesQuery.isError, sourcesQuery.isPending]);

  useEffect(() => {
    if (!selectedSource) {
      setContentState({ sourceId: null, status: 'idle', url: null, error: null });
      return;
    }

    let active = true;
    let objectUrl: string | null = null;
    setContentState({ sourceId: selectedSource.id, status: 'loading', url: null, error: null });

    void loadPdfContent(selectedSource.id)
      .then((blob) => {
        if (blob.type && blob.type !== 'application/pdf') {
          throw new Error('The server returned a file that is not a PDF.');
        }
        const url = URL.createObjectURL(blob);
        objectUrl = url;
        if (active) {
          setContentState({ sourceId: selectedSource.id, status: 'ready', url, error: null });
        } else {
          URL.revokeObjectURL(url);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setContentState({
            sourceId: selectedSource.id,
            status: 'failed',
            url: null,
            error: getErrorMessage(error),
          });
        }
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [loadPdfContent, retryCount, selectedSource?.id]);

  const matchingContent = contentState.sourceId === selectedSource?.id;
  const contentLoading =
    Boolean(selectedSource) && (!matchingContent || contentState.status === 'loading');
  const deleteSources = async (pdfIds: string[]): Promise<boolean> => {
    setDeleteError(null);
    const results = await Promise.allSettled(
      pdfIds.map((pdfId) => deleteCommand.mutateAsync({ pdfId }))
    );
    if (results.some((result) => result.status === 'rejected')) {
      const failed = results.find((result) => result.status === 'rejected');
      setDeleteError(
        failed?.status === 'rejected'
          ? getErrorMessage(failed.reason)
          : 'Some selected PDFs could not be deleted. Refresh the Library and try again.'
      );
      void sourcesQuery.refetch();
      return false;
    }
    return true;
  };

  return (
    <PdfLibrary
      sources={sources}
      selectedSource={selectedSource}
      isLoading={sourcesQuery.isPending}
      listError={sourcesQuery.isError ? getErrorMessage(sourcesQuery.error) : null}
      contentUrl={matchingContent && contentState.status === 'ready' ? contentState.url : null}
      contentLoading={contentLoading}
      contentError={matchingContent && contentState.status === 'failed' ? contentState.error : null}
      initialPage={initialPage}
      onSelectSource={(pdfId) => setSearchParams({ pdfId, page: '1' })}
      onBackToList={() => setSearchParams({})}
      onRetryList={() => void sourcesQuery.refetch()}
      onRetryContent={() => setRetryCount((current) => current + 1)}
      onDeleteSources={deleteSources}
      deleteError={deleteError}
      isDeleting={deleteCommand.isPending}
    />
  );
};
