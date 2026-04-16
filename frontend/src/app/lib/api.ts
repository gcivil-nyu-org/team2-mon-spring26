/**
 * Shared API helpers used across all context providers.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000';

/** Build an absolute URL from a backend path. */
export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

/** Read the Django CSRF token from the csrftoken cookie. */
export function getCsrf(): string {
  const value = `; ${document.cookie}`;
  const parts = value.split('; csrftoken=');
  if (parts.length === 2) return parts.pop()?.split(';').shift() ?? '';
  return '';
}
