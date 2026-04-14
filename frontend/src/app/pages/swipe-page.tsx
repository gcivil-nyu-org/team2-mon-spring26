import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { useApp } from "@/app/contexts/app-context";
import type { Restaurant } from "@/app/data/mock-restaurants";
import { RestaurantCard } from "@/app/components/restaurant-card";
import { ChatSidebar } from "@/app/components/chat-sidebar";
import { Button } from "@/app/components/ui/button";
import { Progress } from "@/app/components/ui/progress";
import { MessageCircle, Users } from "lucide-react";
import { toast } from "sonner";

export function SwipePage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const {
    currentUser,
    currentGroup,
    currentSwipeEvent,
    addSwipe,
    addChatMessage,
    fetchSwipeVenues,
    groups,
    swipeEvents,
  } = useApp();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [showChat, setShowChat] = useState(false);
  const [venues, setVenues] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);

  // Find event and group if not in context
  const event =
    currentSwipeEvent ||
    swipeEvents.find((e) => e.id === eventId);
  const group =
    currentGroup ||
    (event ? groups.find((g) => g.id === event.groupId) : null);

  // Redirect if completed
  useEffect(() => {
    if (event?.status === "completed") {
      navigate(`/match/${event.id}`);
    }
  }, [event?.id, event?.status, navigate]);

  // Fetch venues from backend
  useEffect(() => {
    if (!event?.id || !group?.id) return;

    let cancelled = false;
    const loadVenues = async () => {
      try {
        const backendVenues = await fetchSwipeVenues(group.id, event.id);
        if (!cancelled) {
          setVenues(backendVenues);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setVenues([]);
          setLoading(false);
        }
      }
    };
    loadVenues();

    return () => {
      cancelled = true;
    };
  }, [event?.id, group?.id, fetchSwipeVenues]);
  if (!event || !group || !currentUser) {
    return (
      <>

        <div className="flex items-center justify-center p-8">
          <div className="text-center space-y-4 bg-white p-8 rounded-lg shadow-lg max-w-md">
            <p className="text-lg">Event or group not found</p>
            <Button
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              onClick={() => navigate("/home")}
            >
              Back to Home
            </Button>
          </div>
        </div>
      </>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 mt-20">
        <div className="text-center">
          <div className="rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading venues...</p>
        </div>
      </div>
    );
  }

  if (venues.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center space-y-4 bg-white p-8 rounded-lg shadow-lg max-w-md">
          <p className="text-lg font-medium">No restaurants found</p>
          <p className="text-gray-500">
            We couldn't find any restaurants matching your group's dietary constraints and preferences. Try adjusting the group settings.
          </p>
          <Button
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 mt-4"
            onClick={() => navigate(`/group/${group.id}`)}
          >
            Back to Group
          </Button>
        </div>
      </div>
    );
  }

  const handleSwipe = async (direction: "left" | "right") => {
    const restaurant = venues[currentIndex];

    try {
      await addSwipe(event.id, group.id, restaurant.id, direction);
    } catch (error: unknown) {
      console.error("Failed to submit swipe:", error);
      if (error instanceof Error && error.message === "This event is no longer active") {
        toast.info("A match has already been found for this session!");
        navigate(`/match/${event.id}`);
        return;
      }
    }

    // Move to next card
    if (currentIndex < venues.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // Finished swiping
      addChatMessage(group.id, {
        id: `msg-${Date.now()}`,
        type: "system",
        message: `${currentUser.name} finished swiping`,
        timestamp: new Date().toISOString(),
      });

      // Navigate to match results
      navigate(`/match/${event.id}`);
    }
  };

  const progress =
    ((currentIndex + 1) / venues.length) * 100;
  const currentRestaurant = venues[currentIndex];

  return (
    <>
      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2 ml-auto">
              <Button variant="outline" size="icon" title="Group Size">
                <Users className="w-5 h-5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowChat(!showChat)}
                title="Group Chat"
              >
                <MessageCircle className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>
                {currentIndex + 1} of {venues.length}
              </span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </div>

        <RestaurantCard
          restaurant={currentRestaurant}
          onSwipe={handleSwipe}
        />

        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>Click left side to pass, right side to like</p>
          <p className="mt-1">Or use the buttons on the card</p>
        </div>
      </main>

      {/* Chat Sidebar */}
      {showChat && group && (
        <ChatSidebar
          groupId={group.id}
          onClose={() => setShowChat(false)}
        />
      )}
    </>
  );
}
