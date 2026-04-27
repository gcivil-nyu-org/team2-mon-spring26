import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router';
import { AdminUsersPage } from '../admin-users-page';

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...(actual as Record<string, unknown>),
    useNavigate: () => vi.fn(),
  };
});

const baseUser = {
  id: 1,
  username: 'alice_student',
  email: 'alice@test.local',
  firstName: 'Alice',
  lastName: 'Smith',
  name: 'Alice Smith',
  role: 'student' as const,
  phone: '',
  photoUrl: '',
  isActive: true,
  createdAt: '2025-01-01T00:00:00Z',
};

const inactiveUser = {
  ...baseUser,
  id: 2,
  username: 'bob_student',
  email: 'bob@test.local',
  firstName: 'Bob',
  lastName: 'Jones',
  name: 'Bob Jones',
  isActive: false,
};

function makeFetchMock() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async () => ({
    ok: true,
    json: async () => ({
      users: [baseUser, inactiveUser],
      totalPages: 1,
      totalCount: 2,
      page: 1,
    }),
  } as Response));
}

function renderPage() {
  return render(
    <BrowserRouter>
      <AdminUsersPage />
    </BrowserRouter>
  );
}

describe('AdminUsersPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders username column and Banned badge for inactive users', async () => {
    makeFetchMock();
    renderPage();

    await waitFor(() => expect(screen.getByText('alice_student')).toBeInTheDocument());
    expect(screen.getByText('bob_student')).toBeInTheDocument();
    expect(screen.getByText('Banned')).toBeInTheDocument();
    // "Active" appears in the status filter dropdown too — find one inside the table
    const table = screen.getByRole('table');
    expect(table.textContent).toContain('Active');
    expect(screen.getByRole('columnheader', { name: 'Username' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Email' })).toBeInTheDocument();
  });

  it('does not send q when input has 3 or fewer characters', async () => {
    const fetchMock = makeFetchMock();
    renderPage();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByPlaceholderText(/Email or username/), {
      target: { value: 'ali' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Search$/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const lastUrl = String(fetchMock.mock.calls.at(-1)?.[0]);
    expect(lastUrl).not.toContain('q=');
  });

  it('sends trimmed q when input has more than 3 characters', async () => {
    const fetchMock = makeFetchMock();
    renderPage();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByPlaceholderText(/Email or username/), {
      target: { value: '  alice  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Search$/ }));

    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(calls.some((url) => url.includes('q=alice'))).toBe(true);
      expect(calls.some((url) => url.includes('q=+'))).toBe(false);
    });
  });

  it('clear button resets query/role/status filters', async () => {
    const fetchMock = makeFetchMock();
    renderPage();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const input = screen.getByPlaceholderText(/Email or username/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'alice' } });
    fireEvent.click(screen.getByRole('button', { name: /^Search$/ }));

    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(calls.some((url) => url.includes('q=alice'))).toBe(true);
    });

    fireEvent.click(screen.getByRole('button', { name: /Clear/ }));

    await waitFor(() => {
      expect(input.value).toBe('');
      const calls = fetchMock.mock.calls.map((c) => String(c[0]));
      // Most recent call after clear should have no q
      expect(calls.at(-1)).not.toContain('q=');
    });
  });
});
