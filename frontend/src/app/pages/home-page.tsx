import { useNavigate } from 'react-router';
import { useApp } from '@/app/contexts/app-context';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { UtensilsCrossed, Users, UserPlus, LogOut, Settings, Bell } from 'lucide-react';
import { Badge } from '@/app/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import { useState } from 'react';

export function HomePage() {
  const { currentUser, groups, logout, notifications, markNotificationAsRead, joinGroup } = useApp();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleNotificationClick = (notification: any) => {
    markNotificationAsRead(notification.id);
    if (notification.type === 'group_invite' && notification.groupId) {
      joinGroup(notification.groupId);
      navigate(`/group/${notification.groupId}`);
    }
    setShowNotifications(false);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'group_invite':
        return <Users className="w-5 h-5 text-purple-600" />;
      case 'match_found':
        return <UtensilsCrossed className="w-5 h-5 text-green-600" />;
      case 'swipe_reminder':
        return <Bell className="w-5 h-5 text-orange-600" />;
      default:
        return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center">
              <UtensilsCrossed className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl">Meal Swipe</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right mr-2">
              <p className="text-sm">{currentUser?.name}</p>
              <p className="text-xs text-muted-foreground">{currentUser?.email}</p>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <Badge className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 bg-red-500 text-xs px-1.5 py-0.5 min-w-[18px] h-[18px] flex items-center justify-center">
                      {unreadCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="flex items-center justify-between py-2 px-3 border-b">
                  <p className="text-sm font-semibold">Notifications</p>
                  {unreadCount > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {unreadCount} new
                    </Badge>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    No notifications yet
                  </div>
                ) : (
                  <ScrollArea className="max-h-96">
                    <div className="p-3 space-y-3">
                      {notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors hover:bg-muted ${
                            !notification.read ? 'bg-purple-50' : ''
                          }`}
                          onClick={() => handleNotificationClick(notification)}
                        >
                          {getNotificationIcon(notification.type)}
                          <div className="flex-1">
                            <p className="text-sm font-medium">{notification.title}</p>
                            <p className="text-xs text-muted-foreground">{notification.message}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(notification.timestamp).toLocaleString()}
                            </p>
                          </div>
                          {!notification.read && (
                            <div className="w-2 h-2 bg-purple-600 rounded-full mt-1" />
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow bg-gradient-to-br from-purple-500 to-pink-500 text-white border-0"
            onClick={() => navigate('/create-group')}
          >
            <CardHeader className="pb-6">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-3">
                <Users className="w-6 h-6" />
              </div>
              <CardTitle className="mb-2">Create Group</CardTitle>
              <CardDescription className="text-purple-100">
                Start a new dining group with friends
              </CardDescription>
            </CardHeader>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow bg-gradient-to-br from-orange-500 to-pink-500 text-white border-0"
            onClick={() => navigate('/preferences')}
          >
            <CardHeader className="pb-6">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-3">
                <Settings className="w-6 h-6" />
              </div>
              <CardTitle className="mb-2">Set Preferences</CardTitle>
              <CardDescription className="text-orange-100">
                Update your dietary needs and cuisines
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* My Groups */}
        <div className="mb-8">
          <h2 className="text-2xl mb-4">My Groups</h2>
          {groups.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">You haven't joined any groups yet</p>
                <Button onClick={() => navigate('/create-group')}>
                  Create Your First Group
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {groups.map((group) => (
                <Card 
                  key={group.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => navigate(`/group/${group.id}`)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{group.name}</CardTitle>
                        <CardDescription>
                          {group.members.length} member{group.members.length !== 1 ? 's' : ''}
                        </CardDescription>
                      </div>
                      <Button variant="ghost" size="sm">
                        View →
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex -space-x-2">
                      {group.members.slice(0, 5).map((member, idx) => (
                        <div
                          key={member.userId}
                          className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 border-2 border-white flex items-center justify-center text-white text-xs"
                          title={member.userName}
                        >
                          {member.userName.charAt(0)}
                        </div>
                      ))}
                      {group.members.length > 5 && (
                        <div className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs">
                          +{group.members.length - 5}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}