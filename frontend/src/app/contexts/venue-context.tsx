import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { apiUrl, getCsrf } from '@/app/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface VenueManager {
  id: string;
  email: string;
  name: string;
  role: 'venue_manager';
  photoUrl?: string;
  businessName: string;
  businessEmail: string;
  businessPhone: string;
  isVerified: boolean;
}

export interface VenueSearchResult {
  id: number;
  name: string;
  streetAddress: string;
  borough: string;
  neighborhood: string;
  zipcode: string;
  phone: string;
  website: string;
  cuisineType: string;
  priceRange: string;
  sanitationGrade: string;
  seatingCapacity: number | null;
  hasGroupSeating: boolean;
  hasTakeout: boolean;
  hasDelivery: boolean;
  hasDineIn: boolean;
  isReservable: boolean;
  googleRating: number | null;
  googleReviewCount: number;
  googleMapsUrl: string;
  dietaryTags: string[];
  lastInspectionDate: string | null;
  lastInspectionGrade: string;
  lastInspectionScore: number | null;
  hasStudentDiscount: boolean;
  isClaimed: boolean;
  claimedBy: string | null;
}

export interface StudentDiscount {
  id: number;
  venueId: number;
  discountType: string;
  discountValue: string;
  description: string;
  requiresNyuId: boolean;
  isActive: boolean;
  validFrom: string | null;
  validUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewAuthor {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface ReviewComment {
  id: number;
  content: string;
  isManagerResponse: boolean;
  isFlagged: boolean;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
  author: ReviewAuthor;
}

export interface VenueReview {
  id: number;
  venueId: number;
  rating: number;
  title: string;
  content: string;
  visitDate: string;
  additionalPhotos: string[];
  isFlagged: boolean;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
  author: ReviewAuthor;
  comments: ReviewComment[];
}

export interface VenueReviewsPayload {
  venue: {
    id: number;
    name: string;
    streetAddress: string;
    borough: string;
    priceRange: string;
    cuisineType: string;
  };
  canReply: boolean;
  reviews: VenueReview[];
}

export interface ManagedVenue {
  id: number;
  name: string;
  streetAddress: string;
  borough: string;
  neighborhood: string;
  zipcode: string;
  phone: string;
  email: string;
  website: string;
  cuisineType: string;
  priceRange: string;
  sanitationGrade: string;
  seatingCapacity: number | null;
  hasGroupSeating: boolean;
  hasTakeout: boolean;
  hasDelivery: boolean;
  hasDineIn: boolean;
  isReservable: boolean;
  googleRating: number | null;
  googleReviewCount: number;
  googleMapsUrl: string;
  isVerified: boolean;
  isActive: boolean;
  dietaryTags: string[];
  lastInspectionDate: string | null;
  lastInspectionGrade: string;
  lastInspectionScore: number | null;
  isClaimed: boolean;
  claimStatus: 'pending' | 'approved' | 'rejected' | null;
  activeDiscounts: StudentDiscount[];
}

export interface VenueClaim {
  id: number;
  status: 'pending' | 'approved' | 'rejected';
  note?: string;
  adminNote?: string;
  createdAt: string;
  reviewedAt: string | null;
  venue: {
    id: number;
    name: string;
    streetAddress: string;
    borough: string;
  };
}

export interface DiscountFormData {
  discountType: string;
  discountValue: string;
  description: string;
  requiresNyuId: boolean;
  isActive: boolean;
  validFrom: string;
  validUntil: string;
}

interface VenueContextType {
  currentManager: VenueManager | null;
  myVenues: ManagedVenue[];
  authLoading: boolean;
  venuesLoading: boolean;
  loginVenueManager: (email: string, password: string) => Promise<void>;
  registerVenueManager: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    businessName: string;
    businessEmail?: string;
    businessPhone?: string;
  }) => Promise<void>;
  logoutVenueManager: () => Promise<void>;
  fetchMyVenues: () => Promise<void>;
  searchVenues: (q: string, borough?: string) => Promise<VenueSearchResult[]>;
  claimVenue: (venueId: number, note?: string) => Promise<void>;
  fetchVenueDetail: (venueId: number) => Promise<ManagedVenue>;
  fetchDiscounts: (venueId: number) => Promise<StudentDiscount[]>;
  fetchVenueReviews: (venueId: number) => Promise<VenueReviewsPayload>;
  replyToReview: (venueId: number, reviewId: number, content: string) => Promise<ReviewComment>;
  createDiscount: (venueId: number, data: DiscountFormData) => Promise<StudentDiscount>;
  updateDiscount: (venueId: number, discountId: number, data: Partial<DiscountFormData>) => Promise<StudentDiscount>;
  deleteDiscount: (venueId: number, discountId: number) => Promise<void>;

  // Legacy fields to fix typescript errors in unmigrated pages
  myClaims: VenueClaim[];
  addRestaurant: (data: unknown) => void;
  updateRestaurant: (id: string | number, data: unknown) => void;
  restaurants: unknown[];
}

// ── Context ───────────────────────────────────────────────────────────────────

const VenueContext = createContext<VenueContextType | undefined>(undefined);

// ── Provider ──────────────────────────────────────────────────────────────────

export function VenueProvider({ children }: { children: ReactNode }) {
  const [currentManager, setCurrentManager] = useState<VenueManager | null>(null);
  const [myVenues, setMyVenues] = useState<ManagedVenue[]>([]);
  const [myClaims, setMyClaims] = useState<VenueClaim[]>([]);
  const [authLoading, setAuthLoading] = useState(true);
  const [venuesLoading, setVenuesLoading] = useState(false);

  // Re-hydrate session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch(apiUrl('/api/auth/me/'), { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          if (data.authenticated && data.user?.role === 'venue_manager') {
            setCurrentManager(_apiUserToManager(data.user));
          }
        }
      } catch {
        // no session
      } finally {
        setAuthLoading(false);
      }
    };
    checkSession();
  }, []);

  const loginVenueManager = async (email: string, password: string) => {
    const csrftoken = getCsrf();
    const response = await fetch(apiUrl('/api/auth/login/'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Login failed');
    }
    if (data.user?.role !== 'venue_manager') {
      throw new Error('This account is not a venue manager account');
    }
    setCurrentManager(_apiUserToManager(data.user));
  };

  const registerVenueManager = async (formData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    businessName: string;
    businessEmail?: string;
    businessPhone?: string;
  }) => {
    const csrftoken = getCsrf();
    const response = await fetch(apiUrl('/api/auth/venue-register/'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
      body: JSON.stringify(formData),
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Registration failed');
    }
    setCurrentManager(_apiUserToManager(data.user));
  };

  const logoutVenueManager = async () => {
    const csrftoken = getCsrf();
    await fetch(apiUrl('/api/auth/logout/'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-CSRFToken': csrftoken },
    });
    setCurrentManager(null);
    setMyVenues([]);
  };

  const fetchMyVenues = useCallback(async () => {
    setVenuesLoading(true);
    try {
      const response = await fetch(apiUrl('/api/venues/my-venues/'), { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setMyVenues(data.venues ?? []);
        setMyClaims(data.claims ?? []);
      }
    } finally {
      setVenuesLoading(false);
    }
  }, []);

  const searchVenues = async (q: string, borough?: string): Promise<VenueSearchResult[]> => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (borough) params.set('borough', borough);
    const response = await fetch(apiUrl(`/api/venues/search/?${params.toString()}`), {
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Search failed');
    const data = await response.json();
    return data.results ?? [];
  };

  const claimVenue = async (venueId: number, note = '') => {
    const csrftoken = getCsrf();
    const response = await fetch(apiUrl(`/api/venues/${venueId}/claim/`), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
      body: JSON.stringify({ note }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to claim venue');
    // Refresh the manager's venue list after a successful claim
    await fetchMyVenues();
  };

  const fetchVenueDetail = async (venueId: number): Promise<ManagedVenue> => {
    const response = await fetch(apiUrl(`/api/venues/${venueId}/`), { credentials: 'include' });
    if (!response.ok) throw new Error('Venue not found');
    const data = await response.json();
    return data.venue;
  };

  const fetchDiscounts = async (venueId: number): Promise<StudentDiscount[]> => {
    const response = await fetch(apiUrl(`/api/venues/${venueId}/discounts/`), { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch discounts');
    const data = await response.json();
    return data.discounts ?? [];
  };

  const fetchVenueReviews = async (venueId: number): Promise<VenueReviewsPayload> => {
    const response = await fetch(apiUrl(`/api/venues/${venueId}/reviews/`), {
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch reviews');
    }
    return data as VenueReviewsPayload;
  };

  const replyToReview = async (venueId: number, reviewId: number, content: string): Promise<ReviewComment> => {
    const csrftoken = getCsrf();
    const response = await fetch(apiUrl(`/api/venues/${venueId}/reviews/${reviewId}/comments/`), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
      body: JSON.stringify({ content }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to post reply');
    }
    return data.comment as ReviewComment;
  };

  const createDiscount = async (venueId: number, formData: DiscountFormData): Promise<StudentDiscount> => {
    const csrftoken = getCsrf();
    const response = await fetch(apiUrl(`/api/venues/${venueId}/discounts/`), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
      body: JSON.stringify(formData),
    });
    const data = await _parseJsonOrThrow(response, 'Failed to create discount');
    if (!response.ok) throw new Error(String(data.error) || 'Failed to create discount');
    return data.discount as StudentDiscount;
  };

  const updateDiscount = async (
    venueId: number,
    discountId: number,
    formData: Partial<DiscountFormData>
  ): Promise<StudentDiscount> => {
    const csrftoken = getCsrf();
    const response = await fetch(apiUrl(`/api/venues/${venueId}/discounts/${discountId}/`), {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
      body: JSON.stringify(formData),
    });
    const data = await _parseJsonOrThrow(response, 'Failed to update discount');
    if (!response.ok) throw new Error(String(data.error) || 'Failed to update discount');
    return data.discount as StudentDiscount;
  };

  const deleteDiscount = async (venueId: number, discountId: number) => {
    const csrftoken = getCsrf();
    const response = await fetch(apiUrl(`/api/venues/${venueId}/discounts/${discountId}/`), {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'X-CSRFToken': csrftoken },
    });
    if (!response.ok) {
      const data = await _parseJsonOrThrow(response, 'Failed to delete discount');
      throw new Error((data as { error?: string }).error || 'Failed to delete discount');
    }
  };

  return (
    <VenueContext.Provider value={{
      currentManager,
      myVenues,
      authLoading,
      venuesLoading,
      loginVenueManager,
      registerVenueManager,
      logoutVenueManager,
      fetchMyVenues,
      searchVenues,
      claimVenue,
      fetchVenueDetail,
      fetchDiscounts,
      fetchVenueReviews,
      replyToReview,
      createDiscount,
      updateDiscount,
      deleteDiscount,
      myClaims,
      restaurants: [],
      addRestaurant: () => {},
      updateRestaurant: () => {},
    }}>
      {children}
    </VenueContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

// eslint-disable-next-line react-refresh/only-export-components
export function useVenue() {
  const context = useContext(VenueContext);
  if (!context) throw new Error('useVenue must be used within a VenueProvider');
  return context;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Parse a fetch Response as JSON. If the body is not JSON (e.g. Django HTML 500),
 *  throws an Error with a human-readable message instead of a raw JSON parse error. */
async function _parseJsonOrThrow(response: Response, fallback: string): Promise<Record<string, unknown>> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    // Non-JSON body — read as text so we can log it, then throw a clean message
    const text = await response.text().catch(() => '');
    console.error(`[venue-api] Expected JSON but got ${response.status} — body starts with: ${text.slice(0, 200)}`);
    throw new Error(`Server error (${response.status}): ${fallback}`);
  }
  return response.json();
}

function _apiUserToManager(apiUser: {
  id: number | string;
  email: string;
  name: string;
  role: string;
  photoUrl?: string;
  venueManager?: {
    businessName: string;
    businessEmail: string;
    businessPhone: string;
    isVerified: boolean;
  } | null;
}): VenueManager {
  return {
    id: String(apiUser.id),
    email: apiUser.email,
    name: apiUser.name,
    role: 'venue_manager',
    photoUrl: apiUser.photoUrl ?? '',
    businessName: apiUser.venueManager?.businessName ?? '',
    businessEmail: apiUser.venueManager?.businessEmail ?? '',
    businessPhone: apiUser.venueManager?.businessPhone ?? '',
    isVerified: apiUser.venueManager?.isVerified ?? false,
  };
}
