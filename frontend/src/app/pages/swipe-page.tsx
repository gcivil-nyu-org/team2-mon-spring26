import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { useApp } from "@/app/contexts/app-context";
import type { Restaurant } from "@/app/data/mock-restaurants";
import { RestaurantCard } from "@/app/components/restaurant-card";
import { ChatSidebar } from "@/app/components/chat-sidebar";
import { Button } from "@/app/components/ui/button";
import { Progress } from "@/app/components/ui/progress";
import { MessageCircle, Users, RotateCcw, Info, Star } from "lucide-react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table";
import { RestaurantInfoDialog } from "@/app/components/restaurant-info-dialog";

export function SwipePage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const {
    currentUser,
    currentGroup,
    currentSwipeEvent,
    addSwipe,
    finishSwiping,
    fetchSwipeVenues,
    fetchMySwipes,
    reswipeSession,
    groups,
    swipeEvents,
  } = useApp();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [showChat, setShowChat] = useState(false);
  const [venues, setVenues] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  
  // New States for Summary View
  const [hasCompleted, setHasCompleted] = useState(false);
  const [mySwipes, setMySwipes] = useState<{venue: Restaurant, direction: 'left'|'right'}[]>([]);
  const [selectedInfoVenue, setSelectedInfoVenue] = useState<Restaurant | null>(null);

  // Find event and group if not in context
  const event =
    currentSwipeEvent ||
    swipeEvents.find((e) => e.id === eventId);
  const group =
    currentGroup ||
    (event ? groups.find((g) => g.id === event.groupId) : null);

  // Redirect if completed server-side and has Match
  useEffect(() => {
    if (event?.status === "completed") {
      navigate(`/match/${event.id}`);
    }
  }, [event?.id, event?.status, navigate]);

  // Fetch venues and past swipes from backend
  useEffect(() => {
    if (!event?.id || !group?.id) return;

    let cancelled = false;
    const loadData = async () => {
      try {
        const [backendVenues, swipesData] = await Promise.all([
          fetchSwipeVenues(group.id, event.id),
          fetchMySwipes(group.id, event.id)
        ]);
        if (!cancelled) {
          setVenues(backendVenues);
          setHasCompleted(swipesData.hasCompleted);
          setMySwipes(swipesData.swipes);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setVenues([]);
          setLoading(false);
        }
      }
    };
    loadData();

    return () => {
      cancelled = true;
    };
  }, [event?.id, group?.id, fetchSwipeVenues, fetchMySwipes]);

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

  const handleReswipe = async () => {
    try {
      await reswipeSession(group.id, event.id);
      setHasCompleted(false);
      setMySwipes([]);
      setCurrentIndex(0);
      toast.success("Ready to swipe again!");
    } catch {
      toast.error("Failed to reset swipe session.");
    }
  };

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

    if (currentIndex < venues.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      await finishSwiping(group.id, event.id).catch(console.error);
      setHasCompleted(true);
      const swipesData = await fetchMySwipes(group.id, event.id);
      setMySwipes(swipesData.swipes);
    }
  };

  const progress =
    ((currentIndex + 1) / venues.length) * 100;
  const currentRestaurant = venues[currentIndex];

  if (hasCompleted) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Swipe Summary</h1>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowChat(!showChat)}
            title="Group Chat"
          >
            <MessageCircle className="w-5 h-5" />
          </Button>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-lg border">
          <h2 className="text-lg font-semibold mb-4 text-center">You have finished swiping for this session!</h2>
          <p className="text-muted-foreground text-center mb-6">Waiting for other members before calculating the match...</p>

          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Restaurant</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Your Vote</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mySwipes.map((swipe, idx) => (
                  <TableRow key={idx} className={swipe.direction === 'right' ? "bg-green-50/50" : "bg-red-50/50"}>
                    <TableCell className="font-medium">{swipe.venue.name}</TableCell>
                    <TableCell className="flex items-center gap-1">
                      {swipe.venue.rating.toFixed(1)} 
                      <Star className={`w-4 h-4 ${swipe.venue.rating > 4.6 ? 'fill-black text-black' : 'fill-gray-400 text-gray-400'}`} />
                    </TableCell>
                    <TableCell>{swipe.venue.cost}</TableCell>
                    <TableCell>
                      {swipe.direction === 'right' ? (
                        <span className="text-green-600 font-bold">Liked</span>
                      ) : (
                        <span className="text-red-500 font-bold">Passed</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedInfoVenue(swipe.venue)}>
                        <Info className="w-4 h-4 mr-2" />
                        Info
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-8 flex justify-center gap-4 pb-4">
            <Button onClick={handleReswipe} variant="outline" className="text-muted-foreground font-medium flex items-center hover:bg-gray-100 border-gray-300">
              <RotateCcw className="w-4 h-4 mr-2" />
              Reswipe Session
            </Button>
            <Button onClick={() => navigate(`/group/${group.id}`)} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold flex items-center">
              <Users className="w-4 h-4 mr-2" />
              Back to Group
            </Button>
          </div>
        </div>

        <RestaurantInfoDialog 
          restaurant={selectedInfoVenue}
          open={selectedInfoVenue !== null}
          onOpenChange={(open) => !open && setSelectedInfoVenue(null)}
        />

        {showChat && group && (
          <ChatSidebar
            groupId={group.id}
            onClose={() => setShowChat(false)}
          />
        )}
      </main>
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

  return (
    <>
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

        {currentRestaurant && (
          <RestaurantCard
            restaurant={currentRestaurant}
            onSwipe={handleSwipe}
          />
        )}

        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>Click left side to pass, right side to like</p>
          <p className="mt-1">Or use the buttons on the card</p>
        </div>
      </main>

      {showChat && group && (
        <ChatSidebar
          groupId={group.id}
          onClose={() => setShowChat(false)}
        />
      )}
    </>
  );
}
