import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/app/components/ui/dialog';
import { Star, MapPin, ExternalLink, Calendar, AlertTriangle, Users, Ticket, Phone, Globe, Clock } from 'lucide-react';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import type { Restaurant } from '@/app/data/mock-restaurants';

export interface RestaurantInfoDialogProps {
  restaurant: Restaurant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RestaurantInfoDialog({ restaurant, open, onOpenChange }: RestaurantInfoDialogProps) {
  if (!restaurant) return null;

  const gradeColors: Record<string, string> = {
    A: 'bg-green-500',
    B: 'bg-yellow-500',
    C: 'bg-orange-500',
    N: 'bg-gray-400',
    P: 'bg-gray-500',
    Z: 'bg-red-500'
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                    const severityColors: Record<string, string> = {
                      critical: 'bg-red-50 border-red-200 text-red-900',
                      major: 'bg-orange-50 border-orange-200 text-orange-900',
                      minor: 'bg-yellow-50 border-yellow-200 text-yellow-900'
                    };
                    const severityBadges: Record<string, string> = {
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

          {/* Contact & Hours */}
          {(restaurant.phone || restaurant.website || (restaurant.hours && Object.keys(restaurant.hours).length > 0)) && (
            <div>
              <h3 className="font-semibold mb-2">Contact & Hours</h3>
              <div className="space-y-2">
                {restaurant.phone && (
                  <p className="text-sm flex items-center gap-2">
                    <Phone className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                    <a
                      href={`tel:${restaurant.phone.replace(/\s+/g, '')}`}
                      className="text-blue-600 hover:underline"
                    >
                      {restaurant.phone}
                    </a>
                  </p>
                )}
                {restaurant.website && (
                  <p className="text-sm flex items-center gap-2">
                    <Globe className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                    <a
                      href={restaurant.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline truncate"
                    >
                      {restaurant.website.replace(/^https?:\/\//, '')}
                    </a>
                  </p>
                )}
                {restaurant.hours && Object.keys(restaurant.hours).length > 0 && (
                  <div className="text-sm flex items-start gap-2">
                    <Clock className="w-4 h-4 flex-shrink-0 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium mb-1">Operating Hours</p>
                      <ul className="space-y-0.5 text-muted-foreground">
                        {Object.entries(restaurant.hours).map(([day, time]) => (
                          <li key={day} className="flex justify-between gap-4">
                            <span className="capitalize">{day}</span>
                            <span>{time}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

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

          {/* Action Links */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                if (restaurant.googleMapsUrl) {
                  window.open(restaurant.googleMapsUrl, '_blank');
                } else {
                  const address = encodeURIComponent(restaurant.address);
                  window.open(`https://maps.google.com/?q=${address}`, '_blank');
                }
              }}
            >
              <MapPin className="w-4 h-4 mr-2" />
              Directions
            </Button>
            {restaurant.menuLink && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => window.open(restaurant.menuLink, '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Menu
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
