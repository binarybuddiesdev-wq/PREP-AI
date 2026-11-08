import { useEffect, useRef } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const editorMocks = vi.hoisted(() => ({
  layout: vi.fn(),
  getContainerDomNode: vi.fn(),
}));

vi.mock('@monaco-editor/react', () => ({
  default: (props: {
    onMount?: (editor: {
      layout: typeof editorMocks.layout;
      getContainerDomNode: typeof editorMocks.getContainerDomNode;
    }) => void;
  }) => {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
      if (ref.current) props.onMount?.(editorMocks);
    }, [props.onMount]);
    return <div ref={ref} data-testid="monaco-editor" />;
  },
  loader: { config: vi.fn() },
}));

import { MonacoCodeEditor } from './MonacoCodeEditor';

describe('MonacoCodeEditor', () => {
  it('lays out the editor to its visible host when Monaco mounts', () => {
    const host = document.createElement('div');
    host.getBoundingClientRect = vi.fn(() => ({ width: 640, height: 480 }) as DOMRect);
    editorMocks.getContainerDomNode.mockReturnValue({ parentElement: host });

    render(<MonacoCodeEditor language="javascript" value="const answer = 1;" onChange={vi.fn()} />);

    expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    expect(editorMocks.layout).toHaveBeenCalledWith({ width: 640, height: 480 });
  });
});
