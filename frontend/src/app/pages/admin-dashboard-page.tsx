import { useNavigate } from 'react-router';
import { useAdmin } from '@/app/contexts/admin-context';
import { Card, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Users, ShieldCheck, Store, UserPlus, Flag } from 'lucide-react';

export function AdminDashboardPage() {
  const { currentAdmin } = useAdmin();
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Welcome */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold">
          Welcome back, {currentAdmin?.name || currentAdmin?.email}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage users, venues, and verification requests from here.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/admin/users')}
        >
          <CardHeader className="pb-6">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-3">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <CardTitle className="mb-2">Users</CardTitle>
            <CardDescription>
              Manage student and venue manager accounts
            </CardDescription>
          </CardHeader>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/admin/venue-verification')}
        >
          <CardHeader className="pb-6">
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-3">
              <ShieldCheck className="w-6 h-6 text-indigo-600" />
            </div>
            <CardTitle className="mb-2">Venue Verification</CardTitle>
            <CardDescription>
              Review and approve venue manager claims
            </CardDescription>
          </CardHeader>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/admin/venues')}
        >
          <CardHeader className="pb-6">
            <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center mb-3">
              <Store className="w-6 h-6 text-violet-600" />
            </div>
            <CardTitle className="mb-2">Venues</CardTitle>
            <CardDescription>
              Browse and manage all venue listings
            </CardDescription>
          </CardHeader>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/admin/register')}
        >
          <CardHeader className="pb-6">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-3">
              <UserPlus className="w-6 h-6 text-purple-600" />
            </div>
            <CardTitle className="mb-2">Add New Admin</CardTitle>
            <CardDescription>
              Register a new administrator account
            </CardDescription>
          </CardHeader>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/admin/moderation')}
        >
          <CardHeader className="pb-6">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mb-3">
              <Flag className="w-6 h-6 text-red-600" />
            </div>
            <CardTitle className="mb-2">Moderation Queue</CardTitle>
            <CardDescription>
              Review flagged reviews and comments
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
