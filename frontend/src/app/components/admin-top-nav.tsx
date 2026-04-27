import { useNavigate, useLocation } from 'react-router';
import { useAdmin } from '@/app/contexts/admin-context';
import { Button } from '@/app/components/ui/button';
import { UserAvatar } from '@/app/components/user-avatar';
import { ShieldCheck, LogOut, ArrowLeft } from 'lucide-react';

export function AdminTopNav() {
  const { currentAdmin, logoutAdmin } = useAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;

  const handleLogout = async () => {
    await logoutAdmin();
    navigate('/admin/login');
  };

  // Context-aware left side
  let isDynamic = false;
  let contextTitle = '';
  let contextSubtitle = '';
  let backLink = '/admin/dashboard';

  if (path === '/admin/register') {
    isDynamic = true;
    contextTitle = 'Add New Admin';
    contextSubtitle = 'Register a new administrator account';
  } else if (path === '/admin/venue-verification') {
    isDynamic = true;
    contextTitle = 'Venue Verification';
    contextSubtitle = 'Review venue manager claims';
  } else if (path === '/admin/venues') {
    isDynamic = true;
    contextTitle = 'Venue Management';
    contextSubtitle = 'Browse and manage all venues';
  } else if (/^\/admin\/venues\/\d+$/.test(path)) {
    isDynamic = true;
    backLink = '/admin/venues';
    contextTitle = 'Edit Venue';
    contextSubtitle = 'Update venue details';
  } else if (path === '/admin/users') {
    isDynamic = true;
    contextTitle = 'User Management';
    contextSubtitle = 'Search, edit, and remove user profiles';
  } else if (/^\/admin\/users\/\d+$/.test(path)) {
    isDynamic = true;
    backLink = '/admin/users';
    contextTitle = 'Edit User';
    contextSubtitle = 'Update user profile';
  } else if (path === '/admin/moderation') {
    isDynamic = true;
    contextTitle = 'Moderation Queue';
    contextSubtitle = 'Review flagged reviews and comments';
  }

  return (
    <header className="bg-white border-b sticky top-0 z-50 h-[73px]">
      <div className="max-w-4xl mx-auto px-4 h-full flex items-center justify-between">
        {/* Left: logo or back arrow */}
        {!isDynamic ? (
          <Button
            type="button"
            variant="ghost"
            className="flex items-center gap-3 h-auto p-0 hover:bg-transparent"
            onClick={() => navigate('/admin/dashboard')}
            aria-label="Go to admin dashboard"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-xl flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-semibold">Admin Portal</h1>
          </Button>
        ) : (
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(backLink)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold leading-tight">{contextTitle}</h1>
              {contextSubtitle && (
                <p className="text-sm text-muted-foreground leading-tight">
                  {contextSubtitle}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Right: admin info + logout */}
        <div className="flex items-center gap-3">
          <div className="text-right mr-2 hidden sm:block">
            <p className="text-sm font-medium">
              {currentAdmin?.name || currentAdmin?.email}
            </p>
            {currentAdmin?.name && (
              <p className="text-xs text-muted-foreground">{currentAdmin.email}</p>
            )}
          </div>
          <UserAvatar
            name={currentAdmin?.name}
            email={currentAdmin?.email}
            role="admin"
            size={40}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="text-muted-foreground hover:text-foreground"
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
