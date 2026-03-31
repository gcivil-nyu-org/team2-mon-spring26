import { useState } from 'react';
import type { Restaurant } from '@/app/data/mock-restaurants';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent } from '@/app/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/app/components/ui/dialog';
import { X, Heart, Info, MapPin, Calendar, AlertTriangle, ExternalLink, Star, Users, Ticket, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '@/app/contexts/app-context';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';

interface RestaurantCardProps {
  restaurant: Restaurant;
  onSwipe: (direction: 'left' | 'right') => void;
}

export function RestaurantCard({ restaurant, onSwipe }: RestaurantCardProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const { currentUser } = useApp();

  // Check for dietary violations
  const checkDietaryViolations = () => {
    if (!currentUser?.preferences.dietary.length) return [];
    
    const violations: string[] = [];
    const userDietary = currentUser.preferences.dietary;
    
    userDietary.forEach(restriction => {
      // Check if restaurant supports this dietary restriction
      const restrictionLower = restriction.toLowerCase();
      const hasMatch = restaurant.badges.some(badge => 
        badge.toLowerCase().includes(restrictionLower) || 
        badge.toLowerCase().includes(restriction.split(' ')[0].toLowerCase())
      );
      
      // Special handling for different dietary restrictions
      if (restriction === 'Vegetarian' && !hasMatch) {
        // Check if restaurant has vegetarian options
        const hasVegetarianOption = restaurant.badges.some(badge => 
          badge.toLowerCase().includes('vegetarian') || 
          badge.toLowerCase().includes('vegan')
        );
        if (!hasVegetarianOption) {
          violations.push('Limited vegetarian options');
        }
      } else if (restriction === 'Vegan' && !hasMatch) {
        violations.push('No vegan options available');
      } else if (restriction === 'Halal' && !hasMatch) {
        const hasHalal = restaurant.badges.some(badge => badge.toLowerCase().includes('halal'));
        if (!hasHalal) {
          violations.push('Not halal certified');
        }
      } else if (restriction === 'Kosher' && !hasMatch) {
        violations.push('Not kosher certified');
      } else if (restriction === 'Gluten-Free' && !hasMatch) {
        violations.push('Limited gluten-free options');
      } else if (restriction === 'Dairy-Free' && !hasMatch) {
        violations.push('May contain dairy');
      } else if (restriction === 'Nut-Free' && !hasMatch) {
        violations.push('May contain nuts');
      }
    });
    
    return violations;
  };

  const dietaryViolations = checkDietaryViolations();
  const hasViolations = dietaryViolations.length > 0;

  const handleSwipe = (direction: 'left' | 'right') => {
    setSwipeDirection(direction);
    setTimeout(() => {
      onSwipe(direction);
      setSwipeDirection(null);
      setCurrentImageIndex(0);
    }, 300);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    const card = e.currentTarget as HTMLElement;
    const rect = card.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const cardWidth = rect.width;
    
    // Left third = swipe left, right third = swipe right, middle = cycle images
    if (clickX < cardWidth * 0.3) {
      handleSwipe('left');
    } else if (clickX > cardWidth * 0.7) {
      handleSwipe('right');
    } else {
      // Cycle through images
      setCurrentImageIndex((prev) => restaurant.images.length > 0 ? (prev + 1) % restaurant.images.length : 0);
    }
  };

  const gradeColors = {
    A: 'bg-green-500',
    B: 'bg-yellow-500',
    C: 'bg-orange-500',
    N: 'bg-gray-400',
    P: 'bg-gray-500',
    Z: 'bg-red-500'
  };

  return (
    <>
      <div className="relative">
        {/* Left Arrow Button - Always Visible */}
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            handleSwipe('left');
          }}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-14 h-14 bg-white/90 hover:bg-white shadow-lg backdrop-blur-sm border-2 border-red-200 hover:border-red-300 text-red-600 hover:text-red-700 rounded-full -translate-x-[calc(100%+12px)]"
        >
          <ChevronLeft className="w-8 h-8" />
        </Button>

        {/* Right Arrow Button - Always Visible */}
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            handleSwipe('right');
          }}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-14 h-14 bg-white/90 hover:bg-white shadow-lg backdrop-blur-sm border-2 border-green-200 hover:border-green-300 text-green-600 hover:text-green-700 rounded-full translate-x-[calc(100%+12px)]"
        >
          <ChevronRight className="w-8 h-8" />
        </Button>

        <AnimatePresence mode="wait">
          <motion.div
            key={restaurant.id}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ 
              scale: 1, 
              opacity: 1,
              x: swipeDirection === 'left' ? -300 : swipeDirection === 'right' ? 300 : 0,
              rotate: swipeDirection === 'left' ? -20 : swipeDirection === 'right' ? 20 : 0
            }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card 
              className={`overflow-hidden cursor-pointer relative shadow-2xl ${
                hasViolations ? 'ring-2 ring-orange-400' : ''
              }`}
              onClick={handleCardClick}
              style={hasViolations ? {
                backgroundColor: 'rgba(251, 146, 60, 0.05)'
              } : undefined}
            >
              {/* Swipe Overlays */}
              {swipeDirection === 'left' && (
                <div className="absolute inset-0 bg-red-500/20 z-10 flex items-center justify-center">
                  <div className="bg-red-500 text-white px-8 py-4 rounded-2xl rotate-[-20deg]">
                    <X className="w-16 h-16" />
                  </div>
                </div>
              )}
              {swipeDirection === 'right' && (
                <div className="absolute inset-0 bg-green-500/20 z-10 flex items-center justify-center">
                  <div className="bg-green-500 text-white px-8 py-4 rounded-2xl rotate-[20deg]">
                    <Heart className="w-16 h-16" />
                  </div>
                </div>
              )}

              {/* Image Section */}
              <div className="relative h-96">
                {restaurant.images && restaurant.images.length > 0 ? (
                  <ImageWithFallback
                    src={restaurant.images[currentImageIndex]}
                    alt={restaurant.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                    <div className="text-gray-400 text-center">
                      <MapPin className="w-12 h-12 mx-auto mb-2" />
                      <span className="text-sm">No photo available</span>
                    </div>
                  </div>
                )}
                
                {/* Image Indicators */}
                <div className="absolute top-4 left-0 right-0 flex justify-center gap-1 px-4">
                  {restaurant.images.map((_, idx) => (
                    <div 
                      key={idx}
                      className={`h-1 flex-1 rounded-full ${
                        idx === currentImageIndex ? 'bg-white' : 'bg-white/50'
                      }`}
                    />
                  ))}
                </div>

                {/* Sanitation Grade Badge */}
                <div className="absolute top-4 right-4">
                  <div className={`${gradeColors[restaurant.sanitationGrade]} text-white w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg`}>
                    <div className="text-center">
                      <div className="text-xs">Grade</div>
                      <div className="text-3xl">{restaurant.sanitationGrade}</div>
                    </div>
                  </div>
                </div>

                {/* Rating and Distance Badges */}
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                  <div className="bg-black/70 backdrop-blur-sm text-white px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-lg">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-semibold">{restaurant.rating.toFixed(1)}</span>
                  </div>
                  <div className="bg-black/70 backdrop-blur-sm text-white px-3 py-2 rounded-xl font-semibold shadow-lg">
                    {restaurant.distance}
                  </div>
                </div>

                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              </div>

              {/* Content Section */}
              <CardContent className="p-6 space-y-4">
                {/* Dietary Violation Warning */}
                {hasViolations && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-orange-900 mb-1">
                        Dietary Preferences Alert
                      </p>
                      <ul className="text-xs text-orange-800 space-y-0.5">
                        {dietaryViolations.map((violation, idx) => (
                          <li key={idx}>• {violation}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Name, Cost and Address */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-3xl">{restaurant.name}</h2>
                    <span className="text-2xl font-semibold text-muted-foreground">{restaurant.cost}</span>
                  </div>
                  <div className="flex items-start gap-2 text-sm text-muted-foreground mb-2">
                    <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{restaurant.address.split(',')[0]}, {restaurant.address.split(',')[1]}</span>
                  </div>
                </div>

                {/* Cuisine Tags */}
                <div className="flex flex-wrap gap-2">
                  {restaurant.cuisine.map((cuisine) => (
                    <Badge key={cuisine} variant="secondary" className="text-sm">
                      {cuisine}
                    </Badge>
                  ))}
                </div>

                {/* Dietary Badges */}
                <div className="flex flex-wrap gap-2">
                  {restaurant.badges.filter(badge => 
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

                {/* Student Features */}
                <div className="flex flex-wrap gap-2">
                  {restaurant.hasGroupSeating && (
                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-0">
                      <Users className="w-3.5 h-3.5 mr-1" />
                      Group Seating
                    </Badge>
                  )}
                  {restaurant.hasStudentDiscount && (
                    <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-0">
                      <Ticket className="w-3.5 h-3.5 mr-1" />
                      Student Discount {restaurant.studentDiscountAmount}
                    </Badge>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSwipe('left');
                    }}
                    className="bg-red-50 hover:bg-red-100 border-red-200 text-red-600"
                  >
                    <X className="w-6 h-6" />
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowInfo(true);
                    }}
                    className="bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-600"
                  >
                    <Info className="w-6 h-6" />
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSwipe('right');
                    }}
                    className="bg-green-50 hover:bg-green-100 border-green-200 text-green-600"
                  >
                    <Heart className="w-6 h-6" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Info Dialog */}
      <Dialog open={showInfo} onOpenChange={setShowInfo}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">{restaurant.name}</DialogTitle>
            <DialogDescription className="flex items-center gap-3 mt-2">
              <span className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                {restaurant.rating.toFixed(1)} ({restaurant.reviewCount} reviews)
              </span>
              <span>•</span>
              <span>{restaurant.cost}</span>
              <span>•</span>
              <span>{restaurant.distance} from NYU</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Images */}
            <div className="grid grid-cols-3 gap-2">
              {restaurant.images.map((img, idx) => (
                <img 
                  key={idx}
                  src={img} 
                  alt={`${restaurant.name} ${idx + 1}`}
                  className="w-full h-32 object-cover rounded-lg"
                />
              ))}
            </div>

            {/* Student Features */}
            {(restaurant.hasGroupSeating || restaurant.hasStudentDiscount) && (
              <div>
                <h3 className="font-semibold mb-2">Student Perks</h3>
                <div className="flex flex-wrap gap-2">
                  {restaurant.hasGroupSeating && (
                    <Badge className="bg-blue-100 text-blue-700 border-0">
                      <Users className="w-3.5 h-3.5 mr-1" />
                      Group Seating Available
                    </Badge>
                  )}
                  {restaurant.hasStudentDiscount && (
                    <Badge className="bg-amber-100 text-amber-700 border-0">
                      <Ticket className="w-3.5 h-3.5 mr-1" />
                      Student Discount {restaurant.studentDiscountAmount}
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Cuisine */}
            <div>
              <h3 className="font-semibold mb-2">Cuisine</h3>
              <div className="flex flex-wrap gap-2">
                {restaurant.cuisine.map((cuisine) => (
                  <Badge key={cuisine} variant="secondary">
                    {cuisine}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Dietary Options */}
            {restaurant.badges.filter(badge => 
              badge.includes('Vegan') || badge.includes('Halal') || badge.includes('Kosher') || badge.includes('Vegetarian')
            ).length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Dietary Options</h3>
                <div className="flex flex-wrap gap-2">
                  {restaurant.badges.filter(badge => 
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
              </div>
            )}

            {/* Health Inspection - Enhanced */}
            <div>
              <h3 className="font-semibold mb-3">Health Inspection Results</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className={`${gradeColors[restaurant.sanitationGrade]} text-white w-16 h-16 rounded-xl flex items-center justify-center`}>
                    <span className="text-3xl font-bold">{restaurant.sanitationGrade}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-lg font-semibold">Grade {restaurant.sanitationGrade}</p>
                    {restaurant.healthInspection && (
                      <p className="text-sm text-muted-foreground">
                        Inspection Score: {restaurant.healthInspection.score} points
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Calendar className="w-3 h-3" />
                      Last inspected: {new Date(restaurant.inspectionDate).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </p>
                  </div>
                </div>

                {restaurant.healthInspection && restaurant.healthInspection.violations.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium flex items-center gap-2 text-orange-900">
                      <AlertTriangle className="w-4 h-4" />
                      Violations Detected
                    </p>
                    {restaurant.healthInspection.violations.map((violation, idx) => {
                      const severityColors = {
                        critical: 'bg-red-50 border-red-200 text-red-900',
                        major: 'bg-orange-50 border-orange-200 text-orange-900',
                        minor: 'bg-yellow-50 border-yellow-200 text-yellow-900'
                      };
                      const severityBadges = {
                        critical: 'bg-red-600 text-white',
                        major: 'bg-orange-600 text-white',
                        minor: 'bg-yellow-600 text-white'
                      };
                      return (
                        <div key={idx} className={`p-3 border rounded-lg ${severityColors[violation.severity]}`}>
                          <div className="flex items-start gap-2">
                            <Badge className={`${severityBadges[violation.severity]} text-xs uppercase`}>
                              {violation.severity}
                            </Badge>
                            <div className="flex-1">
                              <p className="text-sm font-medium">{violation.type}</p>
                              <p className="text-xs mt-1">{violation.description}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-900 font-medium">✓ No violations found during last inspection</p>
                  </div>
                )}
              </div>
            </div>

            {/* Location & Distance */}
            <div>
              <h3 className="font-semibold mb-2">Location & Distance</h3>
              <div className="space-y-2">
                <p className="text-sm flex items-start gap-2">
                  <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{restaurant.address}</span>
                </p>
                <p className="text-sm text-muted-foreground ml-6">
                  {restaurant.distance} walk from Washington Square Park
                </p>
              </div>
            </div>

            {/* Other Features */}
            {restaurant.badges.filter(badge => 
              !badge.includes('Vegan') && !badge.includes('Halal') && !badge.includes('Kosher') && !badge.includes('Vegetarian')
            ).length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Other Features</h3>
                <div className="flex flex-wrap gap-2">
                  {restaurant.badges.filter(badge => 
                    !badge.includes('Vegan') && !badge.includes('Halal') && !badge.includes('Kosher') && !badge.includes('Vegetarian')
                  ).map((badge) => (
                    <Badge 
                      key={badge}
                      variant="outline"
                    >
                      {badge}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {restaurant.notes && (
              <div>
                <h3 className="font-semibold mb-2">Additional Info</h3>
                <p className="text-sm text-muted-foreground">{restaurant.notes}</p>
              </div>
            )}

            {/* Menu Link */}
            {restaurant.menuLink && (
              <div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => window.open(restaurant.menuLink, '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View Menu
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}