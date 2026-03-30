import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useApp } from '@/app/contexts/app-context';
import type { Restaurant } from '@/app/data/mock-restaurants';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { MapPin, AlertTriangle, ExternalLink, PartyPopper, Users, ArrowLeft, Star, Ticket, Navigation } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Confetti from 'react-confetti';
import { Separator } from '@/app/components/ui/separator';

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
  }, [event?.id, group?.id, fetchMatchResults]);

  if (!event || !group) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
        <header className="bg-white border-b">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/home')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </div>
        </header>
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
      </div>
    );
  }

  const gradeColors = {
    A: 'bg-green-500',
    B: 'bg-yellow-500',
    C: 'bg-orange-500',
    N: 'bg-gray-400',
    P: 'bg-gray-500',
    Z: 'bg-red-500'
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
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

      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/group/${group.id}`)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl">{event.name}</h1>
              <p className="text-sm text-muted-foreground">{group.name}</p>
            </div>
          </div>
        </div>
      </header>

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
                <Card className="overflow-hidden shadow-xl">
                  {/* Hero Image */}
                  <div className="relative h-64">
                    <img 
                      src={matchedRestaurant.images[0]} 
                      alt={matchedRestaurant.name}
                      className="w-full h-full object-cover"
                    />
                    
                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    
                    {/* Sanitation Grade */}
                    <div className="absolute top-4 right-4">
                      <div className={`${gradeColors[matchedRestaurant.sanitationGrade]} text-white w-16 h-16 rounded-xl flex items-center justify-center shadow-lg`}>
                        <div className="text-center">
                          <div className="text-xs">Grade</div>
                          <div className="text-3xl font-bold">{matchedRestaurant.sanitationGrade}</div>
                        </div>
                      </div>
                    </div>

                    {/* Rating & Distance */}
                    <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                      <div className="bg-black/70 backdrop-blur-sm text-white px-3 py-2 rounded-lg flex items-center gap-2">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-semibold">{matchedRestaurant.rating.toFixed(1)}</span>
                        <span className="text-sm text-white/80">({matchedRestaurant.reviewCount})</span>
                      </div>
                      <div className="bg-black/70 backdrop-blur-sm text-white px-3 py-2 rounded-lg flex items-center gap-2">
                        <Navigation className="w-4 h-4" />
                        <span className="text-sm font-medium">{matchedRestaurant.distance}</span>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <CardContent className="p-6 space-y-4">
                    {/* Restaurant Name & Price */}
                    <div>
                      <div className="flex items-start justify-between mb-2">
                        <h2 className="text-3xl">{matchedRestaurant.name}</h2>
                        <span className="text-2xl font-semibold text-muted-foreground">{matchedRestaurant.cost}</span>
                      </div>
                      
                      {/* Location */}
                      <div className="flex items-start gap-2 text-muted-foreground">
                        <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <p className="text-sm">{matchedRestaurant.address}</p>
                      </div>
                    </div>

                    <Separator />

                    {/* Cuisine Tags */}
                    <div className="flex flex-wrap gap-2">
                      {matchedRestaurant.cuisine.map((cuisine) => (
                        <Badge key={cuisine} variant="secondary">
                          {cuisine}
                        </Badge>
                      ))}
                    </div>

                    {/* Student Perks - Highlighted */}
                    {(matchedRestaurant.hasGroupSeating || matchedRestaurant.hasStudentDiscount) && (
                      <div className="bg-gradient-to-r from-blue-50 to-amber-50 border-2 border-blue-200/50 rounded-lg p-4">
                        <h3 className="text-xs font-semibold text-blue-900 mb-2 uppercase tracking-wide flex items-center gap-1.5">
                          <Star className="w-3.5 h-3.5 fill-blue-600 text-blue-600" />
                          Student Perks
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {matchedRestaurant.hasGroupSeating && (
                            <Badge className="bg-blue-600 text-white hover:bg-blue-700 border-0">
                              <Users className="w-3.5 h-3.5 mr-1" />
                              Group Seating
                            </Badge>
                          )}
                          {matchedRestaurant.hasStudentDiscount && (
                            <Badge className="bg-amber-600 text-white hover:bg-amber-700 border-0">
                              <Ticket className="w-3.5 h-3.5 mr-1" />
                              {matchedRestaurant.studentDiscountAmount}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Dietary Options */}
                    {matchedRestaurant.badges.filter(badge => 
                      badge.includes('Vegan') || badge.includes('Halal') || badge.includes('Kosher') || badge.includes('Vegetarian')
                    ).length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {matchedRestaurant.badges.filter(badge => 
                          badge.includes('Vegan') || badge.includes('Halal') || badge.includes('Kosher') || badge.includes('Vegetarian')
                        ).map((badge) => (
                          <Badge 
                            key={badge}
                            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0"
                          >
                            {badge}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Health Inspection Warning (if violations exist) */}
                    {matchedRestaurant.healthInspection && matchedRestaurant.healthInspection.violations.length > 0 && (
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                        <p className="text-xs font-semibold flex items-center gap-2 mb-1 text-orange-900">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Health Inspection Notes
                        </p>
                        <p className="text-xs text-orange-800">
                          {matchedRestaurant.healthInspection.violations.length} violation{matchedRestaurant.healthInspection.violations.length !== 1 ? 's' : ''} found during last inspection.
                        </p>
                      </div>
                    )}

                    <Separator />

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        variant="outline"
                        onClick={() => {
                          const address = encodeURIComponent(matchedRestaurant.address);
                          window.open(`https://maps.google.com/?q=${address}`, '_blank');
                        }}
                      >
                        <MapPin className="w-4 h-4 mr-2" />
                        Directions
                      </Button>
                      
                      {matchedRestaurant.menuLink && (
                        <Button
                          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                          onClick={() => window.open(matchedRestaurant.menuLink, '_blank')}
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Menu
                        </Button>
                      )}
                    </div>

                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => navigate(`/group/${group.id}`)}
                    >
                      Back to Group
                    </Button>
                  </CardContent>
                </Card>
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
    </div>
  );
}