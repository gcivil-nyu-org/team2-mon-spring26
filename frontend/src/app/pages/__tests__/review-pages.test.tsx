import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { BrowserRouter } from 'react-router';
import { ReviewVenuePage } from '../review-venue-page';
import { VenueReviewsPage } from '../venue-reviews-page';

const mockUseParams = vi.fn();
const mockUseSearchParams = vi.fn();
const mockUseApp = vi.fn();
const mockUseVenue = vi.fn();

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual as Record<string, unknown>,
    useNavigate: () => vi.fn(),
    useParams: () => mockUseParams(),
    useSearchParams: () => mockUseSearchParams(),
  };
});

vi.mock('@/app/contexts/app-context', () => ({
  useApp: () => mockUseApp(),
}));

vi.mock('@/app/contexts/venue-context', () => ({
  useVenue: () => mockUseVenue(),
}));

describe('review pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({ venueId: '12' });
    mockUseSearchParams.mockReturnValue([new URLSearchParams('eventId=event-1'), vi.fn()]);
    mockUseApp.mockReturnValue({
      currentUser: { id: '1', name: 'Student One', email: 'student@nyu.edu' },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('submits a venue review with additional photos', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          venue: {
            id: 12,
            name: 'Test Venue',
            streetAddress: '1 Broadway',
            borough: 'Manhattan',
            priceRange: '$$',
            cuisineType: 'Pizza',
          },
          reviews: [],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          review: {
            id: 9,
          },
        }),
      } as Response);

    render(
      <BrowserRouter>
        <ReviewVenuePage />
      </BrowserRouter>
    );

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Submit Review' })).toBeInTheDocument()
    );

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Great meal' } });
    fireEvent.change(screen.getByLabelText('Review'), { target: { value: 'Worth it.' } });
    fireEvent.change(screen.getByLabelText('Additional Photo URLs'), {
      target: { value: 'https://example.com/1.jpg, https://example.com/2.jpg' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Submit Review' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const postCall = fetchMock.mock.calls[1];
    expect(String(postCall[0])).toContain('/api/venues/12/reviews/');
    expect(JSON.parse(String(postCall[1]?.body))).toMatchObject({
      rating: 5,
      title: 'Great meal',
      content: 'Worth it.',
      visitDate: expect.any(String),
      additionalPhotos: ['https://example.com/1.jpg', 'https://example.com/2.jpg'],
    });
  });

  it('posts an owner response from the venue reviews page', async () => {
    const replyMock = vi.fn().mockResolvedValue({
      id: 1,
      content: 'Thanks for the feedback.',
      isManagerResponse: true,
      isFlagged: false,
      isVisible: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: { id: '9', email: 'manager@nyu.edu', name: 'Manager', role: 'venue_manager' },
    });

    mockUseVenue.mockReturnValue({
      fetchVenueReviews: vi.fn().mockResolvedValue({
        venue: {
          id: 12,
          name: 'Test Venue',
          streetAddress: '1 Broadway',
          borough: 'Manhattan',
          priceRange: '$$',
          cuisineType: 'Pizza',
        },
        canReply: true,
        reviews: [
          {
            id: 7,
            venueId: 12,
            rating: 4,
            title: 'Nice',
            content: 'Good food.',
            visitDate: '2025-01-01',
            additionalPhotos: [],
            isFlagged: false,
            isVisible: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            author: {
              id: '1',
              email: 'student@nyu.edu',
              name: 'Student One',
              role: 'student',
            },
            comments: [],
          },
        ],
      }),
      replyToReview: replyMock,
    });

    render(
      <BrowserRouter>
        <VenueReviewsPage />
      </BrowserRouter>
    );

    await waitFor(() => expect(screen.getByText('Test Venue')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Owner Response'), {
      target: { value: 'Thanks for the feedback.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Post Response' }));

    await waitFor(() => expect(replyMock).toHaveBeenCalledWith(12, 7, 'Thanks for the feedback.'));
  });
});
