import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useVenue } from '@/app/contexts/venue-context';
import type { ManagedVenue } from '@/app/contexts/venue-context';
import { Button } from '@/app/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/app/components/ui/dialog';
import {
  UtensilsCrossed,
  Plus,
  MapPin,
  Phone,
  Mail,
  Users,
  CheckCircle,
  Clock,
  Tag,
} from 'lucide-react';

const GRADE_COLORS: Record<string, string> = {
  A: 'bg-green-100 text-green-800 border-green-300',
  B: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  C: 'bg-orange-100 text-orange-800 border-orange-300',
  N: 'bg-gray-100 text-gray-600 border-gray-300',
  P: 'bg-gray-100 text-gray-600 border-gray-300',
  Z: 'bg-red-100 text-red-800 border-red-300',
};

export function VenueDashboardPage() {
  const { myVenues, myClaims, venuesLoading, fetchMyVenues } = useVenue();
  const navigate = useNavigate();
  const [venueToUnclaim, setVenueToUnclaim] = useState<ManagedVenue | null>(null);

  useEffect(() => {
    fetchMyVenues();
  }, [fetchMyVenues]);

  const verifiedCount = myVenues.filter((v) => v.isVerified).length;
  const withDiscountsCount = myVenues.filter((v) => v.activeDiscounts.length > 0).length;

  return (
    <div>
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Claimed Venues</CardDescription>
              <CardTitle className="text-3xl">{myVenues.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Verified Listings</CardDescription>
              <CardTitle className="text-3xl">{verifiedCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>With Active Discounts</CardDescription>
              <CardTitle className="text-3xl">{withDiscountsCount}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Venue List Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-semibold">Your Venues</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Claim a venue to start managing student discounts
            </p>
          </div>
          <Button
            onClick={() => navigate('/venue/claim')}
            className="bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Claim a Venue
          </Button>
        </div>

        {/* Loading */}
        {venuesLoading && (
          <div className="text-center py-10">
            <div className="rounded-full h-10 w-10 border-4 border-orange-500 border-t-transparent animate-spin mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">Loading your venues…</p>
          </div>
        )}

        {/* Empty state */}
        {!venuesLoading && myVenues.length === 0 && (
          <Card className="p-12">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
                <UtensilsCrossed className="w-8 h-8 text-orange-600" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">No Venues Yet</h3>
                <p className="text-muted-foreground mt-2">
                  Search for your restaurant and claim it to get started
                </p>
              </div>
              <Button
                onClick={() => navigate('/venue/claim')}
                className="bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Claim a Venue
              </Button>
            </div>
          </Card>
        )}

        {/* Venue Cards */}
        {!venuesLoading && myVenues.length > 0 && (
          <div className="grid gap-4">
            {myVenues.map((venue) => {
              const gradeColor = GRADE_COLORS[venue.sanitationGrade] ?? GRADE_COLORS['N'];
              return (
                <Card key={venue.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-xl">{venue.name}</CardTitle>
                          {venue.isVerified ? (
                            <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-300 text-xs">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Verified
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-amber-700 border-amber-300 bg-amber-50">
                              <Clock className="w-3 h-3 mr-1" />
                              Pending verification
                            </Badge>
                          )}
                        </div>
                        <CardDescription>
                          {venue.cuisineType && `${venue.cuisineType} · `}{venue.priceRange}
                        </CardDescription>
                      </div>
                      <Badge className={`${gradeColor} border px-3 py-1 text-base font-bold shrink-0`}>
                        {venue.sanitationGrade || '–'}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div className="space-y-2">
                        <div className="flex items-start gap-2 text-muted-foreground">
                          <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                          <div>
                            <p>{venue.streetAddress}</p>
                            {venue.neighborhood && (
                              <p>{venue.neighborhood}, {venue.borough}</p>
                            )}
                          </div>
                        </div>
                        {venue.phone && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="w-4 h-4 shrink-0" />
                            <span>{venue.phone}</span>
                          </div>
                        )}
                        {venue.email && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="w-4 h-4 shrink-0" />
                            <span className="truncate">{venue.email}</span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        {venue.seatingCapacity && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Users className="w-4 h-4 shrink-0" />
                            <span>
                              {venue.seatingCapacity} seats
                              {venue.hasGroupSeating ? ' · Group seating' : ''}
                            </span>
                          </div>
                        )}
                        {venue.activeDiscounts.length > 0 && (
                          <div className="flex items-start gap-2">
                            <Tag className="w-4 h-4 mt-0.5 text-purple-600 shrink-0" />
                            <div className="space-y-1">
                              {venue.activeDiscounts.map((d) => (
                                <div key={d.id} className="bg-purple-50 border border-purple-200 rounded-md px-2 py-1">
                                  <p className="text-xs font-medium text-purple-900">{d.discountValue}</p>
                                  {d.description && (
                                    <p className="text-xs text-purple-700">{d.description}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {venue.lastInspectionDate && (
                          <p className="text-xs text-muted-foreground">
                            Last inspection: {new Date(venue.lastInspectionDate).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/venue/venue/${venue.id}/discounts`)}
                      >
                        Manage Discounts
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Claims Table section */}
        {!venuesLoading && myClaims && myClaims.length > 0 && (
          <div className="mt-12 space-y-4">
            <h2 className="text-2xl font-semibold">Verification Claims History</h2>
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                    <tr>
                      <th className="px-6 py-3">Venue</th>
                      <th className="px-6 py-3">Location</th>
                      <th className="px-6 py-3">Date Submitted</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3">Admin Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {myClaims.map((claim) => (
                      <tr key={claim.id} className="bg-card hover:bg-muted/30">
                        <td className="px-6 py-4 font-medium">{claim.venue.name}</td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {claim.venue.streetAddress}, {claim.venue.borough}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {new Date(claim.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          {claim.status === 'pending' && <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">Pending</Badge>}
                          {claim.status === 'approved' && <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-300">Approved</Badge>}
                          {claim.status === 'rejected' && <Badge variant="destructive">Rejected</Badge>}
                        </td>
                        <td className="px-6 py-4 text-muted-foreground max-w-xs truncate" title={claim.adminNote || '-'}>
                          {claim.adminNote || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
      </main>

      {/* Unclaim confirmation (reserved for future use) */}
      <Dialog open={!!venueToUnclaim} onOpenChange={(open) => !open && setVenueToUnclaim(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Venue</DialogTitle>
            <DialogDescription>
              Contact support to unclaim a venue. This action requires manual review.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVenueToUnclaim(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
