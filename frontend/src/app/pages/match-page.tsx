import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useApp } from '@/app/contexts/app-context';
import type { Restaurant } from '@/app/data/mock-restaurants';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent } from '@/app/components/ui/card';
import { Users, PartyPopper } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Confetti from 'react-confetti';
import { RestaurantCard } from "@/app/components/restaurant-card";

export function MatchPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { currentGroup, groups, swipeEvents, fetchMatchResults } = useApp();

  const [matchedRestaurant, setMatchedRestaurant] = useState<Restaurant | null>(null);
  const [showMatch, setShowMatch] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [matchStats, setMatchStats] = useState<{ totalLikes: number }>({ totalLikes: 0 });

  // Find event and group
  const event = swipeEvents.find(e => e.id === eventId);
  const group = currentGroup || (event ? groups.find(g => g.id === event.groupId) : null);

  useEffect(() => {
    if (!event || !group) return;

    let cancelled = false;
    let confettiTimer: ReturnType<typeof setTimeout>;
    const loadResults = async () => {
      try {
        const results = await fetchMatchResults(group.id, event.id);
        if (cancelled) return;

        if (results.match_found && results.matched_venue) {
          setMatchedRestaurant(results.matched_venue);
          setMatchStats({ totalLikes: results.likes_count });
          setShowMatch(true);
          setShowConfetti(true);
          confettiTimer = setTimeout(() => setShowConfetti(false), 5000);
        } else {
          setMatchedRestaurant(null);
          setShowMatch(true);
        }
      } catch {
        if (!cancelled) {
          setMatchedRestaurant(null);
          setShowMatch(true);
        }
      }
    };
    loadResults();
    return () => { cancelled = true; clearTimeout(confettiTimer); };
  }, [event?.id, group?.id, fetchMatchResults]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!event || !group) {
    return (
      <>

        <div className="flex items-center justify-center p-8">
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-lg mb-4">Event or group not found</p>
              <Button onClick={() => navigate('/home')}>
                Back to Home
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }



  return (
    <>
      {/* Confetti */}
      {showConfetti && matchedRestaurant && (
        <Confetti
          width={window.innerWidth}
          height={window.innerHeight}
          recycle={false}
          numberOfPieces={400}
          colors={['#9333ea', '#ec4899', '#f97316', '#8b5cf6']}
        />
      )}



      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 py-6">
        <AnimatePresence>
          {showMatch && matchedRestaurant ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-4"
            >
              {/* Success Header */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", duration: 0.8, delay: 0.2 }}
                className="text-center"
              >
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full mb-4 shadow-xl">
                  <PartyPopper className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-4xl mb-2">It's a Match!</h1>
                <p className="text-lg text-muted-foreground">
                  {matchStats.totalLikes} {matchStats.totalLikes === 1 ? 'person' : 'people'} loved this restaurant
                </p>
              </motion.div>

              {/* Restaurant Card */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
              >
                <div className="mb-6">
                  <RestaurantCard restaurant={matchedRestaurant} isReadonly={true} />
                </div>
                <div className="mb-3">
                  <Button
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                    onClick={() => navigate(`/venues/${matchedRestaurant.id}/review?eventId=${event.id}`)}
                  >
                    Leave a Review
                  </Button>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate(`/group/${group.id}`)}
                >
                  Back to Group
                </Button>
              </motion.div>
            </motion.div>
          ) : showMatch && !matchedRestaurant ? (
            // No Match State
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <Card>
                <CardContent className="py-12 text-center space-y-4">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-2">
                    <Users className="w-10 h-10 text-gray-400" />
                  </div>
                  <div>
                    <h2 className="text-2xl mb-2">No Perfect Match Yet</h2>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      Your group didn't all swipe right on the same restaurant. Try swiping on more options or discuss with your group!
                    </p>
                  </div>
                  
                  <Button
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                    onClick={() => navigate(`/group/${group.id}`)}
                  >
                    Back to Group
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            // Loading State
            <Card>
              <CardContent className="py-12 text-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent mx-auto mb-4"
                />
                <p className="text-muted-foreground">Finding your perfect match...</p>
              </CardContent>
            </Card>
          )}
        </AnimatePresence>
      </main>
    </>
  );
}
