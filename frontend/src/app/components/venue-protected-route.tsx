import { Navigate, Outlet, useLocation } from 'react-router';
import { useVenue } from '@/app/contexts/venue-context';
import { useApp } from '@/app/contexts/app-context';
import { VenueTopNav } from '@/app/components/venue-top-nav';

export function VenueProtectedRoute() {
  const { currentManager, authLoading } = useVenue();
  const { currentUser } = useApp();
  const location = useLocation();

  // Wait for the session check to complete before deciding
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="rounded-full h-10 w-10 border-4 border-orange-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!currentManager) {
    if (currentUser?.role === 'admin') {
      return <Navigate to="/admin/dashboard" state={{ from: location }} replace />;
    }
    if (currentUser?.role === 'student') {
      return <Navigate to="/home" state={{ from: location }} replace />;
    }
    return <Navigate to="/venue/login" state={{ from: location }} replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 flex flex-col">
      <VenueTopNav />
      <div className="flex-1 w-full">
        <Outlet />
      </div>
    </div>
  );
}
