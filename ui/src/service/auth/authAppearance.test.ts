import { describe, expect, it } from 'vitest';

import { authAppearance } from './authAppearance';

describe('authAppearance', () => {
  it('uses labeled provider buttons to match the reference auth layout', () => {
    expect(authAppearance.layout.socialButtonsVariant).toBe('blockButton');
  });

  it('uses shared theme tokens for Clerk surfaces and text', () => {
    expect(authAppearance.variables).toMatchObject({
      colorPrimary: 'var(--prepai-accent)',
      colorForeground: 'var(--text)',
      colorMutedForeground: 'var(--dim)',
      colorBackground: 'var(--card)',
      colorInput: 'var(--bg2)',
      colorInputForeground: 'var(--text)',
    });
    expect(authAppearance.elements.headerTitle).toContain('text-[var(--text-h)]');
    expect(authAppearance.elements.formFieldInput).toContain('bg-[var(--bg2)]');
    expect(authAppearance.elements.formButtonPrimary).toContain('prepai-auth-primary-button');
    expect(authAppearance.elements.formButtonPrimary).toContain('bg-[var(--prepai-accent)]');
    expect(authAppearance.elements.formButtonPrimary).toContain('text-[var(--accent-foreground)]');
    expect(authAppearance.elements.alert).toContain('text-[var(--danger-strong)]');
  });
});
