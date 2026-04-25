import { Navigate, Outlet, useLocation } from 'react-router';
import { useAdmin } from '@/app/contexts/admin-context';
import { AdminTopNav } from '@/app/components/admin-top-nav';

export function AdminProtectedRoute() {
  const { currentAdmin, authLoading } = useAdmin();
  const location = useLocation();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
        <div className="rounded-full h-10 w-10 border-4 border-indigo-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!currentAdmin) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }
  if (currentAdmin.role !== 'admin') {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 flex flex-col">
      <AdminTopNav />
      <main className="flex-1 w-full">
        <Outlet />
      </main>
    </div>
  );
}
