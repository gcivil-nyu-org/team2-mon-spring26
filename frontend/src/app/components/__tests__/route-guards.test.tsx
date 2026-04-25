import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router';
import { ProtectedRoute } from '@/app/components/protected-route';
import { AdminProtectedRoute } from '@/app/components/admin-protected-route';
import { VenueProtectedRoute } from '@/app/components/venue-protected-route';

const mockUseApp = vi.fn();
const mockUseAdmin = vi.fn();
const mockUseVenue = vi.fn();

vi.mock('@/app/contexts/app-context', () => ({
  useApp: () => mockUseApp(),
}));
vi.mock('@/app/contexts/admin-context', () => ({
  useAdmin: () => mockUseAdmin(),
}));
vi.mock('@/app/contexts/venue-context', () => ({
  useVenue: () => mockUseVenue(),
}));
vi.mock('@/app/components/top-nav', () => ({
  TopNav: () => <div>TopNav</div>,
}));
vi.mock('@/app/components/admin-top-nav', () => ({
  AdminTopNav: () => <div>AdminTopNav</div>,
}));
vi.mock('@/app/components/venue-top-nav', () => ({
  VenueTopNav: () => <div>VenueTopNav</div>,
}));

function LocationEcho() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

describe('Route Guards', () => {
  beforeEach(() => {
    mockUseApp.mockReset();
    mockUseAdmin.mockReset();
    mockUseVenue.mockReset();
  });

  it('redirects admin away from student route', () => {
    mockUseApp.mockReturnValue({
      currentUser: { id: '1', role: 'admin' },
    });

    render(
      <MemoryRouter initialEntries={['/home']}>
        <Routes>
          <Route path="/" element={<LocationEcho />} />
          <Route path="/admin/dashboard" element={<LocationEcho />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/home" element={<Outlet />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('location').textContent).toBe('/admin/dashboard');
  });

  it('redirects venue manager away from student route', () => {
    mockUseApp.mockReturnValue({
      currentUser: { id: '2', role: 'venue_manager' },
    });

    render(
      <MemoryRouter initialEntries={['/home']}>
        <Routes>
          <Route path="/" element={<LocationEcho />} />
          <Route path="/venue/dashboard" element={<LocationEcho />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/home" element={<Outlet />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('location').textContent).toBe('/venue/dashboard');
  });

  it('rejects non-admin user in admin route guard', () => {
    mockUseAdmin.mockReturnValue({
      authLoading: false,
      currentAdmin: { id: '3', role: 'student' },
    });

    render(
      <MemoryRouter initialEntries={['/admin/dashboard']}>
        <Routes>
          <Route path="/" element={<LocationEcho />} />
          <Route path="/admin/login" element={<LocationEcho />} />
          <Route element={<AdminProtectedRoute />}>
            <Route path="/admin/dashboard" element={<Outlet />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('location').textContent).toBe('/');
  });

  it('rejects non-venue role in venue route guard', () => {
    mockUseVenue.mockReturnValue({
      authLoading: false,
      currentManager: { id: '4', role: 'student' },
    });

    render(
      <MemoryRouter initialEntries={['/venue/dashboard']}>
        <Routes>
          <Route path="/" element={<LocationEcho />} />
          <Route path="/venue/login" element={<LocationEcho />} />
          <Route element={<VenueProtectedRoute />}>
            <Route path="/venue/dashboard" element={<Outlet />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('location').textContent).toBe('/');
  });
});
