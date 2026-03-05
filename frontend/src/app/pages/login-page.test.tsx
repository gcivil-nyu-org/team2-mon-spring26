/**
 * Login page tests.
 *
 * Run: npm run test:run (from frontend/)
 *
 * Note: Under Vite 8 beta + Vitest, loading app code can trigger SSR-like transform
 * and cause __vite_ssr_exportName__ or undefined component errors. This is an
 * environment/configuration issue, not a bug in this test or app code. To run
 * these tests: use Vite 5 for tests (set "vite": "^5.4.11" in devDependencies) or
 * configure Vitest to disable SSR transform for tests. See docs/TEST_RESULTS.md.
 */
import type { ReactElement } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { AppProvider } from '@/app/contexts/app-context';
import { VenueProvider } from '@/app/contexts/venue-context';
import { LoginPage } from './login-page';

function renderWithProviders(ui: ReactElement) {
  return render(
    <MemoryRouter>
      <AppProvider>
        <VenueProvider>{ui}</VenueProvider>
      </AppProvider>
    </MemoryRouter>
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/api/auth/me/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ authenticated: false }),
        } as Response);
      }
      if (typeof url === 'string' && url.includes('/api/auth/login/')) {
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

  it('renders login form with title and main actions', () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByRole('heading', { name: /meal swipe/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /email/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create new account/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /forgot password/i })).toBeInTheDocument();
  });

  it('shows login error when credentials are invalid', async () => {
    vi.mocked(fetch).mockImplementation((url: string) => {
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
    renderWithProviders(<LoginPage />);
    const email = screen.getByRole('textbox', { name: /email/i });
    const password = screen.getByLabelText(/password/i);
    await user.clear(email);
    await user.type(email, 'wrong@nyu.edu');
    await user.type(password, 'wrongpass');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/invalid credentials|login failed/i)).toBeInTheDocument();
  });

  it('opens forgot password dialog when Forgot Password is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);
    await user.click(screen.getByRole('button', { name: /forgot password/i }));

    expect(screen.getByRole('dialog', { name: /forgot password/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/your\.email@nyu\.edu/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
  });

  it('shows validation message when reset is submitted without email', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);
    await user.click(screen.getByRole('button', { name: /forgot password/i }));

    const dialog = screen.getByRole('dialog', { name: /forgot password/i });
    await user.click(within(dialog).getByRole('button', { name: /send reset link/i }));

    expect(await within(dialog).findByText(/enter your email|email is required/i)).toBeInTheDocument();
  });

  it('shows success message after password reset request', async () => {
    vi.mocked(fetch).mockImplementation((url: string) => {
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
    renderWithProviders(<LoginPage />);
    await user.click(screen.getByRole('button', { name: /forgot password/i }));

    const dialog = screen.getByRole('dialog', { name: /forgot password/i });
    await user.type(within(dialog).getByPlaceholderText(/your\.email@nyu\.edu/i), 'user@nyu.edu');
    await user.click(within(dialog).getByRole('button', { name: /send reset link/i }));

    expect(await within(dialog).findByText(/check your email/i)).toBeInTheDocument();
  });
});
