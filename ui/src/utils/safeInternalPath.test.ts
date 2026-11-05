import { describe, expect, it } from 'vitest';

import { safeInternalPath } from './safeInternalPath';

describe('safeInternalPath', () => {
  it.each(['/dashboard', '/dashboard?tab=practice', '/dashboard#today'])(
    'accepts a same-origin app path: %s',
    (path) => {
      expect(safeInternalPath(path, 'https://prepai.test')).toBe(path);
    }
  );

  it.each(['https://example.com', '//example.com', '/\\example.com', 'javascript:alert(1)', null])(
    'rejects an unsafe destination: %s',
    (path) => {
      expect(safeInternalPath(path, 'https://prepai.test')).toBeNull();
    }
  );
});
