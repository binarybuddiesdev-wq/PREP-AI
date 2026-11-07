import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CodingValue } from './CodingValue';

describe('CodingValue', () => {
  it.each([
    [null, 'null'],
    ['hello', '"hello"'],
    [{ nested: [1, 2] }, '{"nested": [1, 2]}'],
  ])('displays a readable representation of %s', (value, formatted) => {
    render(<CodingValue ariaLabel="Output" value={value} />);

    expect(screen.getByLabelText('Output')).toHaveTextContent(formatted);
  });

  it('uses the requested code color class', () => {
    render(<CodingValue ariaLabel="Output" value={42} className="text-emerald-400" />);

    expect(screen.getByLabelText('Output').querySelector('code')).toHaveClass('text-emerald-400');
  });
});
