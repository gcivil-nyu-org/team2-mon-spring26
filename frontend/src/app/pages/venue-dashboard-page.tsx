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
import { UtensilsCrossed, Plus, MapPin, Phone, Mail, Tag } from 'lucide-react';

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
  const [selectedList, setSelectedList] = useState<
    'pending' | 'approved' | 'rejected' | 'discounts'
  >('pending');

  useEffect(() => {
    fetchMyVenues();
  }, [fetchMyVenues]);

  const rejectedClaims = myClaims?.filter((claim) => claim.status === 'rejected') ?? [];
  const approvedClaims = myClaims?.filter((claim) => claim.status === 'approved') ?? [];
  const pendingClaims = myClaims?.filter((claim) => claim.status === 'pending') ?? [];
  const discountVenues = myVenues.filter((venue) => venue.activeDiscounts.length > 0);

  const selectedClaims =
    selectedList === 'pending'
      ? pendingClaims
      : selectedList === 'approved'
        ? approvedClaims
        : selectedList === 'rejected'
          ? rejectedClaims
          : [];

  return (
    <div>
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Dashboard View</CardDescription>
            <CardTitle className="text-3xl">Choose a list</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="dashboard-view"
                  className="block text-sm font-medium text-muted-foreground"
                >
                  Select list type
                </label>
                <select
                  id="dashboard-view"
                  value={selectedList}
                  onChange={(event) =>
                    setSelectedList(event.target.value as typeof selectedList)
                  }
                  className="mt-2 block w-full rounded-md border border-border bg-background py-2 px-3 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
                >
                  <option value="pending">
                    Pending claims ({pendingClaims.length})
                  </option>
                  <option value="approved">
                    Approved claims ({approvedClaims.length})
                  </option>
                  <option value="rejected">
                    Rejected claims ({rejectedClaims.length})
                  </option>
                  <option value="discounts">
                    Venues with discounts ({discountVenues.length})
                  </option>
                </select>
              </div>
              <div className="flex flex-col justify-end">
                <p className="text-sm text-muted-foreground">
                  Pick a view to show a filtered list below.
                </p>
                <div className="mt-3 inline-flex items-center gap-2 rounded-md bg-orange-50 px-3 py-2 text-sm text-orange-700">
                  {selectedList === 'discounts'
                    ? `${discountVenues.length} venue(s) with active discounts`
                    : `${selectedClaims.length} claim(s) matching "${selectedList}"`}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

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

        {venuesLoading && (
          <div className="text-center py-10">
            <div className="rounded-full h-10 w-10 border-4 border-orange-500 border-t-transparent animate-spin mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">Loading your venues…</p>
          </div>
        )}

        {!venuesLoading &&
          selectedList === 'discounts' &&
          discountVenues.length === 0 && (
            <Card className="p-12">
              <div className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
                  <UtensilsCrossed className="w-8 h-8 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">No discounted venues</h3>
                  <p className="text-muted-foreground mt-2">
                    You don't have any active discounts yet.
                  </p>
                </div>
              </div>
            </Card>
          )}

        {!venuesLoading &&
          selectedList === 'discounts' &&
          discountVenues.length > 0 && (
            <div className="grid gap-4">
              {discountVenues.map((venue) => {
                const gradeColor =
                  GRADE_COLORS[venue.sanitationGrade] ?? GRADE_COLORS['N'];
                return (
                  <Card key={venue.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <CardTitle className="text-xl">{venue.name}</CardTitle>
                            <Badge
                              variant="secondary"
                              className="bg-green-100 text-green-700 border-green-300 text-xs"
                            >
                              Discounts
                            </Badge>
                          </div>
                          <CardDescription>
                            {venue.cuisineType && `${venue.cuisineType} · `}
                            {venue.priceRange}
                          </CardDescription>
                        </div>
                        <Badge
                          className={`${gradeColor} border px-3 py-1 text-base font-bold shrink-0`}
                        >
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
                                <p>
                                  {venue.neighborhood}, {venue.borough}
                                </p>
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
                          {venue.activeDiscounts.length > 0 && (
                            <div className="flex items-start gap-2">
                              <Tag className="w-4 h-4 mt-0.5 text-purple-600 shrink-0" />
                              <div className="space-y-1">
                                {venue.activeDiscounts.map((d) => (
                                  <div
                                    key={d.id}
                                    className="bg-purple-50 border border-purple-200 rounded-md px-2 py-1"
                                  >
                                    <p className="text-xs font-medium text-purple-900">
                                      {d.discountValue}
                                    </p>
                                    {d.description && (
                                      <p className="text-xs text-purple-700">
                                        {d.description}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {venue.lastInspectionDate && (
                            <p className="text-xs text-muted-foreground">
                              Last inspection:{' '}
                              {new Date(venue.lastInspectionDate).toLocaleDateString()}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-2 pt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                navigate(`/venue/venue/${venue.id}/discounts`)
                              }
                            >
                              Manage Discounts
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                navigate(`/venue/venue/${venue.id}/reviews`)
                              }
                            >
                              View Reviews
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

        {!venuesLoading && selectedList !== 'discounts' && myClaims && (
          <div className="mt-12 space-y-4">
            <h2 className="text-2xl font-semibold">
              {selectedList.charAt(0).toUpperCase() + selectedList.slice(1)} Claims
            </h2>
            {selectedClaims.length === 0 ? (
              <Card className="p-12">
                <div className="text-center space-y-4">
                  <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
                    <UtensilsCrossed className="w-8 h-8 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">No {selectedList} claims</h3>
                    <p className="text-muted-foreground mt-2">
                      There are no {selectedList} claims for your venues right now.
                    </p>
                  </div>
                </div>
              </Card>
            ) : (
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
                      {selectedClaims.map((claim) => (
                        <tr key={claim.id} className="bg-card hover:bg-muted/30">
                          <td className="px-6 py-4 font-medium">
                            {claim.status === 'approved' ? (
                              <button
                                type="button"
                                onClick={() =>
                                  navigate(`/venue/venue/${claim.venue.id}/discounts`)
                                }
                                className="text-orange-700 hover:text-orange-900 underline"
                              >
                                {claim.venue.name}
                              </button>
                            ) : (
                              claim.venue.name
                            )}
                          </td>
                          <td className="px-6 py-4 text-muted-foreground">
                            {claim.venue.streetAddress}, {claim.venue.borough}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {new Date(claim.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4">
                            {claim.status === 'pending' && (
                              <Badge
                                variant="outline"
                                className="text-amber-700 border-amber-300 bg-amber-50"
                              >
                                Pending
                              </Badge>
                            )}
                            {claim.status === 'approved' && (
                              <Badge
                                variant="secondary"
                                className="bg-green-100 text-green-700 border-green-300"
                              >
                                Approved
                              </Badge>
                            )}
                            {claim.status === 'rejected' && (
                              <Badge variant="destructive">Rejected</Badge>
                            )}
                            {claim.status === 'rejected' && claim.adminNote && (
                              <p className="mt-2 text-xs text-red-700">
                                Reason: {claim.adminNote}
                              </p>
                            )}
                          </td>
                          <td
                            className="px-6 py-4 text-muted-foreground max-w-xs truncate"
                            title={claim.adminNote || '-'}
                          >
                            {claim.adminNote || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        )}
      </main>

      <Dialog
        open={!!venueToUnclaim}
        onOpenChange={(open) => !open && setVenueToUnclaim(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Venue</DialogTitle>
            <DialogDescription>
              Contact support to unclaim a venue. This action requires manual review.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVenueToUnclaim(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
