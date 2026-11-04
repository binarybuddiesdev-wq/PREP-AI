import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

import { PdfLibrary } from '@/components/pdf/PdfLibrary';
import { usePdfContentReader, usePdfSourcesReader } from '@/logic';

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [retryCount, setRetryCount] = useState(0);
  const [contentState, setContentState] = useState<IPdfContentState>({
    sourceId: null,
    status: 'idle',
    url: null,
    error: null,
  });
  const sources = (sourcesQuery.data ?? []).filter((source) => source.status === 'ready');
  const selectedId = searchParams.get('pdfId');
  const selectedSource = sources.find((source) => source.id === selectedId) ?? null;

  useEffect(() => {
    if (sourcesQuery.isPending || sourcesQuery.isError) return;
    if (!selectedSource && sources.length > 0) {
      setSearchParams({ pdfId: sources[0]!.id }, { replace: true });
    } else if (selectedId && !selectedSource) {
      setSearchParams({}, { replace: true });
    }
  }, [
    selectedId,
    selectedSource,
    setSearchParams,
    sources,
    sourcesQuery.isError,
    sourcesQuery.isPending,
  ]);

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

  return (
    <PdfLibrary
      sources={sources}
      selectedSource={selectedSource}
      isLoading={sourcesQuery.isPending}
      listError={sourcesQuery.isError ? getErrorMessage(sourcesQuery.error) : null}
      contentUrl={matchingContent && contentState.status === 'ready' ? contentState.url : null}
      contentLoading={contentLoading}
      contentError={matchingContent && contentState.status === 'failed' ? contentState.error : null}
      onSelectSource={(pdfId) => setSearchParams({ pdfId })}
      onRetryList={() => void sourcesQuery.refetch()}
      onRetryContent={() => setRetryCount((current) => current + 1)}
    />
  );
};
