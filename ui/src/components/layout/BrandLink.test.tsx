import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { BrandLink } from './BrandLink';

describe('BrandLink', () => {
  it.each([
    ['small', '/dashboard', 'text-lg'],
    ['large', '/', 'text-xl'],
  ] as const)('renders the %s branded route link', (size, path, sizeClass) => {
    render(
      <MemoryRouter>
        <BrandLink size={size} to={path} />
      </MemoryRouter>
    );

    const link = screen.getByRole('link', { name: 'PrepAI' });
    expect(link).toHaveAttribute('href', path);
    expect(link).toHaveClass(sizeClass);
    expect(screen.getByText('P')).toBeVisible();
  });

  it('defaults to the compact size', () => {
    render(
      <MemoryRouter>
        <BrandLink to="/" />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: 'PrepAI' })).toHaveClass('text-lg');
  });
});
