import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LandingFooter } from './LandingFooter';

describe('LandingFooter', () => {
  it('shows the copyright year and reference footer labels', () => {
    render(<LandingFooter year={2026} />);

    expect(screen.getByText('© 2026 PrepAI')).toBeInTheDocument();
    expect(screen.getByLabelText('Company links')).toHaveTextContent('PrivacyTermsTwitterGitHub');
  });
});
