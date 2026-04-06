import { useNavigate, useLocation } from 'react-router';
import { useVenue } from '@/app/contexts/venue-context';
import { Button } from '@/app/components/ui/button';
import { Store, LogOut, ArrowLeft } from 'lucide-react';

export function VenueTopNav() {
  const { currentManager, logoutVenueManager } = useVenue();
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;

  const handleLogout = async () => {
    await logoutVenueManager();
    navigate('/venue/login');
  };

  // ── Context-aware left side ──────────────────────────────────────────────
  let isDynamic = false;
  let contextTitle = '';
  let contextSubtitle = '';
  let backLink = '/venue/dashboard';

  if (path === '/venue/claim') {
    isDynamic = true;
    contextTitle = 'Claim a Venue';
    contextSubtitle = 'Search and claim your restaurant';
  } else if (/^\/venue\/venue\/\d+\/discounts$/.test(path)) {
    isDynamic = true;
    contextTitle = 'Manage Discounts';
    contextSubtitle = 'Student discount settings';
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
            onClick={() => navigate('/venue/dashboard')}
            aria-label="Go to venue dashboard"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-orange-600 to-amber-600 rounded-xl flex items-center justify-center">
              <Store className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-semibold">Venue Manager</h1>
          </Button>
        ) : (
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(backLink)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold leading-tight">{contextTitle}</h1>
              {contextSubtitle && (
                <p className="text-sm text-muted-foreground leading-tight">{contextSubtitle}</p>
              )}
            </div>
          </div>
        )}

        {/* Right: manager info + logout */}
        <div className="flex items-center gap-3">
          <div className="text-right mr-2 hidden sm:block">
            <p className="text-sm font-medium">
              {currentManager?.businessName || currentManager?.name}
            </p>
            <p className="text-xs text-muted-foreground">{currentManager?.email}</p>
          </div>
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
