import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CodingInputArguments } from './CodingInputArguments';

describe('CodingInputArguments', () => {
  it('formats positional inputs with readable JSON spacing', () => {
    render(<CodingInputArguments ariaLabel="Input" value={[[2, 7], 9]} />);

    expect(screen.getByRole('group', { name: 'Input' })).toHaveTextContent('[2, 7], 9');
  });

  it('labels named arguments while preserving their order', () => {
    render(
      <CodingInputArguments
        ariaLabel="Input"
        argumentNames={['numbers', 'target']}
        value={[[2, 7], 9]}
      />
    );

    expect(screen.getByRole('group', { name: 'Input' })).toHaveTextContent(
      'numbers = [2, 7], target = 9'
    );
  });

  it('renders the empty-arguments explanation for an empty list', () => {
    render(<CodingInputArguments ariaLabel="Input" value={[]} />);

    expect(screen.getByText('No input arguments')).toBeVisible();
  });

  it('renders primitive null and string values instead of dropping them', () => {
    const { rerender } = render(<CodingInputArguments ariaLabel="Input" value={null} />);
    expect(screen.getByRole('group', { name: 'Input' })).toHaveTextContent('null');

    rerender(<CodingInputArguments ariaLabel="Input" value={'two sum'} />);
    expect(screen.getByRole('group', { name: 'Input' })).toHaveTextContent('"two sum"');
  });

  it('applies truncation semantics only when requested', () => {
    const { rerender } = render(
      <CodingInputArguments ariaLabel="Input" value={[1, 2]} isTruncated />
    );
    expect(screen.getByRole('group', { name: 'Input' })).toHaveClass('truncate');

    rerender(<CodingInputArguments ariaLabel="Input" value={[1, 2]} />);
    expect(screen.getByRole('group', { name: 'Input' })).not.toHaveClass('truncate');
  });
});
