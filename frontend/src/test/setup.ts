import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Workaround when Vitest loads app code with SSR-like transform (Vite 8 beta or config)
(globalThis as unknown as Record<string, unknown>).__vite_ssr_exportName__ = function (
  exports: unknown,
  name: string,
  getter: () => unknown
) {
  if (exports !== null && typeof exports === 'object') {
    try {
      Object.defineProperty(exports, name, { get: getter, enumerable: true });
    } catch { /* intentionally ignored */ }
  }
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Default fetch mock so AppProvider's session check doesn't hit the network.
// Tests can override with vi.mocked(fetch).mockResolvedValueOnce(...)
const defaultFetch = vi.fn().mockImplementation((url: string) => {
  if (typeof url === 'string' && url.includes('/api/auth/me/')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ authenticated: false }),
    } as Response);
  }
  return Promise.reject(new Error(`Unmocked fetch: ${url}`));
});

vi.stubGlobal('fetch', defaultFetch);
