import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { apiUrl, getCsrf } from '@/app/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface User {
  id: string;
  name: string;
  email: string;
  role?: 'student' | 'venue_manager' | 'admin';
  photoUrl?: string;
  preferences: {
    cuisines: string[];
    dietary: string[];
    foodTypes: string[];
    minimumSanitationGrade?: string;
    priceRange?: string;
  };
  is_invited?: boolean;
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

export interface AuthContextType {
  currentUser: User | null;
  isInitializingAuth: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  updatePreferences: (preferences: {
    dietary?: string[];
    cuisines?: string[];
    foodTypes?: string[];
    minimumSanitationGrade?: string;
    priceRange?: string;
  }) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  validatePasswordResetToken: (uid: string, token: string) => Promise<void>;
  confirmPasswordReset: (uid: string, token: string, newPassword: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_PREFERENCES = {
  cuisines: [] as string[],
  dietary: [] as string[],
  foodTypes: [] as string[],
  minimumSanitationGrade: 'A' as string,
};

// eslint-disable-next-line react-refresh/only-export-components
export function normalizeApiUser(apiUser: {
  id: number | string;
  email: string;
  name: string;
  role?: 'student' | 'venue_manager' | 'admin';
  photoUrl?: string;
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
    photoUrl: apiUser.photoUrl ?? '',
    preferences: {
      cuisines: Array.isArray(prefs.cuisines) ? prefs.cuisines : DEFAULT_PREFERENCES.cuisines,
      dietary: Array.isArray(prefs.dietary) ? prefs.dietary : DEFAULT_PREFERENCES.dietary,
      foodTypes: Array.isArray(prefs.foodTypes) ? prefs.foodTypes : DEFAULT_PREFERENCES.foodTypes,
      minimumSanitationGrade: grade,
      priceRange: prefs.price_range ?? '',
    },
    is_invited: apiUser.is_invited,
  };
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isInitializingAuth, setIsInitializingAuth] = useState(true);

  // Check existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch(apiUrl('/api/auth/me/'), {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          if (data.authenticated && data.user) {
            setCurrentUser(normalizeApiUser(data.user));
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
    const csrftoken = getCsrf();
    const response = await fetch(apiUrl('/api/auth/login/'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.success) {
      setCurrentUser(normalizeApiUser(data.user));
    } else {
      throw new Error(data.error || `Login failed (${response.status})`);
    }
  };

  const register = async (userData: RegisterData) => {
    const csrftoken = getCsrf();
    const response = await fetch(apiUrl('/api/auth/register/'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
      body: JSON.stringify(userData),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.success) {
      setCurrentUser(normalizeApiUser(data.user));
    } else {
      let errorMessage = data.error || `Registration failed (${response.status})`;
      if (data.errors && typeof data.errors === 'object') {
        const firstKey = Object.keys(data.errors)[0];
        if (firstKey && data.errors[firstKey]?.length > 0) {
          errorMessage = data.errors[firstKey][0];
        }
      }
      throw new Error(errorMessage);
    }
  };

  const logout = async () => {
    try {
      const csrftoken = getCsrf();
      await fetch(apiUrl('/api/auth/logout/'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setCurrentUser(null);
    }
  };

  const updatePreferences = async (preferences: {
    dietary?: string[];
    cuisines?: string[];
    foodTypes?: string[];
    minimumSanitationGrade?: string;
    priceRange?: string;
  }) => {
    const csrftoken = getCsrf();
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
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || 'Failed to update preferences');
    }
    const data = await response.json();
    if (data.user) setCurrentUser(normalizeApiUser(data.user));
  };

  const requestPasswordReset = async (email: string) => {
    const csrftoken = getCsrf();
    const response = await fetch(apiUrl('/api/auth/request-password-reset/'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
      body: JSON.stringify({ email }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Request failed');
    }
  };

  const validatePasswordResetToken = async (uid: string, token: string) => {
    const csrftoken = getCsrf();
    const response = await fetch(apiUrl('/api/auth/validate-password-reset-token/'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
      body: JSON.stringify({ uid, token }),
    });
    const data = await response.json();
    if (!response.ok || !data.success || !data.valid) {
      throw new Error(data.error || 'Invalid or expired reset link');
    }
  };

  const confirmPasswordReset = async (uid: string, token: string, newPassword: string) => {
    const csrftoken = getCsrf();
    const response = await fetch(apiUrl('/api/auth/confirm-password-reset/'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
      body: JSON.stringify({ uid, token, new_password: newPassword }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to reset password');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isInitializingAuth,
        login,
        register,
        logout,
        updatePreferences,
        requestPasswordReset,
        validatePasswordResetToken,
        confirmPasswordReset,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
