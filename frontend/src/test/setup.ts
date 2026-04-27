import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Node.js >= 22 ships a built-in `localStorage` global as an empty object that
// lacks Storage methods, and that broken object shadows jsdom's
// `window.localStorage`. Code calling `localStorage.removeItem(...)` therefore
// throws "is not a function". Replace both with a working in-memory Storage.
function createMemoryStorage(): Storage {
  let store: Record<string, string> = {};
  return {
    get length() {
      return Object.keys(store).length;
    },
    clear() {
      store = {};
    },
    getItem(key: string) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    key(index: number) {
      return Object.keys(store)[index] ?? null;
    },
    removeItem(key: string) {
      delete store[key];
    },
    setItem(key: string, value: string) {
      store[key] = String(value);
    },
  };
}

const memoryLocal = createMemoryStorage();
const memorySession = createMemoryStorage();

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: memoryLocal,
});
Object.defineProperty(globalThis, 'sessionStorage', {
  configurable: true,
  value: memorySession,
});
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: memoryLocal,
  });
  Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    value: memorySession,
  });
}

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
