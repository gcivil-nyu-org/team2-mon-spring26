import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks(); // restores spies created with vi.spyOn, clears all mocks
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
