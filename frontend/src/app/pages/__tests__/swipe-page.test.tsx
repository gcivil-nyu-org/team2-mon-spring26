import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import * as sonner from 'sonner';
import { SwipePage } from '../swipe-page';
import { BrowserRouter } from 'react-router';
import type { AppContextType } from '@/app/contexts/app-context';

/* Mock react-router */
const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual as Record<string, unknown>,
    useNavigate: () => mockNavigate,
    useParams: () => ({ eventId: 'event1' })
  };
});

/* Mock Framer Motion and Confetti */
vi.mock('motion/react', () => ({
  motion: {
    div: 'div',
  },
  AnimatePresence: 'div',
}));

vi.mock('react-confetti', () => ({
  default: () => 'div'
}));

/* Mock App Context */
vi.mock('@/app/contexts/app-context', () => ({
  useApp: vi.fn()
}));
import { useApp } from '@/app/contexts/app-context';

describe('SwipePage Fixed Behaviors', () => {
  const mockAddSwipe = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default context mock giving an empty venue list layout
    (useApp as Mock).mockReturnValue({
      currentUser: { id: "1", name: "Alice", email: "alice@example.com", preferences: { dietary: [] } },
      groups: [{ id: "group1", name: "Test Group", members: [], created_by: "1", created_at: "" }],
      swipeEvents: [{ 
        id: "event1", 
        groupId: "group1", 
        name: "Dinner", 
        status: "active", 
        createdAt: "" 
      }],
      fetchSwipeVenues: vi.fn().mockResolvedValue([]),
      addSwipe: mockAddSwipe,
      addChatMessage: vi.fn()
    } as unknown as AppContextType);
  });

  const renderComponent = () => render(
    <BrowserRouter>
      <SwipePage />
    </BrowserRouter>
  );

  it('renders "No restaurants found" instead of mock data when venues list is empty', async () => {
    renderComponent();
    
    // App loads layout but venue list comes back as empty array
    // Verify our empty state placeholder displays successfully
    await waitFor(() => {
      expect(screen.getByText("No restaurants found")).toBeInTheDocument();
      expect(screen.getByText(/We couldn't find any restaurants/i)).toBeInTheDocument();
    });
    
    // Ensure the old mockRestaurants fallback isn't implicitly injected
    expect(screen.queryByTestId('restaurant-card')).not.toBeInTheDocument();
  });

  it('blocks redundant swiping and instantly navigates to match if backend throws "no longer active"', async () => {
    // Make the backend mock return 1 venue so the page loads normally
    (useApp as Mock).mockReturnValue({
      currentUser: { id: "1", name: "Alice", email: "alice@example.com", preferences: { dietary: [] } },
      groups: [{ id: "group1", name: "Test Group", members: [], created_by: "1", created_at: "" }],
      swipeEvents: [{ 
        id: "event1", 
        groupId: "group1", 
        name: "Dinner", 
        status: "active", 
        createdAt: "" 
      }],
      fetchSwipeVenues: vi.fn().mockResolvedValue([{
        id: "venue1",
        name: "A Place to Eat",
        cuisine: ["Pizza"],
        rating: 4,
        reviewCount: 1,
        address: "Address",
        sanitationGrade: "A",
        badges: [],
        cost: "$",
        images: []
      }]),
      addSwipe: mockAddSwipe,
      addChatMessage: vi.fn()
    } as unknown as AppContextType);

    // Provide the error mock simulation
    mockAddSwipe.mockRejectedValueOnce(new Error("This event is no longer active"));

    const toastSpy = vi.spyOn(sonner.toast, 'info').mockImplementation(() => '');

    renderComponent();

    // Wait for the venue card to visually arrive
    const discardBtn = await waitFor(() => {
      return screen.getByTestId('swipe-discard-btn');
    }, { timeout: 3000 });

    // Fire the left swipe which hits our mock Error
    fireEvent.click(discardBtn!);

    await waitFor(() => {
      // Assert it showed a toast instead of a blocking alert
      expect(toastSpy).toHaveBeenCalledWith("A match has already been found for this session!");

      // And then navigated straight to Match page as configured
      expect(mockNavigate).toHaveBeenCalledWith('/match/event1');
    });

    toastSpy.mockRestore();
  });
});
