/**
 * Login page tests.
 * Run: npm run test:run (from frontend/)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { LoginPage } from './login-page';

function getFetchUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return (input as Request).url;
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockImplementation((input: Parameters<typeof fetch>[0]) => {
      const url = getFetchUrl(input);
      if (url.includes('/api/auth/me/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ authenticated: false }),
        } as Response);
      }
      if (url.includes('/api/auth/login/')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              user: { id: '1', email: 'test@nyu.edu', name: 'Test User' },
            }),
        } as Response);
      }
      return Promise.reject(new Error(`Unmocked fetch: ${url}`));
    });
  });

  it('renders login form with title and main actions', async () => {
    render(<LoginPage />);
    expect(await screen.findByRole('heading', { name: /meal swipe/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /email/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create new account/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /forgot password/i })).toBeInTheDocument();
  });

  it('shows login error when credentials are invalid', async () => {
    vi.mocked(fetch).mockImplementation((input: Parameters<typeof fetch>[0]) => {
      const url = getFetchUrl(input);
      if (url.includes('/api/auth/me/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ authenticated: false }),
        } as Response);
      }
      if (url.includes('/api/auth/login/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: false, error: 'Invalid credentials' }),
        } as Response);
      }
      return Promise.reject(new Error(`Unmocked: ${url}`));
    });

    const user = userEvent.setup();
    render(<LoginPage />);
    const email = await screen.findByRole('textbox', { name: /email/i });
    const password = screen.getByLabelText(/password/i);
    await user.clear(email);
    await user.type(email, 'wrong@nyu.edu');
    await user.type(password, 'wrongpass');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/invalid email or password/i)).toBeInTheDocument();
  });

  it('opens forgot password dialog when Forgot Password is clicked', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.click(await screen.findByRole('button', { name: /forgot password/i }));

    const dialog = screen.getByRole('dialog', { name: /forgot password/i });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByPlaceholderText(/your\.email@nyu\.edu/i)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
  });

  it('shows validation message when reset is submitted without email', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.click(await screen.findByRole('button', { name: /forgot password/i }));

    const dialog = screen.getByRole('dialog', { name: /forgot password/i });
    await user.click(within(dialog).getByRole('button', { name: /send reset link/i }));

    expect(await within(dialog).findByText(/Please enter your email address/i)).toBeInTheDocument();
  });

  it('shows success message after password reset request', async () => {
    vi.mocked(fetch).mockImplementation((input: Parameters<typeof fetch>[0]) => {
      const url = getFetchUrl(input);
      if (url.includes('/api/auth/me/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ authenticated: false }),
        } as Response);
      }
      if (url.includes('/api/auth/request-password-reset/')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              message: 'If an account exists, a reset link has been sent.',
            }),
        } as Response);
      }
      return Promise.reject(new Error(`Unmocked: ${url}`));
    });

    const user = userEvent.setup();
    render(<LoginPage />);
    await user.click(await screen.findByRole('button', { name: /forgot password/i }));

    const dialog = screen.getByRole('dialog', { name: /forgot password/i });
    await user.type(within(dialog).getByPlaceholderText(/your\.email@nyu\.edu/i), 'user@nyu.edu');
    await user.click(within(dialog).getByRole('button', { name: /send reset link/i }));

    expect(await within(dialog).findByText(/check your email/i)).toBeInTheDocument();
  });
});
