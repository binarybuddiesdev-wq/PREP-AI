import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { CodingEditor } from './CodingEditor';

vi.mock('./MonacoCodeEditor', () => ({
  MonacoCodeEditor: (props: {
    value: string;
    language: string;
    onChange: (value: string) => void;
  }) => {
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

describe('CodingEditor', () => {
  it('loads the editor locally and reports edited code to the owner', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CodingEditor language="javascript" value="const answer = 1;" onChange={onChange} />);

    const editor = await screen.findByRole('textbox', { name: 'Code editor' });
    expect(editor).toHaveAttribute('data-language', 'javascript');
    expect(editor).toHaveValue('const answer = 1;');
    await user.clear(editor);
    await user.type(editor, 'const answer = 42;');

    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith('const answer = 42;'));
  });
});
