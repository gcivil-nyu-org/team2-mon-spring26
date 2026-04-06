import { useNavigate } from 'react-router';
import { useApp } from '@/app/contexts/app-context';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Users, Settings, Hash } from 'lucide-react';
import { JoinGroupModal } from '@/app/components/join-group-modal';
import { useState } from 'react';

export function HomePage() {
  const { groups } = useApp();
  const navigate = useNavigate();
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);

  return (
    <>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
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

          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow bg-gradient-to-br from-blue-500 to-indigo-500 text-white border-0"
            onClick={() => setIsJoinModalOpen(true)}
          >
            <CardHeader className="pb-6">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-3">
                <Hash className="w-6 h-6" />
              </div>
              <CardTitle className="mb-2">Join Group</CardTitle>
              <CardDescription className="text-blue-100">
                Enter code or discover public groups
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
                      {group.members.slice(0, 5).map((member) => (
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
      </div>
      
      <JoinGroupModal 
        isOpen={isJoinModalOpen} 
        onClose={() => setIsJoinModalOpen(false)} 
      />
    </>
  );
}