import { describe, expect, it } from 'vitest';
import { isNewerProviderSnapshot } from './provider-snapshot.js';

describe('provider snapshot ordering', () => {
  const stored = new Date('2026-11-04T12:00:05.000Z');

  it('applies a strictly newer provider state', () => {
    expect(isNewerProviderSnapshot(stored, new Date('2026-11-04T12:00:06.000Z'))).toBe(true);
  });

  it('does not overwrite with an older, same-time, or unversioned snapshot', () => {
    expect(isNewerProviderSnapshot(stored, new Date('2026-11-04T12:00:04.000Z'))).toBe(false);
    expect(isNewerProviderSnapshot(stored, stored)).toBe(false);
    expect(isNewerProviderSnapshot(stored, null)).toBe(false);
  });

  it('accepts the first provider snapshot when no version was stored yet', () => {
    expect(isNewerProviderSnapshot(null, null)).toBe(true);
  });
});
