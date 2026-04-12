import { Navigate, Outlet, useLocation } from 'react-router';
import { useAdmin } from '@/app/contexts/admin-context';

export function AdminProtectedRoute() {
  const { currentAdmin, authLoading } = useAdmin();
  const location = useLocation();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="rounded-full h-10 w-10 border-4 border-slate-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!currentAdmin) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Outlet />
    </div>
  );
}
