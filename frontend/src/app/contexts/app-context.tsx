/**
 * App context — groups, swipe events, chat, invitations, and notifications.
 *
 * Auth state (currentUser, login, logout, etc.) lives in AuthProvider
 * (auth-context.tsx) which AppProvider composes internally. useApp() still
 * returns the full merged interface so no component changes are needed.
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { Restaurant } from '@/app/data/mock-restaurants';
import { apiUrl, getCsrf } from '@/app/lib/api';
import {
  AuthProvider,
  useAuth,
  normalizeApiUser,
  type User,
  type AuthContextType,
} from './auth-context';

// ---------------------------------------------------------------------------
// Re-export User so existing imports from app-context still work
// ---------------------------------------------------------------------------
// eslint-disable-next-line react-refresh/only-export-components
export { normalizeApiUser };
export type { User };

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export interface GroupMember {
  userId: string;
  userName: string;
  userPhotoUrl?: string;
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
  userPhotoUrl?: string;
  message: string;
  timestamp: string;
}

export interface DMConversation {
  id: string;
  participants: string[];
  participantNames: string[];
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

// Internal backend shapes
interface BackendMember {
  id: number | string;
  name: string;
  role: string;
  photoUrl?: string;
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

// ---------------------------------------------------------------------------
// Context type — auth fields + app fields, same public surface as before
// ---------------------------------------------------------------------------

export interface AppContextType extends AuthContextType {
  groups: Group[];
  createGroup: (name: string, groupType?: string, defaultLocation?: string, privacy?: string) => Promise<Group>;
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
  createSwipeEvent: (groupId: string, name: string, borough?: string, neighborhood?: string) => Promise<SwipeEvent>;
  fetchSwipeEvents: (groupId: string, signal?: AbortSignal) => Promise<void>;
  currentSwipeEvent: SwipeEvent | null;
  setCurrentSwipeEvent: (event: SwipeEvent | null) => void;
  addSwipe: (eventId: string, groupId: string, venueId: string, direction: 'left' | 'right') => Promise<void>;
  fetchSwipeVenues: (groupId: string, eventId: string) => Promise<Restaurant[]>;
  fetchMatchResults: (groupId: string, eventId: string) => Promise<{
    match_found: boolean;
    matched_venue: Restaurant | null;
    total_participants: number;
    threshold: number;
    likes_count: number;
  }>;
  chatMessages: Record<string, ChatMessage[]>;
  addChatMessage: (conversationId: string, message: ChatMessage) => Promise<void>;
  deleteChatMessage: (conversationId: string, messageId: string) => Promise<void>;
  chatMutedParticipants: Record<string, string[]>;
  toggleMuteChatMember: (chatId: string, userId: string) => Promise<void>;
  openUserDM: (userId: string) => Promise<void>;
  dmConversations: DMConversation[];
  createDMConversation: (participantId: string) => Promise<DMConversation>;
  updateSwipeEventStatus: (eventId: string, status: SwipeEvent['status'], matchedId?: string) => void;
  invitations: Invitation[];
  swipeNotifications: SwipeNotification[];
  fetchInvitations: () => Promise<void>;
  acceptInvitation: (id: string | number) => Promise<void>;
  declineInvitation: (id: string | number) => Promise<void>;
  markSwipeNotificationRead: (id: string | number) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// ---------------------------------------------------------------------------
// AppInner — sits inside AuthProvider, can call useAuth()
// ---------------------------------------------------------------------------

function AppInner({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const { currentUser } = auth;

  const [groups, setGroups] = useState<Group[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [currentGroup, setCurrentGroup] = useState<Group | null>(null);
  const [swipeEvents, setSwipeEvents] = useState<SwipeEvent[]>([]);
  const [currentSwipeEvent, setCurrentSwipeEvent] = useState<SwipeEvent | null>(null);

  const [chatMessages, setChatMessages] = useState<Record<string, ChatMessage[]>>({});
  const [dmConversations, setDMConversations] = useState<DMConversation[]>([]);
  const [chatMutedParticipants, setChatMutedParticipants] = useState<Record<string, string[]>>({});
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [swipeNotifications, setSwipeNotifications] = useState<SwipeNotification[]>([]);

  // Clean up legacy localStorage keys left by older versions of this app.
  useEffect(() => {
    const LEGACY_KEYS = [
      'mealswipe_seeded', 'mealswipe_version', 'mealswipe_groups',
      'mealswipe_events', 'mealswipe_swipes', 'mealswipe_messages',
      'mealswipe_notifications', 'mealswipe_dm_conversations', 'mealswipe_user',
    ];
    LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
  }, []);

  // ---------------------------------------------------------------------------
  // Data fetch helpers — called when session becomes active
  // ---------------------------------------------------------------------------

  const fetchUserGroups = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/groups/'), { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setGroups(
          data.groups.map((g: BackendGroup) => ({
            id: String(g.id),
            name: g.name,
            members: g.members.map((m: BackendMember) => ({
              userId: String(m.id),
              userName: m.name,
              userPhotoUrl: m.photoUrl ?? '',
              hasFinishedSwiping: false,
              isLeader: m.role === 'leader',
            })),
            createdBy: String(g.created_by),
            createdAt: g.created_at,
            joinCode: g.join_code,
            constraints: g.constraints,
          }))
        );
      }
    } catch (err) {
      console.error('Failed to fetch user groups', err);
    }
  }, []);

  const fetchUserChats = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/chat/'), { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const newMessages: Record<string, ChatMessage[]> = {};
        const dms: DMConversation[] = [];
        const muted: Record<string, string[]> = {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data.chats.forEach((chat: any) => {
          const key = chat.type === 'direct' ? `dm-${chat.id}` : chat.id;
          newMessages[key] = chat.messages || [];
          muted[chat.id] = chat.mutedParticipants || [];
          if (chat.type === 'direct') {
            dms.push({
              id: chat.id,
              participants: chat.participants,
              participantNames: chat.participantNames,
              lastMessageTime: chat.lastMessageTime ?? chat.created_at ?? '',
            });
          }
        });
        setChatMessages(newMessages);
        setDMConversations(dms);
        setChatMutedParticipants(muted);
      }
    } catch (err) {
      console.error('Failed to fetch user chats', err);
    }
  }, []);

  const fetchInvitations = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/groups/invitations/'), { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setInvitations(data.invitations || []);
        setSwipeNotifications(data.swipe_sessions || []);
      }
    } catch (err) {
      console.error('Failed to fetch invitations', err);
    }
  }, []);

  // Load data when user logs in; clear when they log out.
  useEffect(() => {
    if (currentUser) {
      fetchUserGroups();
      fetchUserChats();
      fetchInvitations();
    } else {
      setGroups([]);
      setSwipeEvents([]);
      setChatMessages({});
      setDMConversations([]);
      setInvitations([]);
      setSwipeNotifications([]);
      setCurrentGroup(null);
      setCurrentSwipeEvent(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  // Short-poll for chat and notification updates while logged in.
  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchUserChats();
        fetchInvitations();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [currentUser, fetchUserChats, fetchInvitations]);

  // ---------------------------------------------------------------------------
  // Invitations
  // ---------------------------------------------------------------------------

  const acceptInvitation = async (id: string | number) => {
    try {
      const res = await fetch(apiUrl(`/api/groups/invitations/${id}/accept/`), {
        method: 'POST',
        headers: { 'X-CSRFToken': getCsrf() },
        credentials: 'include',
      });
      if (res.ok) {
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
      const res = await fetch(apiUrl(`/api/groups/invitations/${id}/decline/`), {
        method: 'POST',
        headers: { 'X-CSRFToken': getCsrf() },
        credentials: 'include',
      });
      if (res.ok) await fetchInvitations();
    } catch (err) {
      console.error('Failed to decline invitation', err);
    }
  };

  const markSwipeNotificationRead = async (id: string | number) => {
    try {
      const res = await fetch(apiUrl(`/api/groups/swipe-notifications/${id}/read/`), {
        method: 'POST',
        headers: { 'X-CSRFToken': getCsrf() },
        credentials: 'include',
      });
      if (res.ok) await fetchInvitations();
    } catch (err) {
      console.error('Failed to mark swipe notification read', err);
    }
  };

  // ---------------------------------------------------------------------------
  // Groups
  // ---------------------------------------------------------------------------

  const createGroup = async (
    name: string,
    groupType: string = 'casual',
    defaultLocation: string = 'manhattan',
    privacy: string = 'public'
  ): Promise<Group> => {
    if (!currentUser) throw new Error('Must be logged in');
    const res = await fetch(apiUrl('/api/groups/'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrf() },
      body: JSON.stringify({ name, group_type: groupType, default_location: defaultLocation, privacy }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create group');
    }
    const data = await res.json();
    const bg = data.group;
    const newGroup: Group = {
      id: String(bg.id),
      name: bg.name,
      members: bg.members.map((m: BackendMember) => ({
        userId: String(m.id),
        userName: m.name,
        userPhotoUrl: m.photoUrl ?? '',
        hasFinishedSwiping: false,
        isLeader: m.role === 'leader',
      })),
      createdBy: String(bg.created_by),
      createdAt: bg.created_at,
      joinCode: bg.join_code,
      constraints: bg.constraints,
    };
    setGroups((prev) => [...prev, newGroup]);
    return newGroup;
  };

  const fetchPublicGroups = async (): Promise<Group[]> => {
    try {
      const res = await fetch(apiUrl('/api/groups/public/'), { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        return data.groups.map((g: BackendGroup) => ({
          id: String(g.id),
          name: g.name,
          members: g.members.map((m: BackendMember) => ({
            userId: String(m.id),
            userName: m.name, userPhotoUrl: m.photoUrl ?? "",
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
    const res = await fetch(apiUrl(`/api/groups/join/${code}/`), {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-CSRFToken': getCsrf() },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to join group. Make sure code is correct.');
    await fetchUserGroups();
    await fetchUserChats();
  };

  const regenerateJoinCode = async (groupId: string): Promise<string> => {
    const res = await fetch(apiUrl(`/api/groups/${groupId}/regenerate-code/`), {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-CSRFToken': getCsrf() },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to regenerate code');
    }
    const data = await res.json();
    const newCode: string = data.join_code;
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, joinCode: newCode } : g))
    );
    return newCode;
  };

  const leaveGroup = async (groupId: string): Promise<void> => {
    if (!currentUser) return;
    const res = await fetch(apiUrl(`/api/groups/${groupId}/leave/`), {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-CSRFToken': getCsrf() },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to leave group');
    }
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    if (currentGroup?.id === groupId) setCurrentGroup(null);
  };

  const deleteGroup = async (groupId: string): Promise<void> => {
    if (!currentUser) return;
    const res = await fetch(apiUrl(`/api/groups/${groupId}/delete/`), {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'X-CSRFToken': getCsrf() },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete group');
    }
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    if (currentGroup?.id === groupId) setCurrentGroup(null);
  };

  const removeMember = async (groupId: string, userId: string): Promise<void> => {
    if (!currentUser) return;
    const res = await fetch(apiUrl(`/api/groups/${groupId}/members/${userId}/`), {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'X-CSRFToken': getCsrf() },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to remove member');
    }
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId ? { ...g, members: g.members.filter((m) => m.userId !== userId) } : g
      )
    );
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
          'X-CSRFToken': getCsrf(),
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
    const res = await fetch(apiUrl(`/api/groups/${groupId}/members/${userId}/role/`), {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'X-CSRFToken': getCsrf() },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to promote member');
    }
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? { ...g, members: g.members.map((m) => (m.userId === userId ? { ...m, isLeader: true } : m)) }
          : g
      )
    );
  };

  const inviteMember = async (groupId: string, userEmail: string): Promise<void> => {
    if (!currentUser) return;
    const res = await fetch(apiUrl(`/api/groups/${groupId}/invite/`), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrf() },
      body: JSON.stringify({ email: userEmail }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to invite user');
    }
  };

  const fetchAvailableUsers = useCallback(
    async (query: string = '', groupId?: string) => {
      if (!currentUser) return;
      let url = `/api/groups/users/?q=${encodeURIComponent(query)}`;
      if (groupId) url += `&group_id=${encodeURIComponent(groupId)}`;
      try {
        const res = await fetch(apiUrl(url), { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setAvailableUsers(
            data.users.map((u: BackendUser & { is_invited?: boolean }) => ({
              id: String(u.id),
              email: u.email,
              name: u.name,
              preferences: { cuisines: [], dietary: [], foodTypes: [] },
              is_invited: u.is_invited,
            }))
          );
        }
      } catch (error) {
        console.error('Failed to fetch users:', error);
      }
    },
    [currentUser]
  );

  const getAllUsers = () => availableUsers;

  // ---------------------------------------------------------------------------
  // Swipe events
  // ---------------------------------------------------------------------------

  const createSwipeEvent = async (
    groupId: string,
    name: string,
    borough?: string,
    neighborhood?: string
  ): Promise<SwipeEvent> => {
    const res = await fetch(apiUrl(`/api/groups/${groupId}/events/`), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrf() },
      body: JSON.stringify({ name, borough, neighborhood }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create event');
    const newEvent: SwipeEvent = {
      id: String(data.event.id),
      groupId: String(data.event.group_id),
      name: data.event.name,
      status: data.event.status,
      createdAt: data.event.created_at,
      matchedRestaurantId: data.event.matched_venue_id ? String(data.event.matched_venue_id) : undefined,
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

  const fetchSwipeEvents = useCallback(async (groupId: string, signal?: AbortSignal) => {
    try {
      const res = await fetch(apiUrl(`/api/groups/${groupId}/events/`), {
        credentials: 'include',
        signal,
      });
      const data = await res.json();
      if (data.success) {
        setSwipeEvents(
          data.events.map((e: {
            id: number; group_id: number; name: string; status: string;
            created_at: string; matched_venue_id: number | null;
          }) => ({
            id: String(e.id),
            groupId: String(e.group_id),
            name: e.name,
            status: e.status as SwipeEvent['status'],
            createdAt: e.created_at,
            matchedRestaurantId: e.matched_venue_id ? String(e.matched_venue_id) : undefined,
          }))
        );
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('Failed to fetch swipe events:', error);
    }
  }, []);

  const addSwipe = async (
    eventId: string,
    groupId: string,
    venueId: string,
    direction: 'left' | 'right'
  ) => {
    const res = await fetch(apiUrl(`/api/groups/${groupId}/events/${eventId}/swipes/`), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrf() },
      body: JSON.stringify({ venue_id: Number(venueId), direction }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Failed to submit swipe (${res.status})`);
    }
  };

  const fetchSwipeVenues = useCallback(async (groupId: string, eventId: string): Promise<Restaurant[]> => {
    const res = await fetch(apiUrl(`/api/groups/${groupId}/events/${eventId}/venues/`), {
      credentials: 'include',
    });
    const data = await res.json();
    if (!data.success) throw new Error('Failed to fetch venues');
    return data.venues as Restaurant[];
  }, []);

  const fetchMatchResults = useCallback(async (groupId: string, eventId: string) => {
    const res = await fetch(apiUrl(`/api/groups/${groupId}/events/${eventId}/results/`), {
      credentials: 'include',
    });
    const data = await res.json();
    if (!data.success) throw new Error('Failed to fetch results');
    return {
      match_found: data.match_found as boolean,
      matched_venue: data.matched_venue as Restaurant | null,
      total_participants: data.total_participants as number,
      threshold: data.threshold as number,
      likes_count: data.likes_count as number,
    };
  }, []);

  const updateSwipeEventStatus = (eventId: string, status: SwipeEvent['status'], matchedId?: string) => {
    setSwipeEvents((events) =>
      events.map((e) => (e.id === eventId ? { ...e, status, matchedRestaurantId: matchedId } : e))
    );
  };

  // ---------------------------------------------------------------------------
  // Chat / DMs
  // ---------------------------------------------------------------------------

  const addChatMessage = async (conversationId: string, message: ChatMessage) => {
    const res = await fetch(apiUrl(`/api/chat/${conversationId}/messages/`), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrf() },
      body: JSON.stringify({ message: message.message, message_type: message.type }),
    });
    if (!res.ok) {
      let detail: unknown = null;
      try {
        const ct = res.headers.get('Content-Type') || '';
        detail = ct.includes('application/json') ? await res.json() : await res.text();
      } catch { /* ignore */ }
      throw new Error(typeof detail === 'string' ? detail : 'Failed to send message');
    }
    const data = await res.json();
    setChatMessages((prev) => ({
      ...prev,
      [conversationId]: [...(prev[conversationId] || []), data.message],
    }));
    return data.message;
  };

  const deleteChatMessage = async (conversationId: string, messageId: string) => {
    try {
      const res = await fetch(apiUrl(`/api/chat/${conversationId}/messages/${messageId}/`), {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'X-CSRFToken': getCsrf() },
      });
      if (res.ok) {
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

  const createDMConversation = async (participantId: string): Promise<DMConversation> => {
    if (!currentUser) throw new Error('Must be logged in');
    const res = await fetch(apiUrl('/api/chat/'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrf() },
      body: JSON.stringify({ participantId }),
    });
    if (res.ok) {
      const data = await res.json();
      const chat = data.chat;
      const newDm: DMConversation = {
        id: chat.id,
        participants: chat.participants,
        participantNames: chat.participantNames,
        lastMessageTime: chat.lastMessageTime || chat.created_at,
      };
      setDMConversations((prev) => [...prev.filter((dm) => dm.id !== chat.id), newDm]);
      setChatMessages((prev) => ({ ...prev, [`dm-${chat.id}`]: chat.messages || [] }));
      return newDm;
    }
    throw new Error('Failed to create DM');
  };

  const toggleMuteChatMember = async (chatId: string, userId: string): Promise<void> => {
    const res = await fetch(apiUrl(`/api/chat/${chatId}/members/${userId}/mute/`), {
      method: 'POST',
      headers: { 'X-CSRFToken': getCsrf() },
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to toggle mute');
    await fetchUserChats();
  };

  const openUserDM = async (userId: string): Promise<void> => {
    window.dispatchEvent(new CustomEvent('open-chat-dm', { detail: userId }));
  };

  // ---------------------------------------------------------------------------
  // Render — block until auth is resolved
  // ---------------------------------------------------------------------------

  if (auth.isInitializingAuth) {
    return null;
  }

  return (
    <AppContext.Provider
      value={{
        // Auth (from AuthProvider)
        ...auth,
        // Groups
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
        // Swipe events
        swipeEvents,
        createSwipeEvent,
        fetchSwipeEvents,
        currentSwipeEvent,
        setCurrentSwipeEvent,
        addSwipe,
        fetchSwipeVenues,
        fetchMatchResults,
        updateSwipeEventStatus,
        // Chat / DMs
        chatMessages,
        addChatMessage,
        deleteChatMessage,
        chatMutedParticipants,
        toggleMuteChatMember,
        openUserDM,
        dmConversations,
        createDMConversation,
        // Invitations / notifications
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AppInner>{children}</AppInner>
    </AuthProvider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp(): AppContextType {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
