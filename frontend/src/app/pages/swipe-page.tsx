import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { useApp } from "@/app/contexts/app-context";
import { mockRestaurants } from "@/app/data/mock-restaurants";
import { RestaurantCard } from "@/app/components/restaurant-card";
import { ChatSidebar } from "@/app/components/chat-sidebar";
import { Button } from "@/app/components/ui/button";
import { Progress } from "@/app/components/ui/progress";
import { ArrowLeft, MessageCircle, Users, ChevronLeft, ChevronRight } from "lucide-react";

export function SwipePage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const {
    currentUser,
    currentGroup,
    currentSwipeEvent,
    swipes,
    addSwipe,
    addChatMessage,
    groups,
    swipeEvents,
  } = useApp();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [showChat, setShowChat] = useState(false);
  const [userSwipes, setUserSwipes] = useState<
    Record<string, "left" | "right">
  >({});

  // Find event and group if not in context
  const event =
    currentSwipeEvent ||
    swipeEvents.find((e) => e.id === eventId);
  const group =
    currentGroup ||
    (event ? groups.find((g) => g.id === event.groupId) : null);

  useEffect(() => {
    if (event && group && currentUser) {
      // Load initial restaurants if needed
      if (restaurants.length === 0) {
        // In a real app, fetch restaurants based on event preferences
      }
    }
  }, [event, group, currentUser]);

  if (!event || !group || !currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
        <header className="bg-white border-b">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/home")}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </div>
        </header>
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
      </div>
    );
  }

  const handleSwipe = (direction: "left" | "right") => {
    const restaurant = mockRestaurants[currentIndex];

    // Record swipe
    setUserSwipes((prev) => ({
      ...prev,
      [restaurant.id]: direction,
    }));

    addSwipe(event.id, {
      userId: currentUser.id,
      restaurantId: restaurant.id,
      direction,
    });

    // Move to next card
    if (currentIndex < mockRestaurants.length - 1) {
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
    ((currentIndex + 1) / mockRestaurants.length) * 100;
  const currentRestaurant = mockRestaurants[currentIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(`/group/${group.id}`)}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-xl">{event.name}</h1>
                <p className="text-sm text-muted-foreground">
                  {group.name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon">
                <Users className="w-5 h-5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowChat(!showChat)}
              >
                <MessageCircle className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>
                {currentIndex + 1} of {mockRestaurants.length}
              </span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 py-8">
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
    </div>
  );
}