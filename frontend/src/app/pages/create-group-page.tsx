import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useApp } from '@/app/contexts/app-context';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { MapPin, Lock, Search, X } from 'lucide-react';
import { Badge } from '@/app/components/ui/badge';

export function CreateGroupPage() {
  const [groupName, setGroupName] = useState('');
  const [groupType, setGroupType] = useState('casual');
  const [defaultLocation, setDefaultLocation] = useState('manhattan');
  const [isPrivate, setIsPrivate] = useState(false);
  const [searchEmail, setSearchEmail] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  
  const { createGroup, setCurrentGroup, getAllUsers, fetchAvailableUsers, inviteMember, currentUser } = useApp();
  const navigate = useNavigate();

  // Fetch users when the component mounts or when searchEmail changes
  useEffect(() => {
    fetchAvailableUsers(searchEmail);
  }, [searchEmail, fetchAvailableUsers]);

  // Get all available users to invite (excluding current user)
  const availableUsers = getAllUsers().filter(user => user.id !== currentUser?.id);

  // Filter users based on email search and exclude already selected
  const filteredUsers = searchEmail
    ? availableUsers.filter(user =>
        !selectedMembers.includes(user.email) &&
        (user.email.toLowerCase().includes(searchEmail.toLowerCase()) ||
        user.name.toLowerCase().includes(searchEmail.toLowerCase()))
      )
    : availableUsers.filter(user => !selectedMembers.includes(user.email));

  const handleAddMember = (email: string) => {
    if (!selectedMembers.includes(email)) {
      setSelectedMembers([...selectedMembers, email]);
      setSearchEmail('');
    }
  };

  const handleRemoveMember = (email: string) => {
    setSelectedMembers(selectedMembers.filter(e => e !== email));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newGroup = await createGroup(
        groupName,
        groupType,
        defaultLocation,
        isPrivate ? 'invite-only' : 'public'
      );
      
      // Invite selected members
      for (const email of selectedMembers) {
        await inviteMember(newGroup.id, email);
      }
      
      setCurrentGroup(newGroup);
      navigate(`/group/${newGroup.id}`);
    } catch (error) {
      console.error('Failed to create group:', error);
      // Optional: add a toast/alert here if there's a UI for it
    }
  };

  return (
    <div className="flex items-center justify-center p-4">
      <div className="w-full max-w-2xl py-8">
        <Card className="border-0 shadow-xl rounded-xl">
          <CardHeader className="bg-gradient-to-r from-purple-500/90 to-pink-500/90 text-white pb-6 rounded-t-xl">
            <CardTitle className="text-xl">Group Details</CardTitle>
            <CardDescription className="text-purple-50 pt-1">
              Configure your group settings and invite members
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-8 pb-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Group Name */}
              <div className="space-y-2">
                <Label htmlFor="groupName" className="text-base">Group Name</Label>
                <Input
                  id="groupName"
                  placeholder="e.g., Weekend Brunch Crew, Tisch Squad"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  required
                  className="h-11"
                />
              </div>

              {/* Group Type */}
              <div className="space-y-2">
                <Label htmlFor="groupType" className="text-base">Group Type</Label>
                <Select value={groupType} onValueChange={setGroupType}>
                  <SelectTrigger id="groupType" className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="casual">Casual Dining - Regular hangouts</SelectItem>
                    <SelectItem value="foodie">Foodie Club - Explore new cuisines</SelectItem>
                    <SelectItem value="study">Study Group - Quick bites between classes</SelectItem>
                    <SelectItem value="special">Special Occasions - Birthdays & celebrations</SelectItem>
                    <SelectItem value="budget">Budget Eats - Affordable options only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Default Location Preference */}
              <div className="space-y-2">
                <Label htmlFor="defaultLocation" className="text-base flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-purple-600" />
                  Default Location
                </Label>
                <Select value={defaultLocation} onValueChange={setDefaultLocation}>
                  <SelectTrigger id="defaultLocation" className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manhattan">Manhattan (Near Campus)</SelectItem>
                    <SelectItem value="brooklyn">Brooklyn</SelectItem>
                    <SelectItem value="queens">Queens</SelectItem>
                    <SelectItem value="bronx">Bronx</SelectItem>
                    <SelectItem value="anywhere">Anywhere in NYC</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Privacy Setting */}
              <div className="space-y-3">
                <Label className="text-base flex items-center gap-2">
                  <Lock className="w-4 h-4 text-purple-600" />
                  Privacy
                </Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={!isPrivate ? "default" : "outline"}
                    className={!isPrivate ? "bg-purple-600 hover:bg-purple-700 flex-1" : "flex-1"}
                    onClick={() => setIsPrivate(false)}
                  >
                    Public
                  </Button>
                  <Button
                    type="button"
                    variant={isPrivate ? "default" : "outline"}
                    className={isPrivate ? "bg-purple-600 hover:bg-purple-700 flex-1" : "flex-1"}
                    onClick={() => setIsPrivate(true)}
                  >
                    Private (Invite Only)
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {isPrivate 
                    ? "Only invited members can join this group"
                    : "Other NYU students can request to join"}
                </p>
              </div>

              {/* Pre-invite Members */}
              <div className="space-y-3">
                <Label className="text-base">Invite Members (Optional)</Label>
                
                {/* Search Input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by email or name..."
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    className="pl-9 h-11"
                  />
                </div>

                {/* Selected Members */}
                {selectedMembers.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedMembers.map((email) => {
                      const user = availableUsers.find(u => u.email === email);
                      return (
                        <Badge key={email} variant="secondary" className="pl-3 pr-2 py-1.5">
                          {user?.name || email}
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(email)}
                            className="ml-2 hover:bg-muted rounded-full p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                )}

                {/* User Suggestions */}
                {searchEmail && (
                  <div className="max-h-48 overflow-y-auto border rounded-lg">
                    {filteredUsers.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        No users found
                      </p>
                    ) : (
                      <div className="divide-y">
                        {filteredUsers.slice(0, 5).map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => handleAddMember(user.email)}
                            className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
                          >
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-sm flex-shrink-0">
                              {user.name.charAt(0)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm truncate">{user.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-4 flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/home')}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  disabled={!groupName.trim()}
                >
                  Create Group
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
