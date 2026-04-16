import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { Restaurant } from '@/app/data/mock-restaurants';

const DEFAULT_PREFERENCES = {
  cuisines: [] as string[],
  dietary: [] as string[],
  foodTypes: [] as string[],
  minimumSanitationGrade: 'A' as string,
  priceRange: '' as string,
};

export interface User {
  id: string;
  name: string;
  email: string;
  role?: 'student' | 'venue_manager' | 'admin';
  preferences: {
    cuisines: string[];
    dietary: string[];
    foodTypes: string[];
    minimumSanitationGrade?: string;
    priceRange?: string;
  };
  is_invited?: boolean;
}

/** Normalize API user payload to User (fill missing/partial preferences). */
// eslint-disable-next-line react-refresh/only-export-components
export function normalizeApiUser(apiUser: {
  id: number | string;
  email: string;
  name: string;
  role?: 'student' | 'venue_manager' | 'admin';
  preferences?: {
    dietary?: string[];
    cuisines?: string[];
    foodTypes?: string[];
    minimum_sanitation_grade?: string;
    price_range?: string;
  };
  is_invited?: boolean;
}): User {
  const prefs = apiUser.preferences ?? {};
  const grade = prefs.minimum_sanitation_grade ?? 'A';
  return {
    id: String(apiUser.id),
    email: apiUser.email,
    name: apiUser.name,
    role: apiUser.role,
    preferences: {
      cuisines: Array.isArray(prefs.cuisines)
        ? prefs.cuisines
        : DEFAULT_PREFERENCES.cuisines,
      dietary: Array.isArray(prefs.dietary)
        ? prefs.dietary
        : DEFAULT_PREFERENCES.dietary,
      foodTypes: Array.isArray(prefs.foodTypes)
        ? prefs.foodTypes
        : DEFAULT_PREFERENCES.foodTypes,
      minimumSanitationGrade: grade,
      priceRange: prefs.price_range ?? '',
    },
    is_invited: apiUser.is_invited,
  };
}

export interface GroupMember {
  userId: string;
  userName: string;
  hasFinishedSwiping: boolean;
  isLeader: boolean;
}

export interface GroupConstraints {
  dietary?: string[];
  cuisines?: string[];
  foodTypes?: string[];
  minimumSanitationGrade?: string;
  priceRange?: string;
}

export interface PreviewFilters {
  cuisines?: string[];
  dietary?: string[];
  foodTypes?: string[];
  minimumSanitationGrade?: string;
  priceRange?: string;
  borough?: string;
  neighborhood?: string;
}

export interface Group {
  id: string;
  name: string;
  members: GroupMember[];
  createdBy: string;
  createdAt: string;
  joinCode?: string;
  constraints?: GroupConstraints;
}

export interface SwipeEvent {
  id: string;
  groupId: string;
  name: string;
  status: 'pending' | 'active' | 'completed';
  createdAt: string;
  matchedRestaurantId?: string;
  borough?: string;
  neighborhood?: string;
}

export interface Swipe {
  userId: string;
  restaurantId: string;
  direction: 'left' | 'right';
}

export interface ChatMessage {
  id: string;
  type: 'user' | 'system';
  userId?: string;
  userName?: string;
  message: string;
  timestamp: string;
}

export interface DMConversation {
  id: string;
  participants: string[]; // array of user IDs
  participantNames: string[]; // array of user names
  lastMessageTime: string;
}

export interface Invitation {
  id: string | number;
  group_id: string | number;
  group_name: string;
  inviter_name: string;
  created_at: string;
}

export interface SwipeNotification {
  id: string | number;
  event_id: string | number;
  event_name: string;
  group_id: string | number;
  group_name: string;
  creator_name: string;
  created_at: string;
  is_read: boolean;
}

interface RegisterData {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  preferences?: {
    cuisines?: string[];
    dietary?: string[];
    foodTypes?: string[];
    minimum_sanitation_grade?: string;
    price_range?: string;
  };
}

interface BackendMember {
  id: number | string;
  name: string;
  role: string;
}

interface BackendGroup {
  id: number | string;
  name: string;
  members: BackendMember[];
  created_by: number | string;
  created_at: string;
  join_code?: string;
  constraints?: GroupConstraints;
}

interface BackendUser {
  id: number | string;
  email: string;
  name: string;
}

interface AppContextType {
  currentUser: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  validatePasswordResetToken: (uid: string, token: string) => Promise<void>;
  confirmPasswordReset: (
    uid: string,
    token: string,
    newPassword: string
  ) => Promise<void>;
  updatePreferences: (preferences: {
    dietary?: string[];
    cuisines?: string[];
    foodTypes?: string[];
    minimumSanitationGrade?: string;
    priceRange?: string;
  }) => Promise<void>;
  groups: Group[];
  createGroup: (
    name: string,
    groupType?: string,
    defaultLocation?: string,
    privacy?: string
  ) => Promise<Group>;
  joinGroup: (code: string) => Promise<void>;
  fetchPublicGroups: () => Promise<Group[]>;
  regenerateJoinCode: (groupId: string) => Promise<string>;
  leaveGroup: (groupId: string) => Promise<void>;
  deleteGroup: (groupId: string) => Promise<void>;
  fetchGroupEffectiveConstraints: (groupId: string) => Promise<GroupConstraints>;
  fetchGroupPreviewVenues: (
    groupId: string,
    options?: { countOnly?: boolean; limit?: number; offset?: number; signal?: AbortSignal }
  ) => Promise<{ count: number; venues: Restaurant[] }>;
  fetchPreviewVenues: (
    filters: PreviewFilters,
    options?: { countOnly?: boolean; limit?: number; offset?: number; signal?: AbortSignal }
  ) => Promise<{ count: number; venues: Restaurant[] }>;
  fetchVenuePreviewDetail: (venueId: string) => Promise<Restaurant>;
  removeMember: (groupId: string, userId: string) => Promise<void>;
  makeLeader: (groupId: string, userId: string) => Promise<void>;
  inviteMember: (groupId: string, userEmail: string) => Promise<void>;
  getAllUsers: () => User[];
  fetchAvailableUsers: (query?: string, groupId?: string) => Promise<void>;
  availableUsers: User[];
  currentGroup: Group | null;
  setCurrentGroup: (group: Group | null) => void;
  swipeEvents: SwipeEvent[];
  createSwipeEvent: (
    groupId: string,
    name: string,
    borough?: string,
    neighborhood?: string
  ) => Promise<SwipeEvent>;
  fetchSwipeEvents: (groupId: string, signal?: AbortSignal) => Promise<void>;
  currentSwipeEvent: SwipeEvent | null;
  setCurrentSwipeEvent: (event: SwipeEvent | null) => void;
  swipes: Record<string, Swipe[]>; // eventId -> swipes
  addSwipe: (
    eventId: string,
    groupId: string,
    venueId: string,
    direction: 'left' | 'right'
  ) => Promise<void>;
  fetchSwipeVenues: (groupId: string, eventId: string) => Promise<Restaurant[]>;
  fetchMatchResults: (
    groupId: string,
    eventId: string
  ) => Promise<{
    match_found: boolean;
    matched_venue: Restaurant | null;
    total_participants: number;
    threshold: number;
    likes_count: number;
  }>;
  chatMessages: Record<string, ChatMessage[]>; // groupId or dmId -> messages
  addChatMessage: (conversationId: string, message: ChatMessage) => Promise<void>;
  deleteChatMessage: (conversationId: string, messageId: string) => Promise<void>;
  chatMutedParticipants: Record<string, string[]>;
  toggleMuteChatMember: (chatId: string, userId: string) => Promise<void>;
  openUserDM: (userId: string) => Promise<void>;
  dmConversations: DMConversation[];
  createDMConversation: (participantId: string) => Promise<DMConversation>;
  updateSwipeEventStatus: (
    eventId: string,
    status: SwipeEvent['status'],
    matchedId?: string
  ) => void;
  invitations: Invitation[];
  swipeNotifications: SwipeNotification[];
  fetchInvitations: () => Promise<void>;
  acceptInvitation: (id: string | number) => Promise<void>;
  declineInvitation: (id: string | number) => Promise<void>;
  markSwipeNotificationRead: (id: string | number) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// CSRF token helper
function getCookie(name: string) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === name + '=') {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000';

function apiUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isInitializingAuth, setIsInitializingAuth] = useState(true);
  const [groups, setGroups] = useState<Group[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [currentGroup, setCurrentGroup] = useState<Group | null>(null);
  const [swipeEvents, setSwipeEvents] = useState<SwipeEvent[]>([]);
  const [currentSwipeEvent, setCurrentSwipeEvent] = useState<SwipeEvent | null>(null);
  const [swipes, setSwipes] = useState<Record<string, Swipe[]>>({});
  const [chatMessages, setChatMessages] = useState<Record<string, ChatMessage[]>>({});
  const [dmConversations, setDMConversations] = useState<DMConversation[]>([]);
  const [chatMutedParticipants, setChatMutedParticipants] = useState<
    Record<string, string[]>
  >({});
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [swipeNotifications, setSwipeNotifications] = useState<SwipeNotification[]>([]);

  // Seed initial data if not exists
  useEffect(() => {
    const hasSeeded = localStorage.getItem('mealswipe_seeded');
    const currentVersion = localStorage.getItem('mealswipe_version');
    const CURRENT_VERSION = '3'; // Increment when schema changes

    // Reset data if version changed (for schema updates like isLeader field)
    if (currentVersion !== CURRENT_VERSION) {
      localStorage.removeItem('mealswipe_groups');
      localStorage.removeItem('mealswipe_events');
      localStorage.removeItem('mealswipe_swipes');
      localStorage.removeItem('mealswipe_messages');
      localStorage.removeItem('mealswipe_notifications');
      localStorage.removeItem('mealswipe_seeded');
    }

    if (!hasSeeded || currentVersion !== CURRENT_VERSION) {
      // Create a pre-existing group for Feb 7, 2026
      const feb7Group: Group = {
        id: 'group-feb7-2026',
        name: 'Friday Night Dinner Club',
        members: [
          {
            userId: '1',
            userName: 'Alex Chen',
            hasFinishedSwiping: false,
            isLeader: true,
          },
          {
            userId: '2',
            userName: 'Sarah Kim',
            hasFinishedSwiping: false,
            isLeader: false,
          },
          {
            userId: '3',
            userName: 'Jordan Lee',
            hasFinishedSwiping: false,
            isLeader: false,
          },
          {
            userId: '4',
            userName: 'Emma Rodriguez',
            hasFinishedSwiping: false,
            isLeader: false,
          },
        ],
        createdBy: '1',
        createdAt: '2026-02-01T10:00:00.000Z',
      };

      // Create a swipe event for Feb 7
      const feb7Event: SwipeEvent = {
        id: 'event-feb7-2026',
        groupId: 'group-feb7-2026',
        name: 'Friday Dinner - Feb 7',
        status: 'pending',
        createdAt: '2026-02-01T10:00:00.000Z',
      };

      // Add initial chat messages
      const initialMessages: Record<string, ChatMessage[]> = {
        'group-feb7-2026': [
          {
            id: 'msg-1',
            type: 'system',
            message: 'Alex Chen created the group',
            timestamp: '2026-02-01T10:00:00.000Z',
          },
          {
            id: 'msg-2',
            type: 'system',
            message: 'Sarah Kim joined the group',
            timestamp: '2026-02-01T10:15:00.000Z',
          },
          {
            id: 'msg-3',
            type: 'system',
            message: 'Jordan Lee joined the group',
            timestamp: '2026-02-01T11:30:00.000Z',
          },
          {
            id: 'msg-4',
            type: 'system',
            message: 'Emma Rodriguez joined the group',
            timestamp: '2026-02-01T14:20:00.000Z',
          },
          {
            id: 'msg-5',
            type: 'user',
            userId: '1',
            userName: 'Alex Chen',
            message: 'Hey everyone! Looking forward to dinner on Friday!',
            timestamp: '2026-02-02T18:00:00.000Z',
          },
          {
            id: 'msg-6',
            type: 'user',
            userId: '2',
            userName: 'Sarah Kim',
            message: 'Me too! Any preferences on cuisine?',
            timestamp: '2026-02-02T18:15:00.000Z',
          },
          {
            id: 'msg-7',
            type: 'user',
            userId: '3',
            userName: 'Jordan Lee',
            message: "I'm down for anything! Maybe Italian or Thai?",
            timestamp: '2026-02-03T09:30:00.000Z',
          },
          {
            id: 'msg-8',
            type: 'user',
            userId: '4',
            userName: 'Emma Rodriguez',
            message: 'Thai sounds great! 🍜',
            timestamp: '2026-02-03T10:15:00.000Z',
          },
          {
            id: 'msg-9',
            type: 'user',
            userId: '1',
            userName: 'Alex Chen',
            message: "Perfect! Let's start swiping soon so we can make a reservation",
            timestamp: '2026-02-04T14:20:00.000Z',
          },
          {
            id: 'msg-10',
            type: 'user',
            userId: '2',
            userName: 'Sarah Kim',
            message: 'Should we aim for 7pm or 8pm?',
            timestamp: '2026-02-05T16:45:00.000Z',
          },
          {
            id: 'msg-11',
            type: 'user',
            userId: '3',
            userName: 'Jordan Lee',
            message: '8pm works better for me, I have class until 6:30',
            timestamp: '2026-02-05T17:00:00.000Z',
          },
          {
            id: 'msg-12',
            type: 'user',
            userId: '4',
            userName: 'Emma Rodriguez',
            message: '8pm is perfect!',
            timestamp: '2026-02-05T17:10:00.000Z',
          },
        ],
        // DM with Jordan Lee
        'dm-jordan-init': [
          {
            id: 'dm-msg-1',
            type: 'user',
            userId: '3',
            userName: 'Jordan Lee',
            message:
              'Hey! Are you free this Saturday too? Thinking of checking out that new ramen place',
            timestamp: '2026-02-06T11:30:00.000Z',
          },
          {
            id: 'dm-msg-2',
            type: 'user',
            userId: '1',
            userName: 'Alex Chen',
            message:
              "Oh that sounds great! I've been wanting to try that place. What time?",
            timestamp: '2026-02-06T11:45:00.000Z',
          },
          {
            id: 'dm-msg-3',
            type: 'user',
            userId: '3',
            userName: 'Jordan Lee',
            message: 'Maybe 1pm? We could walk there from campus',
            timestamp: '2026-02-06T12:00:00.000Z',
          },
        ],
        // DM with Sarah Kim
        'dm-sarah-init': [
          {
            id: 'dm-msg-4',
            type: 'user',
            userId: '2',
            userName: 'Sarah Kim',
            message:
              "Hey! Quick question - do you have the notes from yesterday's lecture?",
            timestamp: '2026-02-07T09:15:00.000Z',
          },
          {
            id: 'dm-msg-5',
            type: 'user',
            userId: '1',
            userName: 'Alex Chen',
            message: "Yeah I do! I'll send them over in a bit",
            timestamp: '2026-02-07T09:20:00.000Z',
          },
          {
            id: 'dm-msg-6',
            type: 'user',
            userId: '2',
            userName: 'Sarah Kim',
            message: 'Thanks! Also super excited for dinner tonight!',
            timestamp: '2026-02-07T09:25:00.000Z',
          },
        ],
      };

      // Add initial DM conversations
      const initialDMConversations: DMConversation[] = [
        {
          id: 'dm-jordan-init',
          participants: ['1', '3'], // Alex and Jordan
          participantNames: ['Alex Chen', 'Jordan Lee'],
          lastMessageTime: '2026-02-06T12:00:00.000Z',
        },
        {
          id: 'dm-sarah-init',
          participants: ['1', '2'], // Alex and Sarah
          participantNames: ['Alex Chen', 'Sarah Kim'],
          lastMessageTime: '2026-02-07T09:25:00.000Z',
        },
      ];

      localStorage.setItem('mealswipe_groups', JSON.stringify([feb7Group]));
      localStorage.setItem('mealswipe_events', JSON.stringify([feb7Event]));
      localStorage.setItem('mealswipe_messages', JSON.stringify(initialMessages));
      localStorage.setItem(
        'mealswipe_dm_conversations',
        JSON.stringify(initialDMConversations)
      );
      localStorage.setItem('mealswipe_seeded', 'true');
      localStorage.setItem('mealswipe_version', CURRENT_VERSION);

      setGroups([feb7Group]);
      setSwipeEvents([feb7Event]);
      setChatMessages(initialMessages);
      setDMConversations(initialDMConversations);
    }
  }, []);

  // Load from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('mealswipe_user');
    if (storedUser) {
      setCurrentUser(JSON.parse(storedUser));
    }

    const storedGroups = localStorage.getItem('mealswipe_groups');
    if (storedGroups) {
      setGroups(JSON.parse(storedGroups));
    }

    const storedEvents = localStorage.getItem('mealswipe_events');
    if (storedEvents) {
      setSwipeEvents(JSON.parse(storedEvents));
    }

    const storedSwipes = localStorage.getItem('mealswipe_swipes');
    if (storedSwipes) {
      setSwipes(JSON.parse(storedSwipes));
    }

    const storedMessages = localStorage.getItem('mealswipe_messages');
    if (storedMessages) {
      setChatMessages(JSON.parse(storedMessages));
    }

    const storedDMConversations = localStorage.getItem('mealswipe_dm_conversations');
    if (storedDMConversations) {
      setDMConversations(JSON.parse(storedDMConversations));
    }
  }, []);

  // ---------------------------------------------------------------------------
  // ACTUAL API AUTHENTICATION LOGIC (Django Session Auth)
  // ---------------------------------------------------------------------------

  const fetchUserGroups = async () => {
    try {
      const groupsResponse = await fetch(apiUrl('/api/groups/'), {
        credentials: 'include',
      });
      if (groupsResponse.ok) {
        const groupsData = await groupsResponse.json();
        const mappedGroups = groupsData.groups.map((g: BackendGroup) => ({
          id: String(g.id),
          name: g.name,
          members: g.members.map((m: BackendMember) => ({
            userId: String(m.id),
            userName: m.name,
            hasFinishedSwiping: false, // UI abstraction
            isLeader: m.role === 'leader',
          })),
          createdBy: String(g.created_by),
          createdAt: g.created_at,
          joinCode: g.join_code,
          constraints: g.constraints,
        }));
        setGroups(mappedGroups);
      }
    } catch (err) {
      console.error('Failed to fetch user groups', err);
    }
  };

  const fetchUserChats = async () => {
    try {
      const response = await fetch(apiUrl('/api/chat/'), {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        const chats = data.chats;

        const newChatMessages: Record<string, ChatMessage[]> = {};
        const dms: DMConversation[] = [];
        const newMutedParticipants: Record<string, string[]> = {};

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        chats.forEach((chat: any) => {
          const msgKey = chat.type === 'direct' ? `dm-${chat.id}` : chat.id;
          newChatMessages[msgKey] = chat.messages || [];
          newMutedParticipants[chat.id] = chat.mutedParticipants || [];
          if (chat.type === 'direct') {
            dms.push({
              id: chat.id,
              participants: chat.participants,
              participantNames: chat.participantNames,
              lastMessageTime: chat.lastMessageTime ?? chat.created_at ?? '',
            });
          }
        });

        setChatMessages(newChatMessages);
        setDMConversations(dms);
        setChatMutedParticipants(newMutedParticipants);
      }
    } catch (err) {
      console.error('Failed to fetch user chats', err);
    }
  };

  const fetchInvitations = async () => {
    try {
      const response = await fetch(apiUrl('/api/groups/invitations/'), {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setInvitations(data.invitations || []);
        setSwipeNotifications(data.swipe_sessions || []);
      }
    } catch (err) {
      console.error('Failed to fetch invitations', err);
    }
  };

  const acceptInvitation = async (id: string | number) => {
    try {
      const csrftoken = getCookie('csrftoken') || '';
      const response = await fetch(apiUrl(`/api/groups/invitations/${id}/accept/`), {
        method: 'POST',
        headers: { 'X-CSRFToken': csrftoken },
        credentials: 'include',
      });
      if (response.ok) {
        await fetchInvitations();
        await fetchUserGroups();
        await fetchUserChats();
      }
    } catch (err) {
      console.error('Failed to accept invitation', err);
    }
  };

  const declineInvitation = async (id: string | number) => {
    try {
      const csrftoken = getCookie('csrftoken') || '';
      const response = await fetch(apiUrl(`/api/groups/invitations/${id}/decline/`), {
        method: 'POST',
        headers: { 'X-CSRFToken': csrftoken },
        credentials: 'include',
      });
      if (response.ok) {
        await fetchInvitations();
      }
    } catch (err) {
      console.error('Failed to decline invitation', err);
    }
  };

  const markSwipeNotificationRead = async (id: string | number) => {
    try {
      const csrftoken = getCookie('csrftoken') || '';
      const response = await fetch(
        apiUrl(`/api/groups/swipe-notifications/${id}/read/`),
        {
          method: 'POST',
          headers: { 'X-CSRFToken': csrftoken },
          credentials: 'include',
        }
      );
      if (response.ok) {
        await fetchInvitations();
      }
    } catch (err) {
      console.error('Failed to mark swipe notification read', err);
    }
  };

  // Check session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        // We use fetch so the browser automatically includes cookies
        const response = await fetch(apiUrl('/api/auth/me/'), {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          if (data.authenticated && data.user) {
            setCurrentUser(normalizeApiUser(data.user));
            await fetchUserGroups();
            await fetchUserChats();
            await fetchInvitations();
          }
        }
      } catch (error) {
        console.error('Session check failed:', error);
      } finally {
        setIsInitializingAuth(false);
      }
    };
    checkSession();
  }, []);

  // Short polling for chat updates
  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(() => {
      // Basic optimization: only poll if document is visible
      if (document.visibilityState === 'visible') {
        // Background fetch without loading spin
        fetchUserChats();
        fetchInvitations();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [currentUser]);

  const login = async (email: string, password: string) => {
    try {
      const csrftoken = getCookie('csrftoken') || '';
      const response = await fetch(apiUrl('/api/auth/login/'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrftoken,
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setCurrentUser(normalizeApiUser(data.user));
        await fetchUserGroups();
        await fetchUserChats();
      } else {
        throw new Error(data.error || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const updatePreferences = async (preferences: {
    dietary?: string[];
    cuisines?: string[];
    foodTypes?: string[];
    minimumSanitationGrade?: string;
    priceRange?: string;
  }) => {
    const csrftoken = getCookie('csrftoken') || '';
    const body: Record<string, unknown> = {};
    if (preferences.dietary !== undefined) body.dietary = preferences.dietary;
    if (preferences.cuisines !== undefined) body.cuisines = preferences.cuisines;
    if (preferences.foodTypes !== undefined) body.foodTypes = preferences.foodTypes;
    if (preferences.minimumSanitationGrade !== undefined) {
      body.minimum_sanitation_grade = preferences.minimumSanitationGrade;
    }
    if (preferences.priceRange !== undefined) {
      body.price_range = preferences.priceRange;
    }
    const response = await fetch(apiUrl('/api/auth/preferences/'), {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrftoken,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(
        (err as { error?: string }).error || 'Failed to update preferences'
      );
    }
    const data = await response.json();
    if (data.user) setCurrentUser(normalizeApiUser(data.user));
  };

  const register = async (userData: RegisterData) => {
    try {
      const csrftoken = getCookie('csrftoken') || '';
      const response = await fetch(apiUrl('/api/auth/register/'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrftoken,
        },
        body: JSON.stringify(userData),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setCurrentUser(normalizeApiUser(data.user));
        await fetchUserGroups();
        await fetchUserChats();
      } else {
        let errorMessage = data.error || 'Registration failed';
        if (data.errors && typeof data.errors === 'object') {
          const firstKey = Object.keys(data.errors)[0];
          if (firstKey && data.errors[firstKey]?.length > 0) {
            errorMessage = data.errors[firstKey][0];
          }
        }
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Register error:', error);
      throw error;
    }
  };

  const requestPasswordReset = async (email: string) => {
    try {
      const csrftoken = getCookie('csrftoken') || '';
      const response = await fetch(apiUrl('/api/auth/request-password-reset/'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrftoken,
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Request failed');
      }
    } catch (error) {
      console.error('Password reset error:', error);
      throw error;
    }
  };

  const validatePasswordResetToken = async (uid: string, token: string) => {
    try {
      const csrftoken = getCookie('csrftoken') || '';
      const response = await fetch(apiUrl('/api/auth/validate-password-reset-token/'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrftoken,
        },
        body: JSON.stringify({ uid, token }),
      });

      const data = await response.json();
      if (!response.ok || !data.success || !data.valid) {
        throw new Error(data.error || 'Invalid or expired reset link');
      }
    } catch (error) {
      console.error('Password reset token validation error:', error);
      throw error;
    }
  };

  const confirmPasswordReset = async (
    uid: string,
    token: string,
    newPassword: string
  ) => {
    try {
      const csrftoken = getCookie('csrftoken') || '';
      const response = await fetch(apiUrl('/api/auth/confirm-password-reset/'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrftoken,
        },
        body: JSON.stringify({ uid, token, new_password: newPassword }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to reset password');
      }
    } catch (error) {
      console.error('Password reset confirmation error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      const csrftoken = getCookie('csrftoken') || '';
      await fetch(apiUrl('/api/auth/logout/'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrftoken,
        },
      });
      setCurrentUser(null);
      setCurrentGroup(null);
      setCurrentSwipeEvent(null);
      localStorage.removeItem('mealswipe_user'); // Still clean up local storage just in case
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // ---------------------------------------------------------------------------
  // APP / UI STATE SAVING LOGIC
  // ---------------------------------------------------------------------------

  useEffect(() => {
    localStorage.setItem('mealswipe_groups', JSON.stringify(groups));
  }, [groups]);

  useEffect(() => {
    localStorage.setItem('mealswipe_events', JSON.stringify(swipeEvents));
  }, [swipeEvents]);

  useEffect(() => {
    localStorage.setItem('mealswipe_swipes', JSON.stringify(swipes));
  }, [swipes]);

  useEffect(() => {
    localStorage.setItem('mealswipe_messages', JSON.stringify(chatMessages));
  }, [chatMessages]);

  useEffect(() => {
    localStorage.setItem('mealswipe_dm_conversations', JSON.stringify(dmConversations));
  }, [dmConversations]);

  const createGroup = async (
    name: string,
    groupType: string = 'casual',
    defaultLocation: string = 'manhattan',
    privacy: string = 'public'
  ): Promise<Group> => {
    if (!currentUser) throw new Error('Must be logged in');

    const csrftoken = getCookie('csrftoken') || '';
    const response = await fetch(apiUrl('/api/groups/'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrftoken,
      },
      body: JSON.stringify({
        name,
        group_type: groupType,
        default_location: defaultLocation,
        privacy,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create group');
    }

    const data = await response.json();
    const newGroupBackend = data.group;

    // Map backend group format to frontend Group interface
    const newGroup: Group = {
      id: String(newGroupBackend.id),
      name: newGroupBackend.name,
      members: newGroupBackend.members.map((m: BackendMember) => ({
        userId: String(m.id),
        userName: m.name,
        hasFinishedSwiping: false, // UI abstraction
        isLeader: m.role === 'leader',
      })),
      createdBy: String(newGroupBackend.created_by),
      createdAt: newGroupBackend.created_at,
      joinCode: newGroupBackend.join_code,
      constraints: newGroupBackend.constraints,
    };

    setGroups((prev) => [...prev, newGroup]);

    // Initialize chat for this group
    setChatMessages((prev) => ({
      ...prev,
      [newGroup.id]: [
        {
          id: `msg-${Date.now()}`,
          type: 'system',
          message: `${currentUser.name} created the group`,
          timestamp: new Date().toISOString(),
        },
      ],
    }));

    return newGroup;
  };

  const fetchPublicGroups = async (): Promise<Group[]> => {
    try {
      const response = await fetch(apiUrl('/api/groups/public/'), {
        credentials: 'include',
      });
      const data = await response.json();
      if (response.ok) {
        return data.groups.map((g: BackendGroup) => ({
          id: String(g.id),
          name: g.name,
          members: g.members.map((m: BackendMember) => ({
            userId: String(m.id),
            userName: m.name,
            hasFinishedSwiping: false,
            isLeader: m.role === 'leader',
          })),
          createdBy: String(g.created_by),
          createdAt: g.created_at,
          joinCode: g.join_code,
          constraints: g.constraints,
        }));
      }
      return [];
    } catch (error) {
      console.error('Fetch public groups error:', error);
      return [];
    }
  };

  const joinGroup = async (code: string): Promise<void> => {
    try {
      const csrftoken = getCookie('csrftoken') || '';
      const response = await fetch(apiUrl(`/api/groups/join/${code}/`), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-CSRFToken': csrftoken,
        },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.error || 'Failed to join group. Make sure code is correct.'
        );
      }

      // Update local state by re-fetching
      await fetchUserGroups();
      await fetchUserChats();
    } catch (error) {
      console.error('Join group error:', error);
      throw error;
    }
  };

  const regenerateJoinCode = async (groupId: string): Promise<string> => {
    try {
      const csrftoken = getCookie('csrftoken') || '';
      const response = await fetch(apiUrl(`/api/groups/${groupId}/regenerate-code/`), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-CSRFToken': csrftoken,
        },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to regenerate code');
      }

      // Update local state directly
      setGroups(
        groups.map((g) => (g.id === groupId ? { ...g, joinCode: data.join_code } : g))
      );
      return data.join_code;
    } catch (error) {
      console.error('Regenerate code error:', error);
      throw error;
    }
  };

  const leaveGroup = async (groupId: string): Promise<void> => {
    if (!currentUser) return;
    try {
      const csrftoken = getCookie('csrftoken') || '';
      const response = await fetch(apiUrl(`/api/groups/${groupId}/leave/`), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-CSRFToken': csrftoken,
        },
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to leave group');
      }

      // Remove from local state
      setGroups((prev) => prev.filter((g) => g.id !== groupId));

      // Optional: add system message or navigate away in component
    } catch (error) {
      console.error('Leave group error:', error);
      throw error;
    }
  };

  const deleteGroup = async (groupId: string): Promise<void> => {
    if (!currentUser) return;
    try {
      const csrftoken = getCookie('csrftoken') || '';
      const response = await fetch(apiUrl(`/api/groups/${groupId}/delete/`), {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'X-CSRFToken': csrftoken,
        },
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete group');
      }

      setGroups((prev) => prev.filter((g) => g.id !== groupId));
      if (currentGroup?.id === groupId) {
        setCurrentGroup(null);
      }
    } catch (error) {
      console.error('Delete group error:', error);
      throw error;
    }
  };

  const inviteMember = async (groupId: string, userEmail: string): Promise<void> => {
    if (!currentUser) return;

    try {
      const csrftoken = getCookie('csrftoken') || '';
      const response = await fetch(apiUrl(`/api/groups/${groupId}/invite/`), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrftoken,
        },
        body: JSON.stringify({ email: userEmail }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to invite user');
      }

      // Invitation sent successfully, nothing more to do locally since they aren't added to the group yet
      // The pending invitation requires the other user to accept it.
    } catch (error) {
      console.error('Invite member error:', error);
      throw error;
    }
  };

  const removeMember = async (groupId: string, userId: string): Promise<void> => {
    if (!currentUser) return;
    try {
      const csrftoken = getCookie('csrftoken') || '';
      const response = await fetch(
        apiUrl(`/api/groups/${groupId}/members/${userId}/`),
        {
          method: 'DELETE',
          credentials: 'include',
          headers: {
            'X-CSRFToken': csrftoken,
          },
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to remove member');
      }

      setGroups((prevGroups) =>
        prevGroups.map((group) => {
          if (group.id === groupId) {
            return {
              ...group,
              members: group.members.filter((m) => m.userId !== userId),
            };
          }
          return group;
        })
      );
    } catch (error) {
      console.error('Remove member error:', error);
      throw error;
    }
  };

  const fetchGroupEffectiveConstraints = useCallback(
    async (groupId: string): Promise<GroupConstraints> => {
      const response = await fetch(
        apiUrl(`/api/groups/${groupId}/effective-constraints/`),
        { credentials: 'include' }
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to fetch group constraints');
      }
      const data = await response.json();
      return data.constraints as GroupConstraints;
    },
    []
  );

  const fetchGroupPreviewVenues = useCallback(
    async (
      groupId: string,
      options: {
        countOnly?: boolean;
        limit?: number;
        offset?: number;
        signal?: AbortSignal;
      } = {}
    ): Promise<{ count: number; venues: Restaurant[] }> => {
      const params = new URLSearchParams();
      if (options.countOnly) params.set('countOnly', '1');
      if (options.limit !== undefined) params.set('limit', String(options.limit));
      if (options.offset !== undefined) params.set('offset', String(options.offset));
      const qs = params.toString();
      const url = apiUrl(
        `/api/groups/${groupId}/preview-venues/${qs ? `?${qs}` : ''}`
      );
      const response = await fetch(url, {
        credentials: 'include',
        signal: options.signal,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to fetch preview venues');
      }
      const data = await response.json();
      return {
        count: data.count as number,
        venues: data.venues as Restaurant[],
      };
    },
    []
  );

  const fetchPreviewVenues = useCallback(
    async (
      filters: PreviewFilters,
      options: {
        countOnly?: boolean;
        limit?: number;
        offset?: number;
        signal?: AbortSignal;
      } = {}
    ): Promise<{ count: number; venues: Restaurant[] }> => {
      const csrftoken = getCookie('csrftoken') || '';
      const body: Record<string, unknown> = {
        cuisines: filters.cuisines ?? [],
        dietary: filters.dietary ?? [],
        foodTypes: filters.foodTypes ?? [],
      };
      if (filters.minimumSanitationGrade) {
        body.minimumSanitationGrade = filters.minimumSanitationGrade;
      }
      if (filters.priceRange) body.priceRange = filters.priceRange;
      if (filters.borough) body.borough = filters.borough;
      if (filters.neighborhood) body.neighborhood = filters.neighborhood;
      if (options.countOnly) body.countOnly = true;
      if (options.limit !== undefined) body.limit = options.limit;
      if (options.offset !== undefined) body.offset = options.offset;

      const response = await fetch(apiUrl('/api/venues/preview/'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrftoken,
        },
        body: JSON.stringify(body),
        signal: options.signal,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to fetch preview venues');
      }
      const data = await response.json();
      return {
        count: data.count as number,
        venues: data.venues as Restaurant[],
      };
    },
    []
  );

  const fetchVenuePreviewDetail = useCallback(
    async (venueId: string): Promise<Restaurant> => {
      const response = await fetch(
        apiUrl(`/api/venues/${venueId}/preview-detail/`),
        { credentials: 'include' }
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to fetch venue detail');
      }
      const data = await response.json();
      return data.venue as Restaurant;
    },
    []
  );

  const makeLeader = async (groupId: string, userId: string): Promise<void> => {
    if (!currentUser) return;
    try {
      const csrftoken = getCookie('csrftoken') || '';
      const response = await fetch(
        apiUrl(`/api/groups/${groupId}/members/${userId}/role/`),
        {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'X-CSRFToken': csrftoken,
          },
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to promote member');
      }

      setGroups((prevGroups) =>
        prevGroups.map((group) => {
          if (group.id === groupId) {
            return {
              ...group,
              members: group.members.map((m) =>
                m.userId === userId ? { ...m, isLeader: true } : m
              ),
            };
          }
          return group;
        })
      );
    } catch (error) {
      console.error('Make leader error:', error);
      throw error;
    }
  };

  const fetchAvailableUsers = useCallback(
    async (query: string = '', groupId?: string) => {
      if (!currentUser) return;
      try {
        let url = `/api/groups/users/?q=${encodeURIComponent(query)}`;
        if (groupId) {
          url += `&group_id=${encodeURIComponent(groupId)}`;
        }
        const response = await fetch(apiUrl(url), {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          const users = data.users.map((u: BackendUser & { is_invited?: boolean }) => ({
            id: String(u.id),
            email: u.email,
            name: u.name,
            preferences: { cuisines: [], dietary: [], foodTypes: [] }, // Minimal mock for interface
            is_invited: u.is_invited,
          }));
          setAvailableUsers(users);
        }
      } catch (error) {
        console.error('Failed to fetch users:', error);
      }
    },
    [currentUser]
  );

  const getAllUsers = () => {
    return availableUsers;
  };

  const createSwipeEvent = async (
    groupId: string,
    name: string,
    borough?: string,
    neighborhood?: string
  ): Promise<SwipeEvent> => {
    const csrftoken = getCookie('csrftoken') || '';
    const response = await fetch(apiUrl(`/api/groups/${groupId}/events/`), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrftoken,
      },
      body: JSON.stringify({ name, borough, neighborhood }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to create event');

    const newEvent: SwipeEvent = {
      id: String(data.event.id),
      groupId: String(data.event.group_id),
      name: data.event.name,
      status: data.event.status,
      createdAt: data.event.created_at,
      matchedRestaurantId: data.event.matched_venue_id
        ? String(data.event.matched_venue_id)
        : undefined,
      borough: data.event.borough || '',
      neighborhood: data.event.neighborhood || '',
    };

    setSwipeEvents((prev) => [...prev, newEvent]);

    addChatMessage(groupId, {
      id: `msg-${Date.now()}`,
      type: 'system',
      message: `New swipe session started: ${name}`,
      timestamp: new Date().toISOString(),
    });

    return newEvent;
  };

  const fetchSwipeEvents = useCallback(
    async (groupId: string, signal?: AbortSignal) => {
      try {
        const response = await fetch(apiUrl(`/api/groups/${groupId}/events/`), {
          credentials: 'include',
          signal,
        });
        const data = await response.json();
        if (data.success) {
          const events: SwipeEvent[] = data.events.map(
            (e: {
              id: number;
              group_id: number;
              name: string;
              status: string;
              created_at: string;
              matched_venue_id: number | null;
            }) => ({
              id: String(e.id),
              groupId: String(e.group_id),
              name: e.name,
              status: e.status as SwipeEvent['status'],
              createdAt: e.created_at,
              matchedRestaurantId: e.matched_venue_id
                ? String(e.matched_venue_id)
                : undefined,
            })
          );
          setSwipeEvents(events);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('Failed to fetch swipe events:', error);
      }
    },
    []
  );

  const addSwipe = async (
    eventId: string,
    groupId: string,
    venueId: string,
    direction: 'left' | 'right'
  ) => {
    const csrftoken = getCookie('csrftoken') || '';
    const response = await fetch(
      apiUrl(`/api/groups/${groupId}/events/${eventId}/swipes/`),
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrftoken,
        },
        body: JSON.stringify({ venue_id: Number(venueId), direction }),
      }
    );
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to submit swipe');
    }
  };

  const fetchSwipeVenues = useCallback(
    async (groupId: string, eventId: string): Promise<Restaurant[]> => {
      const response = await fetch(
        apiUrl(`/api/groups/${groupId}/events/${eventId}/venues/`),
        { credentials: 'include' }
      );
      const data = await response.json();
      if (!data.success) throw new Error('Failed to fetch venues');
      return data.venues as Restaurant[];
    },
    []
  );

  const fetchMatchResults = useCallback(async (groupId: string, eventId: string) => {
    const response = await fetch(
      apiUrl(`/api/groups/${groupId}/events/${eventId}/results/`),
      { credentials: 'include' }
    );
    const data = await response.json();
    if (!data.success) throw new Error('Failed to fetch results');
    return {
      match_found: data.match_found as boolean,
      matched_venue: data.matched_venue as Restaurant | null,
      total_participants: data.total_participants as number,
      threshold: data.threshold as number,
      likes_count: data.likes_count as number,
    };
  }, []);

  const addChatMessage = async (conversationId: string, message: ChatMessage) => {
    try {
      const csrftoken = getCookie('csrftoken') || '';
      const response = await fetch(apiUrl(`/api/chat/${conversationId}/messages/`), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrftoken,
        },
        body: JSON.stringify({ message: message.message, message_type: message.type }),
      });

      if (!response.ok) {
        let errorDetail: unknown = null;
        try {
          const contentType = response.headers.get('Content-Type') || '';
          if (contentType.includes('application/json')) {
            errorDetail = await response.json();
          } else {
            errorDetail = await response.text();
          }
        } catch {
          // Ignore secondary errors while parsing error response
        }

        console.error('Failed to send message', {
          status: response.status,
          statusText: response.statusText,
          detail: errorDetail,
        });

        const errorMessage =
          typeof errorDetail === 'string' ? errorDetail : 'Failed to send message';
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setChatMessages((prev) => ({
        ...prev,
        [conversationId]: [...(prev[conversationId] || []), data.message],
      }));

      return data.message;
    } catch (err) {
      console.error('Failed to send message', err);
      throw err;
    }
  };

  const deleteChatMessage = async (conversationId: string, messageId: string) => {
    try {
      const csrftoken = getCookie('csrftoken') || '';
      const response = await fetch(
        apiUrl(`/api/chat/${conversationId}/messages/${messageId}/`),
        {
          method: 'DELETE',
          credentials: 'include',
          headers: {
            'X-CSRFToken': csrftoken,
          },
        }
      );

      if (response.ok) {
        setChatMessages((prev) => {
          const messages = prev[conversationId] || [];
          return {
            ...prev,
            [conversationId]: messages.map((msg) =>
              msg.id === (messageId.startsWith('msg-') ? messageId : `msg-${messageId}`)
                ? { ...msg, message: '[This message has been deleted]' }
                : msg
            ),
          };
        });
      }
    } catch (err) {
      console.error('Failed to delete message', err);
    }
  };

  const createDMConversation = async (
    participantId: string
  ): Promise<DMConversation> => {
    if (!currentUser) throw new Error('Must be logged in');

    try {
      const csrftoken = getCookie('csrftoken') || '';
      const response = await fetch(apiUrl(`/api/chat/`), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrftoken,
        },
        body: JSON.stringify({ participantId }),
      });

      if (response.ok) {
        const data = await response.json();
        const chat = data.chat;
        const newDm: DMConversation = {
          id: chat.id,
          participants: chat.participants,
          participantNames: chat.participantNames,
          // Normalize lastMessageTime: backend may return null when there are no messages
          lastMessageTime: chat.lastMessageTime || chat.created_at,
        };
        setDMConversations((prev) => [
          ...prev.filter((dm) => dm.id !== chat.id),
          newDm,
        ]);
        setChatMessages((prev) => ({
          ...prev,
          [`dm-${chat.id}`]: chat.messages || [],
        }));
        return newDm;
      }
    } catch (err) {
      console.error('Failed to create DM', err);
    }
    throw new Error('Failed to create DM');
  };

  const toggleMuteChatMember = async (
    chatId: string,
    userId: string
  ): Promise<void> => {
    try {
      const csrftoken = getCookie('csrftoken') || '';
      const response = await fetch(
        apiUrl(`/api/chat/${chatId}/members/${userId}/mute/`),
        {
          method: 'POST',
          headers: { 'X-CSRFToken': csrftoken },
          credentials: 'include',
        }
      );
      if (!response.ok) throw new Error('Failed to toggle mute');
      await fetchUserChats();
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const openUserDM = async (userId: string): Promise<void> => {
    window.dispatchEvent(new CustomEvent('open-chat-dm', { detail: userId }));
  };

  const updateSwipeEventStatus = (
    eventId: string,
    status: SwipeEvent['status'],
    matchedId?: string
  ) => {
    setSwipeEvents((events) =>
      events.map((event) =>
        event.id === eventId
          ? { ...event, status, matchedRestaurantId: matchedId }
          : event
      )
    );
  };

  // Skip rendering the rest of the application until we've checked the auth state
  if (isInitializingAuth) {
    return null; // Or a loading spinner
  }

  return (
    <AppContext.Provider
      value={{
        currentUser,
        login,
        register,
        logout,
        requestPasswordReset,
        validatePasswordResetToken,
        confirmPasswordReset,
        updatePreferences,
        groups,
        createGroup,
        joinGroup,
        fetchPublicGroups,
        regenerateJoinCode,
        leaveGroup,
        deleteGroup,
        fetchGroupEffectiveConstraints,
        fetchGroupPreviewVenues,
        fetchPreviewVenues,
        fetchVenuePreviewDetail,
        removeMember,
        makeLeader,
        inviteMember,
        getAllUsers,
        fetchAvailableUsers,
        availableUsers,
        currentGroup,
        setCurrentGroup,
        swipeEvents,
        createSwipeEvent,
        fetchSwipeEvents,
        currentSwipeEvent,
        setCurrentSwipeEvent,
        swipes,
        addSwipe,
        fetchSwipeVenues,
        fetchMatchResults,
        chatMessages,
        addChatMessage,
        deleteChatMessage,
        chatMutedParticipants,
        toggleMuteChatMember,
        openUserDM,
        dmConversations,
        createDMConversation,
        updateSwipeEventStatus,
        invitations,
        swipeNotifications,
        fetchInvitations,
        acceptInvitation,
        declineInvitation,
        markSwipeNotificationRead,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
