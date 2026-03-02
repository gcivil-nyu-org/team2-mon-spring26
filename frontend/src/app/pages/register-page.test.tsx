/**
 * Register page tests.
 *
 * Run: npm run test:run (from frontend/)
 *
 * Note: Under Vite 8 beta + Vitest, component tests may fail due to environment
 * (SSR-like transform), not due to this code. Use Vite 5 for tests or fix config;
 * see docs/TEST_RESULTS.md.
 */
import type { ReactElement } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { AppProvider } from '@/app/contexts/app-context';
import { VenueProvider } from '@/app/contexts/venue-context';
import { RegisterPage } from './register-page';

function renderWithProviders(ui: ReactElement, initialRoute = '/register') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <AppProvider>
        <VenueProvider>{ui}</VenueProvider>
      </AppProvider>
    </MemoryRouter>
  );
}

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/api/auth/me/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ authenticated: false }),
        } as Response);
      }
      if (typeof url === 'string' && url.includes('/api/auth/register/')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              user: { id: '1', email: 'new@nyu.edu', name: 'New User' },
            }),
        } as Response);
      }
      return Promise.reject(new Error(`Unmocked fetch: ${url}`));
    });
  });

  it('renders account step with name, email, password fields', () => {
    renderWithProviders(<RegisterPage />);
    expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /full name/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /nyu email/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows validation error when name is empty', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />);
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
  });

  it('shows validation error for invalid email', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />);
    await user.type(screen.getByRole('textbox', { name: /full name/i }), 'Jane Doe');
    await user.type(screen.getByRole('textbox', { name: /nyu email/i }), 'not-an-email');
    await user.type(screen.getByLabelText(/^password$/i), 'ValidPass1!');
    await user.type(screen.getByLabelText(/confirm password/i), 'ValidPass1!');
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
  });

  it('shows validation error when password is too short', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />);
    await user.type(screen.getByRole('textbox', { name: /full name/i }), 'Jane Doe');
    await user.type(screen.getByRole('textbox', { name: /nyu email/i }), 'jane@nyu.edu');
    await user.type(screen.getByLabelText(/^password$/i), '12345');
    await user.type(screen.getByLabelText(/confirm password/i), '12345');
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(await screen.findByText(/at least 6 characters/i)).toBeInTheDocument();
  });

  it('shows validation error when passwords do not match', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />);
    await user.type(screen.getByRole('textbox', { name: /full name/i }), 'Jane Doe');
    await user.type(screen.getByRole('textbox', { name: /nyu email/i }), 'jane@nyu.edu');
    await user.type(screen.getByLabelText(/^password$/i), 'ValidPass1!');
    await user.type(screen.getByLabelText(/confirm password/i), 'DifferentPass1!');
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
  });

  it('moves to preferences step when account form is valid', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />);
    await user.type(screen.getByRole('textbox', { name: /full name/i }), 'Jane Doe');
    await user.type(screen.getByRole('textbox', { name: /nyu email/i }), 'jane@nyu.edu');
    await user.type(screen.getByLabelText(/^password$/i), 'ValidPass1!');
    await user.type(screen.getByLabelText(/confirm password/i), 'ValidPass1!');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(await screen.findByRole('heading', { name: /set your preferences/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /complete registration/i })).toBeInTheDocument();
  });

  it('shows registration error when API returns error', async () => {
    vi.mocked(fetch).mockImplementation((url: string) => {
      if (url.includes('/api/auth/me/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ authenticated: false }),
        } as Response);
      }
      if (url.includes('/api/auth/register/')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: false,
              errors: { email: ['A user with that email already exists.'] },
            }),
        } as Response);
      }
      return Promise.reject(new Error(`Unmocked: ${url}`));
    });

    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />);
    await user.type(screen.getByRole('textbox', { name: /full name/i }), 'Jane Doe');
    await user.type(screen.getByRole('textbox', { name: /nyu email/i }), 'jane@nyu.edu');
    await user.type(screen.getByLabelText(/^password$/i), 'ValidPass1!');
    await user.type(screen.getByLabelText(/confirm password/i), 'ValidPass1!');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    await screen.findByRole('heading', { name: /set your preferences/i });
    await user.click(screen.getByRole('button', { name: /complete registration/i }));

    expect(await screen.findByText(/already exists|registration failed/i)).toBeInTheDocument();
  });
});
