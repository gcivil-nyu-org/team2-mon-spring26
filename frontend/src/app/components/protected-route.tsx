import { Navigate, Outlet, useLocation } from 'react-router';
import { useApp } from '@/app/contexts/app-context';
import { TopNav } from './top-nav';

export function ProtectedRoute() {
  const { currentUser } = useApp();
  const location = useLocation();

  // AppProvider doesn't render children until auth is initialized,
  // so if currentUser is null here, they are definitely not logged in.
  if (!currentUser) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 flex flex-col">
      <TopNav />
      <main className="flex-1 w-full">
        <Outlet />
      </main>
    </div>
  );
}
