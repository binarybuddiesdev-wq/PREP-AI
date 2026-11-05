import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { ICodingProblem } from '@/core';
import { CodingProblemWorkspace } from './CodingProblemWorkspace';

vi.mock('./CodingEditor', () => ({
  CodingEditor: (props: { value: string; language: string; onChange: (value: string) => void }) => {
    const [value, setValue] = useState(props.value);
    return (
      <textarea
        aria-label="Code editor"
        data-language={props.language}
        value={value}
        onChange={(event) => {
          setValue(event.currentTarget.value);
          props.onChange(event.currentTarget.value);
        }}
      />
    );
  },
}));

const problem: ICodingProblem = {
  id: 'problem-one',
  title: 'Two Sum',
  slug: 'two-sum',
  description: 'Find two values that add to the target.',
  difficulty: 'Easy',
  topic: 'Arrays',
  examples: [{ input: [[2, 7], 9], output: [0, 1] }],
  constraints: ['Two values exist.'],
  codeJs: 'function twoSum() {}',
  codeTs: 'function twoSum(): number[] { return []; }',
  codePy: 'def two_sum():\n    pass',
};

const createProps = () => ({
  problem,
  language: 'javascript' as const,
  code: problem.codeJs,
  outputTab: 'output' as const,
  isProblemCollapsed: false,
  isFullscreen: false,
  onBack: vi.fn(),
  onLanguageChange: vi.fn(),
  onCodeChange: vi.fn(),
  onResetCode: vi.fn(),
  onOutputTabChange: vi.fn(),
  onToggleProblem: vi.fn(),
  onToggleFullscreen: vi.fn(),
});

describe('CodingProblemWorkspace', () => {
  it('exposes the selected language, starter code, and editable code changes', async () => {
    const user = userEvent.setup();
    const props = createProps();
    render(<CodingProblemWorkspace {...props} />);

    const language = screen.getByRole('combobox', { name: 'Programming language' });
    expect(language).toHaveValue('javascript');
    expect(screen.getByText('twoSum.js')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Code editor' })).toHaveValue(problem.codeJs);
    await user.selectOptions(language, 'typescript');
    expect(props.onLanguageChange).toHaveBeenCalledWith('typescript');

    await user.clear(screen.getByRole('textbox', { name: 'Code editor' }));
    await user.type(screen.getByRole('textbox', { name: 'Code editor' }), 'let answer = 2;');
    expect(props.onCodeChange).toHaveBeenLastCalledWith('let answer = 2;');
  });

  it('emits reset, output tab, collapse, and fullscreen actions', async () => {
    const user = userEvent.setup();
    const props = createProps();
    render(<CodingProblemWorkspace {...props} />);

    await user.click(screen.getByRole('button', { name: 'Reset code' }));
    await user.click(screen.getByRole('tab', { name: 'Test cases' }));
    await user.click(screen.getByRole('button', { name: 'Hide problem description' }));
    await user.click(screen.getByRole('button', { name: 'Enter fullscreen editor' }));

    expect(props.onResetCode).toHaveBeenCalledOnce();
    expect(props.onOutputTabChange).toHaveBeenCalledWith('testcases');
    expect(props.onToggleProblem).toHaveBeenCalledOnce();
    expect(props.onToggleFullscreen).toHaveBeenCalledOnce();
  });

  it('shows honest empty states for output and for a collapsed problem panel', async () => {
    const user = userEvent.setup();
    const props = createProps();
    const { rerender } = render(<CodingProblemWorkspace {...props} />);
    expect(screen.getByText('Run your code to see output.')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Test cases' }));
    expect(props.onOutputTabChange).toHaveBeenCalledWith('testcases');
    rerender(<CodingProblemWorkspace {...props} outputTab="testcases" />);
    expect(screen.getByText('Run your code to inspect each test case.')).toBeInTheDocument();

    rerender(<CodingProblemWorkspace {...props} isProblemCollapsed />);
    expect(screen.queryByText(problem.description)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show problem description' })).toBeInTheDocument();
  });

  it('keeps the problem panel available in the fullscreen workspace', () => {
    const props = { ...createProps(), isFullscreen: true };
    render(<CodingProblemWorkspace {...props} />);

    expect(screen.getByRole('dialog', { name: 'Fullscreen coding editor' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exit fullscreen editor' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('dialog', { name: 'Fullscreen coding editor' })).getByText(
        problem.title
      )
    ).toBeInTheDocument();
  });
});
