import { describe, it, expect } from 'vitest';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  const controller = new HealthController();

  it('should return status ok', () => {
    const result = controller.check();
    expect(result).toEqual({ status: 'ok' });
  });
});
