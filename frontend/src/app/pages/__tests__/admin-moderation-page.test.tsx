import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router';
import { AdminModerationPage } from '../admin-moderation-page';

const sampleReports = [
  {
    id: 1,
    status: 'pending' as const,
    reason: 'Harassment',
    createdAt: new Date().toISOString(),
    reviewedAt: null,
    contentType: 'review' as const,
    content: {
      id: 10,
      title: 'Bad place',
      body: 'Something offensive',
      venueName: 'Pizza Place',
      authorEmail: 'author@nyu.edu',
      authorName: 'Author Name',
    },
    reporter: { id: 5, email: 'reporter@nyu.edu', name: 'Reporter Name' },
  },
];

function renderPage() {
  return render(
    <BrowserRouter>
      <AdminModerationPage />
    </BrowserRouter>
  );
}

describe('AdminModerationPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders fetched reports with reason, reporter, author, and venue', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, reports: sampleReports }),
    } as Response);

    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/Pizza Place/)).toBeInTheDocument()
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('status=pending');
    expect(screen.getByText(/Harassment/)).toBeInTheDocument();
    expect(screen.getByText(/Reporter Name/)).toBeInTheDocument();
    expect(screen.getByText(/Author Name/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Confirm Violation/ })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reject Report/ })).toBeInTheDocument();
  });

  it('shows the empty state when no reports are returned', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, reports: [] }),
    } as Response);

    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/No reports in this queue/)).toBeInTheDocument()
    );
  });

  it('removes a report from the list after confirming', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      // initial queue load
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, reports: sampleReports }),
      } as Response)
      // confirm action
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, report: { id: 1, status: 'confirmed' } }),
      } as Response);

    renderPage();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Confirm Violation/ })).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole('button', { name: /Confirm Violation/ }));

    await waitFor(() =>
      expect(screen.getByText(/No reports in this queue/)).toBeInTheDocument()
    );

    const actionCall = fetchMock.mock.calls[1];
    expect(String(actionCall[0])).toContain('/api/venues/admin/moderation/1/');
    expect(JSON.parse(String(actionCall[1]?.body))).toEqual({ action: 'confirm' });
  });

  it('removes a report from the list after rejecting', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, reports: sampleReports }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, report: { id: 1, status: 'rejected' } }),
      } as Response);

    renderPage();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Reject Report/ })).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole('button', { name: /Reject Report/ }));

    await waitFor(() =>
      expect(screen.getByText(/No reports in this queue/)).toBeInTheDocument()
    );

    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
      action: 'reject',
    });
  });

  it('keeps the report in the list when the action call fails', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, reports: sampleReports }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ success: false, error: 'nope' }),
      } as Response);

    renderPage();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Confirm Violation/ })).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole('button', { name: /Confirm Violation/ }));

    await waitFor(() =>
      expect(screen.getByText(/Pizza Place/)).toBeInTheDocument()
    );
  });
});
