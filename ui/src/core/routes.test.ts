import { describe, expect, it } from 'vitest';

import { APP_SHELL_ROUTES, codingProblemPath, ROUTES } from './routes';

describe('coding routes', () => {
  it('defines catalogue and deep-link routes within the authenticated app shell', () => {
    expect(ROUTES.coding).toBe('/coding');
    expect(ROUTES.codingProblem).toBe('/coding/:problemId');
    expect(APP_SHELL_ROUTES).toContain(ROUTES.coding);
    expect(codingProblemPath('two-sum')).toBe('/coding/two-sum');
    expect(codingProblemPath('problem one')).toBe('/coding/problem%20one');
  });
});
