import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { GroupDetailPage } from '../group-detail-page';
import { BrowserRouter } from 'react-router';
import type { AppContextType } from '@/app/contexts/app-context';

/* Mock react-router */
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual as Record<string, unknown>,
    useNavigate: () => vi.fn(),
    useParams: () => ({ groupId: 'group1' })
  };
});

/* Mock framer-motion and lucide-react */
vi.mock('motion/react', () => ({
  motion: {
    div: 'div',
  },
  AnimatePresence: 'div',
}));


/* Mock App Context */
vi.mock('@/app/contexts/app-context', () => ({
  useApp: vi.fn()
}));
import { useApp } from '@/app/contexts/app-context';

describe('GroupDetailPage Synchronization', () => {
  const mockFetchSwipeEvents = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    
    (useApp as Mock).mockReturnValue({
      currentUser: { id: "1", name: "Alice", email: "alice@example.com", preferences: { dietary: [] } },
      groups: [{ 
        id: "group1", 
        name: "Test Group", 
        members: [{ id: "1", role: "leader", userName: "Alice" }], 
        created_by: "1", 
        created_at: "" 
      }],
      currentGroup: { 
        id: "group1", 
        name: "Test Group", 
        members: [{ id: "1", role: "leader", userName: "Alice" }], 
        created_by: "1", 
        created_at: "" 
      },
      swipeEvents: [],
      fetchSwipeEvents: mockFetchSwipeEvents,
      updateGroupConstraints: vi.fn(),
      removeMember: vi.fn(),
      makeLeader: vi.fn(),
      leaveGroup: vi.fn(),
      deleteGroup: vi.fn(),
      fetchAvailableUsers: vi.fn(),
      getAllUsers: vi.fn().mockReturnValue([]),
      createSwipeEvent: vi.fn(),
      swipes: {},
      addChatMessage: vi.fn(),
      deleteChatMessage: vi.fn(),
      availableUsers: []
    } as unknown as AppContextType);
  });

  it('triggers fetchSwipeEvents systematically on component mount to enforce synced UI among members', async () => {
    render(
      <BrowserRouter>
        <GroupDetailPage />
      </BrowserRouter>
    );

    // Give the layout time to mount and useEffect to fire natively
    await waitFor(() => {
      // Expect that `fetchSwipeEvents('group1')` was executed at least once safely
      expect(mockFetchSwipeEvents).toHaveBeenCalledWith('group1');
      expect(mockFetchSwipeEvents).toHaveBeenCalledTimes(1);
    });
  });
});
