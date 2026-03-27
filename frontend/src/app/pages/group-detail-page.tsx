import { useNavigate, useParams } from "react-router";
import { useApp } from "@/app/contexts/app-context";
import { Button } from "@/app/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/app/components/ui/dialog";
import { Input } from "@/app/components/ui/input";
import { Badge } from "@/app/components/ui/badge";
import { Label } from "@/app/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import preferenceOptions from '@/app/data/preference-options.json';
import {
  ArrowLeft,
  Plus,
  Users,
  History,
  MessageCircle,
  CalendarDays,
  UserPlus,
  Crown,
  Search,
  X,
  Settings2,
} from "lucide-react";
import { ChatSidebar } from "@/app/components/chat-sidebar";
import { useState, useEffect } from "react";

export function GroupDetailPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const {
    groups,
    swipeEvents,
    currentUser,
    setCurrentGroup,
    setCurrentSwipeEvent,
    createSwipeEvent,
    inviteMember,
    getAllUsers,
    leaveGroup,
    deleteGroup,
    removeMember,
    makeLeader,
    updateGroupConstraints,
  } = useApp();
  const [showChat, setShowChat] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [searchEmail, setSearchEmail] = useState("");
  const [showConstraintsDialog, setShowConstraintsDialog] = useState(false);
  
  const [dietary, setDietary] = useState<string[]>([]);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [foodTypes, setFoodTypes] = useState<string[]>([]);
  const [minimumSanitationGrade, setMinimumSanitationGrade] = useState<string>('A');
  const [savingConstraints, setSavingConstraints] = useState(false);

  const group = groups.find((g) => g.id === groupId);
  const groupEvents = swipeEvents.filter(
    (e) => e.groupId === groupId,
  );

  useEffect(() => {
    if (showConstraintsDialog && group?.constraints) {
      setDietary(group.constraints.dietary ?? []);
      setCuisines(group.constraints.cuisines ?? []);
      setFoodTypes(group.constraints.foodTypes ?? []);
      setMinimumSanitationGrade(group.constraints.minimumSanitationGrade ?? 'A');
    } else if (showConstraintsDialog) {
      setDietary([]);
      setCuisines([]);
      setFoodTypes([]);
      setMinimumSanitationGrade('A');
    }
  }, [showConstraintsDialog, group]);

  // Check if current user is a leader
  const isLeader = group?.members.find(m => m.userId === currentUser?.id)?.isLeader || false;

  // Get all available users to invite (excluding current members)
  const availableUsers = getAllUsers().filter(
    user => !group?.members.some(m => m.userId === user.id)
  );

  // Filter users based on email search
  const filteredUsers = searchEmail
    ? availableUsers.filter(user =>
        user.email.toLowerCase().includes(searchEmail.toLowerCase()) ||
        user.name.toLowerCase().includes(searchEmail.toLowerCase())
      )
    : availableUsers;

  if (!group) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Group not found</p>
      </div>
    );
  }

  const handleCreateEvent = () => {
    const eventName = `Dining Session ${new Date().toLocaleDateString()}`;
    const newEvent = createSwipeEvent(group.id, eventName);
    setCurrentGroup(group);
    setCurrentSwipeEvent(newEvent);
    navigate(`/swipe/${newEvent.id}`);
  };

  // New handler for the reservation planning page
  const handlePlanReservation = () => {
    // Navigates to a new page where users input Date, Name, and Location
    navigate(`/group/${group.id}/plan`);
  };

  const handleSaveConstraints = async () => {
    if (!group) return;
    setSavingConstraints(true);
    try {
      await updateGroupConstraints(group.id, {
        dietary, cuisines, foodTypes, minimumSanitationGrade
      });
      setShowConstraintsDialog(false);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSavingConstraints(false);
    }
  };

  const handleViewEvent = (eventId: string) => {
    const event = swipeEvents.find((e) => e.id === eventId);
    if (event) {
      setCurrentGroup(group);
      setCurrentSwipeEvent(event);

      if (
        event.status === "completed" &&
        event.matchedRestaurantId
      ) {
        navigate(`/match/${eventId}`);
      } else {
        navigate(`/swipe/${eventId}`);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/home")}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl">{group.name}</h1>
              <p className="text-sm text-muted-foreground">
                {group.members.length} member
                {group.members.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowChat(!showChat)}
          >
            <MessageCircle className="w-5 h-5" />
          </Button>
        </div>
        
        {/* Group Actions */}
        <div className="max-w-4xl mx-auto px-4 pb-4 flex justify-end gap-2">
          {isLeader ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={async () => {
                if (window.confirm("Are you sure you want to delete this group?")) {
                  try {
                    await deleteGroup(group.id);
                    navigate("/home");
                  } catch (e) {
                    alert((e as Error).message);
                  }
                }
              }}
            >
              Delete Group
            </Button>
          ) : (
            <Button
              variant="destructive"
              size="sm"
              onClick={async () => {
                if (window.confirm("Are you sure you want to leave this group?")) {
                  try {
                    await leaveGroup(group.id);
                    navigate("/home");
                  } catch (e) {
                    alert((e as Error).message);
                  }
                }
              }}
            >
              Leave Group
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Members Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Members
                </CardTitle>
                <CardDescription>
                  People in this group
                </CardDescription>
              </div>
              {isLeader && (
                <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <UserPlus className="w-4 h-4 mr-2" />
                      Invite
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Invite Member</DialogTitle>
                      <DialogDescription>
                        Search for users by email to invite to the group
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4">
                      {/* Search Input */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Search by email or name..."
                          value={searchEmail}
                          onChange={(e) => setSearchEmail(e.target.value)}
                          className="pl-9"
                        />
                      </div>

                      {/* User List */}
                      <div className="max-h-80 overflow-y-auto space-y-2">
                        {filteredUsers.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-8">
                            {searchEmail ? 'No users found' : 'All available users are already members'}
                          </p>
                        ) : (
                          filteredUsers.map((user) => (
                            <div
                              key={user.id}
                              className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-sm">
                                  {user.name.charAt(0)}
                                </div>
                                <div>
                                  <p className="font-medium text-sm">{user.name}</p>
                                  <p className="text-xs text-muted-foreground">{user.email}</p>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => {
                                  if (group) {
                                    inviteMember(group.id, user.email);
                                    setSearchEmail("");
                                    setShowInviteDialog(false);
                                  }
                                }}
                                className="bg-gradient-to-r from-purple-600 to-pink-600"
                              >
                                Invite
                              </Button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {group.members.map((member) => (
                <div
                  key={member.userId}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white">
                    {member.userName.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">
                          {member.userName}
                        </p>
                        {member.isLeader && (
                          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
                            <Crown className="w-3 h-3 mr-1" />
                            Leader
                          </Badge>
                        )}
                      </div>
                      
                      {/* Leader Controls over other members */}
                      {isLeader && member.userId !== currentUser?.id && (
                        <div className="flex items-center gap-2">
                          {!member.isLeader && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 px-2 text-xs"
                              onClick={async () => {
                                if (window.confirm(`Make ${member.userName} a leader?`)) {
                                  try {
                                    await makeLeader(group.id, member.userId);
                                  } catch (e) {
                                    alert((e as Error).message);
                                  }
                                }
                              }}
                            >
                              <Crown className="w-3 h-3 mr-1" />
                              Promote
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={async () => {
                              if (window.confirm(`Remove ${member.userName} from the group?`)) {
                                try {
                                  await removeMember(group.id, member.userId);
                                } catch (e) {
                                  alert((e as Error).message);
                                }
                              }
                            }}
                          >
                            <X className="w-3 h-3 mr-1" />
                            Remove
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Create New Swipe Event */}
          <Card
            className="cursor-pointer hover:shadow-lg transition-shadow bg-gradient-to-br from-purple-500 to-indigo-500 text-white border-0"
            onClick={handleCreateEvent}
          >
            <CardHeader className="pb-6">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-3">
                <Plus className="w-6 h-6" />
              </div>
              <CardTitle className="mb-2">
                Start Swipe Session
              </CardTitle>
              <CardDescription className="text-purple-100">
                Quickly swipe on restaurants now
              </CardDescription>
            </CardHeader>
          </Card>

          {/* NEW: Plan Reservation Button */}
          <Card
            className="cursor-pointer hover:shadow-lg transition-shadow bg-gradient-to-br from-pink-500 to-purple-600 text-white border-0"
            onClick={handlePlanReservation}
          >
            <CardHeader className="pb-6">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-3">
                <CalendarDays className="w-6 h-6" />
              </div>
              <CardTitle className="mb-2">
                Plan Reservation
              </CardTitle>
              <CardDescription className="text-pink-100">
                Set date, location & specific plans
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Group Constraints Card */}
          <Dialog open={showConstraintsDialog} onOpenChange={setShowConstraintsDialog}>
            <DialogTrigger asChild>
              <Card className="cursor-pointer hover:shadow-lg transition-shadow bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-0">
                <CardHeader className="pb-6">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-3">
                    <Settings2 className="w-6 h-6" />
                  </div>
                  <CardTitle className="mb-2">Dietary Settings</CardTitle>
                  <CardDescription className="text-emerald-100">
                    {isLeader ? "Manage group food filters" : "View group food filters"}
                  </CardDescription>
                </CardHeader>
              </Card>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
              <DialogHeader>
                <DialogTitle>Group Dietary Constraints</DialogTitle>
                <DialogDescription>
                  {isLeader ? "As a leader, you can set restrictions for the whole group matching algorithm." : "These are the constraints set by the group leaders."}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                {/* cuisines */}
                <div className="space-y-3">
                  <Label>Cuisines</Label>
                  <div className="flex flex-wrap gap-2">
                    {preferenceOptions.cuisines.map(c => (
                      <Badge 
                        key={c}
                        variant={cuisines.includes(c) ? "default" : "secondary"}
                        className={`text-sm py-1.5 px-4 transition-colors ${cuisines.includes(c) ? 'bg-zinc-950 text-zinc-50 border-transparent shadow-sm' : 'bg-zinc-100 text-zinc-900 border-zinc-200'} ${isLeader ? 'cursor-pointer hover:opacity-80' : ''}`}
                        onClick={() => {
                          if (!isLeader) return;
                          setCuisines(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
                        }}
                      >
                        {c}
                      </Badge>
                    ))}
                  </div>
                </div>
                {/* dietary */}
                <div className="space-y-3">
                  <Label>Dietary Restrictions</Label>
                  <div className="flex flex-wrap gap-2">
                    {preferenceOptions.dietary.map(d => (
                      <Badge 
                        key={d}
                        variant={dietary.includes(d) ? "default" : "secondary"}
                        className={`text-sm py-1.5 px-4 transition-colors ${dietary.includes(d) ? 'bg-zinc-950 text-zinc-50 border-transparent shadow-sm' : 'bg-zinc-100 text-zinc-900 border-zinc-200'} ${isLeader ? 'cursor-pointer hover:opacity-80' : ''}`}
                        onClick={() => {
                          if (!isLeader) return;
                          setDietary(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
                        }}
                      >
                        {d}
                      </Badge>
                    ))}
                  </div>
                </div>
                {/* foodTypes */}
                <div className="space-y-3">
                  <Label>Food Types</Label>
                  <div className="flex flex-wrap gap-2">
                    {preferenceOptions.foodTypes.map(ft => (
                      <Badge 
                        key={ft}
                        variant={foodTypes.includes(ft) ? "default" : "secondary"}
                        className={`text-sm py-1.5 px-4 transition-colors ${foodTypes.includes(ft) ? 'bg-zinc-950 text-zinc-50 border-transparent shadow-sm' : 'bg-zinc-100 text-zinc-900 border-zinc-200'} ${isLeader ? 'cursor-pointer hover:opacity-80' : ''}`}
                        onClick={() => {
                          if (!isLeader) return;
                          setFoodTypes(prev => prev.includes(ft) ? prev.filter(x => x !== ft) : [...prev, ft])
                        }}
                      >
                        {ft}
                      </Badge>
                    ))}
                  </div>
                </div>
                {/* sanitation */}
                <div className="space-y-3">
                  <Label>Minimum Sanitation Grade</Label>
                  <Select disabled={!isLeader} value={minimumSanitationGrade} onValueChange={setMinimumSanitationGrade}>
                    <SelectTrigger className="max-w-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {preferenceOptions.minimumSanitationGrades.map(sg => (
                        <SelectItem key={sg} value={sg}>{sg}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {isLeader && (
                <div className="flex justify-end pt-4 mt-auto">
                  <Button disabled={savingConstraints} onClick={handleSaveConstraints}>
                    {savingConstraints ? 'Saving...' : 'Save Constraints'}
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        {/* Events History */}
        <div>
          <h2 className="text-xl mb-4 flex items-center gap-2">
            <History className="w-5 h-5" />
            Sessions
          </h2>
          {groupEvents.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  No sessions yet. Start one above!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {groupEvents.map((event) => (
                <Card
                  key={event.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => handleViewEvent(event.id)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">
                          {event.name}
                        </CardTitle>
                        <CardDescription>
                          {new Date(
                            event.createdAt,
                          ).toLocaleDateString()}{" "}
                          at{" "}
                          {new Date(
                            event.createdAt,
                          ).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {event.status === "completed" ? (
                          <span className="px-3 py-1 rounded-full text-xs bg-green-100 text-green-700">
                            Matched
                          </span>
                        ) : event.status === "active" ? (
                          <span className="px-3 py-1 rounded-full text-xs bg-blue-100 text-blue-700">
                            Active
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
                            Pending
                          </span>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Chat Sidebar */}
      {showChat && group && (
        <ChatSidebar
          groupId={group.id}
          onClose={() => setShowChat(false)}
        />
      )}
    </div>
  );
}