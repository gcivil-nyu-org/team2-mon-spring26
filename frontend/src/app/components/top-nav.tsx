import { useNavigate, useLocation } from 'react-router';
import { useApp } from '@/app/contexts/app-context';
import { Button } from '@/app/components/ui/button';
import { UtensilsCrossed, LogOut, Bell, Check, X, ArrowLeft } from 'lucide-react';
import { Badge } from '@/app/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';
import { ScrollArea } from '@/app/components/ui/scroll-area';

export function TopNav() {
  const { currentUser, groups, swipeEvents, logout, invitations, acceptInvitation, declineInvitation, swipeNotifications, markSwipeNotificationRead } = useApp();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const pendingCount = invitations.length + swipeNotifications.filter(n => !n.is_read).length;

  const location = useLocation();
  const path = location.pathname;

  // Derive Contextual Info
  let isDynamic = false;
  let contextTitle = '';
  let contextSubtitle = '';
  let backLink = '/home';

  if (path === '/preferences') {
    isDynamic = true;
    contextTitle = 'Preferences';
  } else if (path === '/create-group') {
    isDynamic = true;
    contextTitle = 'Create New Group';
  } else if (/^\/group\/[^/]+\/plan$/.test(path)) {
    isDynamic = true;
    const groupId = path.split('/')[2];
    const group = groups.find(g => g.id === groupId);
    if (group) {
      backLink = `/group/${group.id}`;
      contextTitle = 'Plan Reservation';
      contextSubtitle = `For ${group.name}`;
    }
  } else if (path.startsWith('/group/')) {
    isDynamic = true;
    const groupId = path.split('/')[2];
    const group = groups.find(g => g.id === groupId);
    if (group) {
      contextTitle = group.name;
      contextSubtitle = `${group.members.length} member${group.members.length !== 1 ? 's' : ''}`;
    }
  } else if (path.startsWith('/swipe/') || path.startsWith('/match/')) {
    isDynamic = true;
    const eventId = path.split('/')[2];
    const event = swipeEvents.find(e => e.id === eventId);
    const group = event ? groups.find(g => g.id === event.groupId) : null;
    if (event && group) {
      backLink = `/group/${group.id}`;
      contextTitle = event.name;
      contextSubtitle = group.name;
    }
  }

  return (
    <header className="bg-white border-b sticky top-0 z-50 h-[73px]">
      <div className="max-w-4xl mx-auto px-4 h-full flex items-center justify-between">
        {!isDynamic ? (
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/home')}>
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center">
              <UtensilsCrossed className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-semibold">Meal Swipe</h1>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(backLink)}
            >
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
        <div className="flex items-center gap-3">
          <div className="text-right mr-2 hidden sm:block">
            <p className="text-sm font-medium">{currentUser?.name}</p>
            <p className="text-xs text-muted-foreground">{currentUser?.email}</p>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="w-5 h-5" />
                {pendingCount > 0 && (
                  <Badge className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 bg-red-500 text-xs px-1.5 py-0.5 min-w-[18px] h-[18px] flex items-center justify-center">
                    {pendingCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <div className="flex items-center justify-between py-3 px-4 border-b bg-gray-50/50">
                <p className="text-sm font-semibold">Notifications</p>
                {pendingCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {pendingCount} new
                  </Badge>
                )}
              </div>
              {invitations.length === 0 && swipeNotifications.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No Notifications
                </div>
              ) : (
                <ScrollArea className="max-h-96">
                  <div className="divide-y">
                    {invitations.map((invitation) => (
                      <div key={invitation.id} className="p-4 bg-purple-50/50 hover:bg-purple-50 transition-colors">
                        <p className="text-sm mb-2">
                          <span className="font-semibold">{invitation.inviter_name}</span> invited you to join <span className="font-semibold">"{invitation.group_name}"</span>
                        </p>
                        <div className="flex items-center gap-2 mt-3">
                          <Button size="sm" className="flex-1 text-xs" onClick={() => acceptInvitation(invitation.id)}>
                            <Check className="w-3 h-3 mr-1" /> Accept
                          </Button>
                          <Button size="sm" variant="outline" className="flex-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => declineInvitation(invitation.id)}>
                            <X className="w-3 h-3 mr-1" /> Decline
                          </Button>
                        </div>
                      </div>
                    ))}
                    {swipeNotifications.map((notification) => (
                      <div key={notification.id} className={`p-4 transition-colors ${notification.is_read ? 'bg-white text-muted-foreground' : 'bg-purple-50/50 hover:bg-purple-50'}`}>
                        <div className="flex justify-between items-start mb-2">
                          <p className="text-sm">
                            {currentUser?.name === notification.creator_name ? (
                              <>You have created <span className="font-semibold text-foreground">"{notification.event_name}"</span> for <span className="font-semibold text-foreground">"{notification.group_name}"</span></>
                            ) : (
                              <><span className="font-semibold text-foreground">{notification.creator_name}</span> started <span className="font-semibold text-foreground">"{notification.event_name}"</span> in <span className="font-semibold text-foreground">"{notification.group_name}"</span></>
                            )}
                          </p>
                          {!notification.is_read && (
                            <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 ml-2 shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <Button size="sm" className={`flex-1 text-xs ${!notification.is_read ? 'bg-gradient-to-r from-purple-600 to-pink-600 border-0 text-white hover:opacity-90' : ''}`} variant={notification.is_read ? 'outline' : 'default'} onClick={() => {
                            if (!notification.is_read) {
                              markSwipeNotificationRead(notification.id);
                            }
                            navigate(`/swipe/${notification.event_id}`);
                          }}>
                            <Check className="w-3 h-3 mr-1" /> Join Swipe Session
                          </Button>
                          {!notification.is_read && (
                            <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => {
                              markSwipeNotificationRead(notification.id);
                            }}>
                              Maybe Later
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
