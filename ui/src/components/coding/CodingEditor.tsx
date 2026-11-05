import { lazy, Suspense } from 'react';

import type { ICodingEditorProps } from './CodingEditor.types';

const MonacoCodeEditor = lazy(() =>
  import('./MonacoCodeEditor').then((module) => ({ default: module.MonacoCodeEditor }))
);

export const CodingEditor = (props: ICodingEditorProps) => (
  <div className="h-full min-h-0 overflow-hidden bg-[#101012]">
    <Suspense
      fallback={
        <div
          role="status"
          className="flex h-full items-center justify-center text-xs text-zinc-500"
        >
          Loading code editor…
        </div>
      }
    >
      <MonacoCodeEditor {...props} />
    </Suspense>
  </div>
);
