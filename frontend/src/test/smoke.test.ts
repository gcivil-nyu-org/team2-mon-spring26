/**
 * Smoke test: confirms Vitest and jsdom are correctly configured.
 */
import { describe, it, expect } from 'vitest';

describe('test environment', () => {
  it('runs with globals and jsdom', () => {
    expect(typeof window).toBe('object');
    expect(typeof document).toBe('object');
  });
});
