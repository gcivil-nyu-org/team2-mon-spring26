/**
 * Minimal smoke test: Vitest and jsdom run; expect extensions work.
 * This passes even when full component tests hit Vite 8 beta SSR transform issues.
 */
import { describe, it, expect } from 'vitest';

describe('test environment', () => {
  it('runs with globals and jsdom', () => {
    expect(typeof window).toBe('object');
    expect(typeof document).toBe('object');
  });
});
