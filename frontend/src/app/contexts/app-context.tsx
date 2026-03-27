import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

const DEFAULT_PREFERENCES = {
  cuisines: [] as string[],
  dietary: [] as string[],
  foodTypes: [] as string[],
  minimumSanitationGrade: 'A' as string,
};

export interface User {
  id: string;
  name: string;
  email: string;
  preferences: {
    cuisines: string[];
    dietary: string[];
    foodTypes: string[];
    minimumSanitationGrade?: string;
  };
}

/** Normalize API user payload to User (fill missing/partial preferences). */
// eslint-disable-next-line react-refresh/only-export-components
export function normalizeApiUser(apiUser: {
  id: number | string;
  email: string;
  name: string;
  preferences?: {
    dietary?: string[];
    cuisines?: string[];
    foodTypes?: string[];
    minimum_sanitation_grade?: string;
  };
}): User {
  const prefs = apiUser.preferences ?? {};
  const grade = prefs.minimum_sanitation_grade ?? 'A';
  return {
    id: String(apiUser.id),
    email: apiUser.email,
    name: apiUser.name,
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
    },
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
}

export interface Group {
  id: string;
  name: string;
  members: GroupMember[];
  createdBy: string;
  createdAt: string;
  constraints?: GroupConstraints;
}

export interface SwipeEvent {
  id: string;
  groupId: string;
  name: string;
  status: 'pending' | 'active' | 'completed';
  createdAt: string;
  matchedRestaurantId?: string;
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

export interface Notification {
  id: string;
  type: 'group_invite' | 'match_found' | 'swipe_reminder';
  title: string;
  message: string;
  groupId?: string;
  eventId?: string;
  read: boolean;
  timestamp: string;
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
  }) => Promise<void>;
  groups: Group[];
  createGroup: (
    name: string,
    groupType?: string,
    defaultLocation?: string,
    privacy?: string
  ) => Promise<Group>;
  joinGroup: (groupId: string) => void;
  leaveGroup: (groupId: string) => Promise<void>;
  deleteGroup: (groupId: string) => Promise<void>;
  updateGroupConstraints: (groupId: string, constraints: GroupConstraints) => Promise<void>;
  removeMember: (groupId: string, userId: string) => Promise<void>;
  makeLeader: (groupId: string, userId: string) => Promise<void>;
  inviteMember: (groupId: string, userEmail: string) => Promise<void>;
  getAllUsers: () => User[];
  fetchAvailableUsers: (query?: string) => Promise<void>;
  availableUsers: User[];
  currentGroup: Group | null;
  setCurrentGroup: (group: Group | null) => void;
  swipeEvents: SwipeEvent[];
  createSwipeEvent: (groupId: string, name: string) => SwipeEvent;
  currentSwipeEvent: SwipeEvent | null;
  setCurrentSwipeEvent: (event: SwipeEvent | null) => void;
  swipes: Record<string, Swipe[]>; // eventId -> swipes
  addSwipe: (eventId: string, swipe: Swipe) => void;
  chatMessages: Record<string, ChatMessage[]>; // groupId or dmId -> messages
  addChatMessage: (conversationId: string, message: ChatMessage) => Promise<void>;
  deleteChatMessage: (conversationId: string, messageId: string) => Promise<void>;
  dmConversations: DMConversation[];
  createDMConversation: (participantId: string) => Promise<DMConversation>;
  updateSwipeEventStatus: (
    eventId: string,
    status: SwipeEvent['status'],
    matchedId?: string
  ) => void;
  notifications: Notification[];
  addNotification: (
    notification: Omit<Notification, 'id' | 'read' | 'timestamp'>
  ) => void;
  markNotificationAsRead: (notificationId: string) => void;
  clearAllNotifications: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Mock users for demo
const mockUsers: User[] = [
  {
    id: '1',
    name: 'Alex Chen',
    email: 'alex@nyu.edu',
    preferences: {
      cuisines: ['Italian', 'Japanese', 'Mexican'],
      dietary: ['Vegetarian'],
      foodTypes: [],
      minimumSanitationGrade: 'A',
    },
  },
  {
    id: '2',
    name: 'Sarah Kim',
    email: 'sarah@nyu.edu',
    preferences: {
      cuisines: ['Korean', 'Chinese', 'Thai'],
      dietary: ['Halal'],
      foodTypes: [],
      minimumSanitationGrade: 'A',
    },
  },
  {
    id: '3',
    name: 'Jordan Lee',
    email: 'jordan@nyu.edu',
    preferences: {
      cuisines: ['American', 'Mediterranean'],
      dietary: [],
      foodTypes: [],
      minimumSanitationGrade: 'A',
    },
  },
  {
    id: '4',
    name: 'Emma Rodriguez',
    email: 'emma@nyu.edu',
    preferences: {
      cuisines: ['Mexican', 'Italian', 'Mediterranean'],
      dietary: ['Vegan', 'Gluten-Free'],
      foodTypes: [],
      minimumSanitationGrade: 'A',
    },
  },
  {
    id: '5',
    name: 'Michael Zhang',
    email: 'michael@nyu.edu',
    preferences: {
      cuisines: ['Chinese', 'Japanese', 'Vietnamese'],
      dietary: ['Dairy-Free'],
      foodTypes: [],
      minimumSanitationGrade: 'A',
    },
  },
];

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
  const [notifications, setNotifications] = useState<Notification[]>([]);

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

      // Add some initial notifications
      const initialNotifications: Notification[] = [
        {
          id: 'notif-1',
          type: 'group_invite',
          title: 'Group Invitation',
          message: 'Alex Chen invited you to join "Friday Night Dinner Club"',
          groupId: 'group-feb7-2026',
          read: false,
          timestamp: '2026-02-01T10:00:00.000Z',
        },
        {
          id: 'notif-2',
          type: 'swipe_reminder',
          title: 'Swipe Reminder',
          message: 'Your group has a dinner planned for Feb 7! Start swiping.',
          groupId: 'group-feb7-2026',
          eventId: 'event-feb7-2026',
          read: false,
          timestamp: '2026-02-04T09:00:00.000Z',
        },
      ];

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
      localStorage.setItem(
        'mealswipe_notifications',
        JSON.stringify(initialNotifications)
      );
      localStorage.setItem('mealswipe_messages', JSON.stringify(initialMessages));
      localStorage.setItem(
        'mealswipe_dm_conversations',
        JSON.stringify(initialDMConversations)
      );
      localStorage.setItem('mealswipe_seeded', 'true');
      localStorage.setItem('mealswipe_version', CURRENT_VERSION);

      setGroups([feb7Group]);
      setSwipeEvents([feb7Event]);
      setNotifications(initialNotifications);
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

    const storedNotifications = localStorage.getItem('mealswipe_notifications');
    if (storedNotifications) {
      setNotifications(JSON.parse(storedNotifications));
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
        
        chats.forEach((chat: any) => {
          newChatMessages[chat.id] = chat.messages || [];
          if (chat.type === 'direct') {
            dms.push({
              id: chat.id,
              participants: chat.participants,
              participantNames: chat.participantNames,
              lastMessageTime: chat.lastMessageTime
            });
          }
        });
        
        setChatMessages(newChatMessages);
        setDMConversations(dms);
      }
    } catch (err) {
      console.error('Failed to fetch user chats', err);
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
  }) => {
    const csrftoken = getCookie('csrftoken') || '';
    const body: Record<string, unknown> = {};
    if (preferences.dietary !== undefined) body.dietary = preferences.dietary;
    if (preferences.cuisines !== undefined) body.cuisines = preferences.cuisines;
    if (preferences.foodTypes !== undefined) body.foodTypes = preferences.foodTypes;
    if (preferences.minimumSanitationGrade !== undefined) {
      body.minimum_sanitation_grade = preferences.minimumSanitationGrade;
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

  useEffect(() => {
    localStorage.setItem('mealswipe_notifications', JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem('mealswipe_notifications', JSON.stringify(notifications));
  }, [notifications]);

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

  const joinGroup = (groupId: string) => {
    if (!currentUser) return;

    setGroups(
      groups.map((group) => {
        if (group.id === groupId) {
          const isMember = group.members.some((m) => m.userId === currentUser.id);
          if (!isMember) {
            return {
              ...group,
              members: [
                ...group.members,
                {
                  userId: currentUser.id,
                  userName: currentUser.name,
                  hasFinishedSwiping: false,
                  isLeader: false,
                },
              ],
            };
          }
        }
        return group;
      })
    );

    // Add system message
    const group = groups.find((g) => g.id === groupId);
    if (group) {
      addChatMessage(groupId, {
        id: `msg-${Date.now()}`,
        type: 'system',
        message: `${currentUser.name} joined the group`,
        timestamp: new Date().toISOString(),
      });
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

      const data = await response.json();
      const updatedBackendGroup = data.group;

      // Update the group in local state with the new member list
      setGroups((prevGroups) =>
        prevGroups.map((group) => {
          if (group.id === groupId) {
            return {
              ...group,
              members: updatedBackendGroup.members.map((m: BackendMember) => ({
                userId: String(m.id),
                userName: m.name,
                hasFinishedSwiping: false,
                isLeader: m.role === 'leader',
              })),
            };
          }
          return group;
        })
      );

      // Add system message
      addChatMessage(groupId, {
        id: `msg-${Date.now()}`,
        type: 'system',
        message: `${currentUser.name} invited ${userEmail} to the group`,
        timestamp: new Date().toISOString(),
      });
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

  const updateGroupConstraints = async (groupId: string, constraints: GroupConstraints) => {
    const csrftoken = getCookie('csrftoken') || '';
    const body: Record<string, unknown> = {};
    if (constraints.dietary !== undefined) body.dietary = constraints.dietary;
    if (constraints.cuisines !== undefined) body.cuisines = constraints.cuisines;
    if (constraints.foodTypes !== undefined) body.foodTypes = constraints.foodTypes;
    if (constraints.minimumSanitationGrade !== undefined) {
      body.minimumSanitationGrade = constraints.minimumSanitationGrade;
    }
    const response = await fetch(apiUrl(`/api/groups/${groupId}/constraints/`), {
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
      throw new Error(err.error || 'Failed to update constraints');
    }
    const data = await response.json();
    const updatedBg = data.group as BackendGroup;
    setGroups(prev => prev.map(g => g.id === String(updatedBg.id) ? { ...g, constraints: updatedBg.constraints } : g));
    if (currentGroup?.id === String(updatedBg.id)) {
      setCurrentGroup(prev => prev ? { ...prev, constraints: updatedBg.constraints } : null);
    }
  };

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

  const fetchAvailableUsers = async (query: string = '') => {
    if (!currentUser) return;
    try {
      const response = await fetch(
        apiUrl(`/api/groups/users/?q=${encodeURIComponent(query)}`),
        {
          credentials: 'include',
        }
      );
      if (response.ok) {
        const data = await response.json();
        const users = data.users.map((u: BackendUser) => ({
          id: String(u.id),
          email: u.email,
          name: u.name,
          preferences: { cuisines: [], dietary: [], foodTypes: [] }, // Minimal mock for interface
        }));
        setAvailableUsers(users);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const getAllUsers = () => {
    return availableUsers.length > 0 ? availableUsers : mockUsers;
  };

  const createSwipeEvent = (groupId: string, name: string): SwipeEvent => {
    const newEvent: SwipeEvent = {
      id: `event-${Date.now()}`,
      groupId,
      name,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    setSwipeEvents([...swipeEvents, newEvent]);

    // Initialize swipes array for this event
    setSwipes((prev) => ({
      ...prev,
      [newEvent.id]: [],
    }));

    // Add system message
    addChatMessage(groupId, {
      id: `msg-${Date.now()}`,
      type: 'system',
      message: `New swipe session started: ${name}`,
      timestamp: new Date().toISOString(),
    });

    return newEvent;
  };

  const addSwipe = (eventId: string, swipe: Swipe) => {
    setSwipes((prev) => ({
      ...prev,
      [eventId]: [...(prev[eventId] || []), swipe],
    }));
  };

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

      if (response.ok) {
        const data = await response.json();
        setChatMessages((prev) => ({
          ...prev,
          [conversationId]: [...(prev[conversationId] || []), data.message],
        }));
      }
    } catch (err) {
      console.error('Failed to send message', err);
    }
  };

  const deleteChatMessage = async (conversationId: string, messageId: string) => {
    try {
      const csrftoken = getCookie('csrftoken') || '';
      const response = await fetch(apiUrl(`/api/chat/${conversationId}/messages/${messageId}/`), {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'X-CSRFToken': csrftoken,
        },
      });

      if (response.ok) {
        setChatMessages((prev) => {
          const messages = prev[conversationId] || [];
          return {
            ...prev,
            [conversationId]: messages.map(msg => 
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

  const createDMConversation = async (participantId: string): Promise<DMConversation> => {
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
          lastMessageTime: chat.lastMessageTime
        };
        setDMConversations(prev => [...prev.filter(dm => dm.id !== chat.id), newDm]);
        setChatMessages(prev => ({ ...prev, [chat.id]: chat.messages || [] }));
        return newDm;
      }
    } catch (err) {
      console.error('Failed to create DM', err);
    }
    throw new Error('Failed to create DM');
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

  const addNotification = (
    notification: Omit<Notification, 'id' | 'read' | 'timestamp'>
  ) => {
    setNotifications((prev) => [
      ...prev,
      {
        ...notification,
        id: `notification-${Date.now()}`,
        read: false,
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  const markNotificationAsRead = (notificationId: string) => {
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === notificationId
          ? { ...notification, read: true }
          : notification
      )
    );
  };

  const clearAllNotifications = () => {
    setNotifications([]);
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
        leaveGroup,
        deleteGroup,
        updateGroupConstraints,
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
        currentSwipeEvent,
        setCurrentSwipeEvent,
        swipes,
        addSwipe,
        chatMessages,
        addChatMessage,
        deleteChatMessage,
        dmConversations,
        createDMConversation,
        updateSwipeEventStatus,
        notifications,
        addNotification,
        markNotificationAsRead,
        clearAllNotifications,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
