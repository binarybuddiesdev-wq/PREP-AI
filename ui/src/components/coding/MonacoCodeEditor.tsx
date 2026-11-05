import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import EditorWorker from '../../../node_modules/monaco-editor/esm/vs/editor/editor.worker.js?worker';
import TsWorker from '../../../node_modules/monaco-editor/esm/vs/language/typescript/ts.worker.js?worker';

import type { ICodingEditorProps } from './CodingEditor.types';

self.MonacoEnvironment = {
  getWorker(_moduleId, label) {
    return label === 'typescript' || label === 'javascript' ? new TsWorker() : new EditorWorker();
  },
};

loader.config({ monaco });

const languageId = {
  javascript: 'javascript',
  typescript: 'typescript',
  python: 'python',
} as const;

export const MonacoCodeEditor = (props: ICodingEditorProps) => {
  const { language, value, onChange } = props;

  return (
    <Editor
      aria-label="Code editor"
      height="100%"
      language={languageId[language]}
      value={value}
      onChange={(nextValue) => onChange(nextValue ?? '')}
      theme="vs-dark"
      options={{
        automaticLayout: true,
        fontFamily: 'JetBrains Mono, Consolas, monospace',
        fontSize: 13,
        lineHeight: 21,
        minimap: { enabled: false },
        padding: { top: 12, bottom: 12 },
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        tabSize: language === 'python' ? 4 : 2,
        wordWrap: 'on',
      }}
    />
  );
};
