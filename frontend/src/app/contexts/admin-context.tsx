import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiUrl, getCsrf } from '@/app/lib/api';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'admin';
}

interface AdminContextType {
  currentAdmin: AdminUser | null;
  authLoading: boolean;
  loginAdmin: (email: string, password: string) => Promise<void>;
  registerAdmin: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) => Promise<void>;
  logoutAdmin: () => Promise<void>;
  requestAdminPasswordReset: (email: string) => Promise<void>;
  validateAdminPasswordResetToken: (uid: string, token: string) => Promise<void>;
  confirmAdminPasswordReset: (
    uid: string,
    token: string,
    newPassword: string
  ) => Promise<void>;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [currentAdmin, setCurrentAdmin] = useState<AdminUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch(apiUrl('/api/auth/me/'), {
          credentials: 'include',
        });
        if (!response.ok) return;
        const data = await response.json();
        if (data.authenticated && data.user?.role === 'admin') {
          setCurrentAdmin({
            id: String(data.user.id),
            email: data.user.email,
            name: data.user.name,
            role: 'admin',
          });
        }
      } catch {
        // no-op
      } finally {
        setAuthLoading(false);
      }
    };
    checkSession();
  }, []);

  const loginAdmin = async (email: string, password: string) => {
    const csrftoken = getCsrf();
    const response = await fetch(apiUrl('/api/auth/admin-login/'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Admin login failed');
    }
    setCurrentAdmin({
      id: String(data.user.id),
      email: data.user.email,
      name: data.user.name,
      role: 'admin',
    });
  };

  const registerAdmin = async (formData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) => {
    const csrftoken = getCsrf();
    const response = await fetch(apiUrl('/api/auth/admin-register/'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrftoken },
      body: JSON.stringify(formData),
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Admin registration failed');
    }
    // The calling admin remains the active session; the new account is created
    // server-side but not logged in automatically.
  };

  const logoutAdmin = async () => {
    const csrftoken = getCsrf();
    await fetch(apiUrl('/api/auth/logout/'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-CSRFToken': csrftoken },
    });
    setCurrentAdmin(null);
  };

  const requestAdminPasswordReset = async (email: string) => {
    const csrftoken = getCsrf();
    const response = await fetch(apiUrl('/api/auth/admin-request-password-reset/'), {
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

  const validateAdminPasswordResetToken = async (uid: string, token: string) => {
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

  const confirmAdminPasswordReset = async (
    uid: string,
    token: string,
    newPassword: string
  ) => {
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
    <AdminContext.Provider
      value={{
        currentAdmin,
        authLoading,
        loginAdmin,
        registerAdmin,
        logoutAdmin,
        requestAdminPasswordReset,
        validateAdminPasswordResetToken,
        confirmAdminPasswordReset,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) throw new Error('useAdmin must be used within an AdminProvider');
  return context;
}
