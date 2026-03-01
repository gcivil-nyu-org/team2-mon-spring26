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
} from "lucide-react";
import { ChatSidebar } from "@/app/components/chat-sidebar";
import { useState } from "react";

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
  } = useApp();
  const [showChat, setShowChat] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [searchEmail, setSearchEmail] = useState("");

  const group = groups.find((g) => g.id === groupId);
  const groupEvents = swipeEvents.filter(
    (e) => e.groupId === groupId,
  );

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
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons Grid */}
        <div className="grid md:grid-cols-2 gap-4">
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