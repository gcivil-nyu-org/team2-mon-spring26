import { useNavigate } from 'react-router';
import { useAdmin } from '@/app/contexts/admin-context';
import { Button } from '@/app/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Users, ShieldCheck, Store, UserPlus } from 'lucide-react';

export function AdminDashboardPage() {
  const { currentAdmin, logoutAdmin } = useAdmin();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logoutAdmin();
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen bg-blue-50/40">
      {/* Header bar */}
      <div className="bg-white border-b border-blue-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-blue-900">Admin Dashboard</h1>
            <p className="text-blue-600">
              Welcome back, {currentAdmin?.name || currentAdmin?.email}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleLogout}
            className="border-blue-200 text-blue-700 hover:bg-blue-50"
          >
            Sign Out
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="grid md:grid-cols-3 gap-5">
          <Card
            className="cursor-pointer hover:shadow-lg transition-shadow border-blue-100 hover:border-blue-300"
            onClick={() => navigate('/admin/users')}
          >
            <CardHeader>
              <div className="w-11 h-11 bg-blue-100 rounded-lg flex items-center justify-center mb-2">
                <Users className="w-5.5 h-5.5 text-blue-700" />
              </div>
              <CardTitle className="text-blue-900">Users</CardTitle>
              <CardDescription className="text-blue-500">
                Manage student and venue manager accounts
              </CardDescription>
            </CardHeader>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-lg transition-shadow border-blue-100 hover:border-blue-300"
            onClick={() => navigate('/admin/venue-verification')}
          >
            <CardHeader>
              <div className="w-11 h-11 bg-blue-100 rounded-lg flex items-center justify-center mb-2">
                <ShieldCheck className="w-5.5 h-5.5 text-blue-700" />
              </div>
              <CardTitle className="text-blue-900">Venue Verification</CardTitle>
              <CardDescription className="text-blue-500">
                Review and approve venue manager claims
              </CardDescription>
            </CardHeader>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-lg transition-shadow border-blue-100 hover:border-blue-300"
            onClick={() => navigate('/admin/venues')}
          >
            <CardHeader>
              <div className="w-11 h-11 bg-blue-100 rounded-lg flex items-center justify-center mb-2">
                <Store className="w-5.5 h-5.5 text-blue-700" />
              </div>
              <CardTitle className="text-blue-900">Venues</CardTitle>
              <CardDescription className="text-blue-500">
                Browse and manage all venue listings
              </CardDescription>
            </CardHeader>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-lg transition-shadow border-blue-100 hover:border-blue-300"
            onClick={() => navigate('/admin/register')}
          >
            <CardHeader>
              <div className="w-11 h-11 bg-blue-100 rounded-lg flex items-center justify-center mb-2">
                <UserPlus className="w-5.5 h-5.5 text-blue-700" />
              </div>
              <CardTitle className="text-blue-900">Add New Admin</CardTitle>
              <CardDescription className="text-blue-500">
                Register a new administrator account
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  );
}
