import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export interface Restaurant {
  id: string;
  name: string;
  address: string;
  borough: string;
  neighborhood: string;
  cuisine: string;
  priceRange: '$' | '$$' | '$$$' | '$$$$' | '';
  sanitationGrade: 'A' | 'B' | 'C' | 'Pending' | '';
  seatingCapacity: number;
  groupSeating: boolean;
  dietaryOptions: string[];
  phoneNumber: string;
  email: string;
  managerId: string;
  isVerified: boolean;
  studentDiscount: boolean;
  discountDetails?: string;
  lastInspection: string;
}

export interface VenueSearchResult {
  id: number;
  name: string;
  street_address: string;
  borough: string;
  neighborhood: string;
  price_range: string;
  sanitation_grade: string;
  seating_capacity: number | null;
  has_group_seating: boolean;
  phone: string;
  email: string;
  is_verified: boolean;
  cuisine_type: string;
  dietary_tags: string[];
  google_rating: string | null;
  mealswipe_rating: string;
  has_student_discount: boolean;
  discount_details: string;
}

export interface VenueManager {
  id: string;
  name: string;
  email: string;
  businessName: string;
  role: string;
  isVerified: boolean;
}

interface VenueContextType {
  restaurants: Restaurant[];
  currentManager: VenueManager | null;
  venueError: string;
  venueLoading: boolean;
  loginVenueManager: (email: string, password: string) => Promise<boolean>;
  registerVenueManager: (
    name: string,
    email: string,
    businessName: string,
    password: string
  ) => Promise<boolean>;
  logoutVenueManager: () => void;
  searchVenues: (query: string) => Promise<VenueSearchResult[]>;
  claimVenue: (
    venueId: number,
    hasStudentDiscount: boolean,
    discountDetails: string
  ) => Promise<boolean>;
  unclaimVenue: (venueId: string) => Promise<boolean>;
  updateDiscount: (
    venueId: string,
    hasStudentDiscount: boolean,
    discountDetails: string
  ) => Promise<boolean>;
  fetchManagerVenues: () => Promise<void>;
}

const VenueContext = createContext<VenueContextType | undefined>(undefined);

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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

function apiUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

function mapApiVenueToRestaurant(v: VenueSearchResult): Restaurant {
  return {
    id: String(v.id),
    name: v.name,
    address: v.street_address,
    borough: v.borough,
    neighborhood: v.neighborhood,
    cuisine: v.cuisine_type,
    priceRange: (v.price_range as Restaurant['priceRange']) || '',
    sanitationGrade: (v.sanitation_grade as Restaurant['sanitationGrade']) || '',
    seatingCapacity: v.seating_capacity || 0,
    groupSeating: v.has_group_seating,
    dietaryOptions: v.dietary_tags,
    phoneNumber: v.phone,
    email: v.email,
    isVerified: v.is_verified,
    managerId: '',
    studentDiscount: v.has_student_discount || false,
    discountDetails: v.discount_details || '',
    lastInspection: '',
  };
}

export function VenueProvider({ children }: { children: ReactNode }) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [currentManager, setCurrentManager] = useState<VenueManager | null>(() => {
    const stored = localStorage.getItem('venueUser');
    return stored ? JSON.parse(stored) : null;
  });
  const [venueError, setVenueError] = useState('');
  const [venueLoading, setVenueLoading] = useState(false);

  useEffect(() => {
    if (currentManager) {
      fetchManagerVenues();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loginVenueManager = async (email: string, password: string): Promise<boolean> => {
    setVenueError('');
    setVenueLoading(true);
    try {
      const csrftoken = getCookie('csrftoken') || '';
      const response = await fetch(apiUrl('/api/auth/venue/login/'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setVenueError(data.error || 'Invalid email or password');
        return false;
      }
      const manager: VenueManager = {
        id: String(data.user.id),
        name: data.user.name,
        email: data.user.email,
        businessName: data.user.businessName,
        role: data.user.role,
        isVerified: data.user.isVerified,
      };
      setCurrentManager(manager);
      localStorage.setItem('venueUser', JSON.stringify(manager));
      await fetchManagerVenues();
      return true;
    } catch (err) {
      console.error('Venue login error:', err);
      setVenueError('Unable to connect to server. Please try again.');
      return false;
    } finally {
      setVenueLoading(false);
    }
  };

  const registerVenueManager = async (
    name: string,
    email: string,
    businessName: string,
    password: string
  ): Promise<boolean> => {
    setVenueError('');
    setVenueLoading(true);
    try {
      const csrftoken = getCookie('csrftoken') || '';
      const response = await fetch(apiUrl('/api/auth/venue/register/'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
        body: JSON.stringify({ name, email, businessName, password }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setVenueError(data.error || 'Registration failed');
        return false;
      }
      const manager: VenueManager = {
        id: String(data.user.id),
        name: data.user.name,
        email: data.user.email,
        businessName: data.user.businessName,
        role: data.user.role,
        isVerified: data.user.isVerified,
      };
      setCurrentManager(manager);
      localStorage.setItem('venueUser', JSON.stringify(manager));
      return true;
    } catch (err) {
      console.error('Venue register error:', err);
      setVenueError('Unable to connect to server. Please try again.');
      return false;
    } finally {
      setVenueLoading(false);
    }
  };

  const logoutVenueManager = () => {
    setCurrentManager(null);
    setRestaurants([]);
    localStorage.removeItem('venueUser');
  };

  const fetchManagerVenues = async (): Promise<void> => {
    try {
      const response = await fetch(apiUrl('/api/venues/my-venues/'), {
        credentials: 'include',
      });
      if (!response.ok) return;
      const data = await response.json();
      if (data.success && data.venues) {
        setRestaurants(data.venues.map(mapApiVenueToRestaurant));
      }
    } catch (err) {
      console.error('Failed to fetch manager venues:', err);
    }
  };

  const searchVenues = async (query: string): Promise<VenueSearchResult[]> => {
    if (query.length < 2) return [];
    try {
      const response = await fetch(
        apiUrl(`/api/venues/search/?q=${encodeURIComponent(query)}`),
        { credentials: 'include' }
      );
      if (!response.ok) return [];
      const data = await response.json();
      return data.venues || [];
    } catch (err) {
      console.error('Venue search error:', err);
      return [];
    }
  };

  const claimVenue = async (
    venueId: number,
    hasStudentDiscount: boolean,
    discountDetails: string
  ): Promise<boolean> => {
    setVenueError('');
    setVenueLoading(true);
    try {
      const csrftoken = getCookie('csrftoken') || '';
      const response = await fetch(apiUrl('/api/venues/claim/'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
        body: JSON.stringify({
          venue_id: venueId,
          has_student_discount: hasStudentDiscount,
          discount_details: discountDetails,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setVenueError(data.error || 'Failed to claim venue');
        return false;
      }
      await fetchManagerVenues();
      return true;
    } catch (err) {
      console.error('Claim venue error:', err);
      setVenueError('Unable to connect to server. Please try again.');
      return false;
    } finally {
      setVenueLoading(false);
    }
  };

  const unclaimVenue = async (venueId: string): Promise<boolean> => {
    try {
      const csrftoken = getCookie('csrftoken') || '';
      const response = await fetch(apiUrl(`/api/venues/${venueId}/unclaim/`), {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRFToken': csrftoken },
      });
      if (!response.ok) return false;
      setRestaurants((prev) => prev.filter((r) => r.id !== venueId));
      return true;
    } catch (err) {
      console.error('Unclaim venue error:', err);
      return false;
    }
  };

  const updateDiscount = async (
    venueId: string,
    hasStudentDiscount: boolean,
    discountDetails: string
  ): Promise<boolean> => {
    try {
      const csrftoken = getCookie('csrftoken') || '';
      const response = await fetch(apiUrl(`/api/venues/${venueId}/discount/`), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
        body: JSON.stringify({
          has_student_discount: hasStudentDiscount,
          discount_details: discountDetails,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) return false;
      // Update the restaurant in local state
      setRestaurants((prev) =>
        prev.map((r) =>
          r.id === venueId
            ? {
                ...r,
                studentDiscount: hasStudentDiscount,
                discountDetails: hasStudentDiscount ? discountDetails : '',
              }
            : r
        )
      );
      return true;
    } catch (err) {
      console.error('Update discount error:', err);
      return false;
    }
  };

  return (
    <VenueContext.Provider
      value={{
        restaurants,
        currentManager,
        venueError,
        venueLoading,
        loginVenueManager,
        registerVenueManager,
        logoutVenueManager,
        searchVenues,
        claimVenue,
        unclaimVenue,
        updateDiscount,
        fetchManagerVenues,
      }}
    >
      {children}
    </VenueContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useVenue() {
  const context = useContext(VenueContext);
  if (!context) {
    throw new Error('useVenue must be used within a VenueProvider');
  }
  return context;
}
