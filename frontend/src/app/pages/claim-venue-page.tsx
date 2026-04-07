import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useVenue } from '@/app/contexts/venue-context';
import type { VenueSearchResult } from '@/app/contexts/venue-context';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { Badge } from '@/app/components/ui/badge';
import {
  Search,
  MapPin,
  CheckCircle,
  Lock,
  Star,
  Phone,
  Globe,
  Users,
  Ticket,
  Calendar,
} from 'lucide-react';

const BOROUGHS = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'];

const GRADE_COLORS: Record<string, string> = {
  A: 'bg-green-100 text-green-800 border-green-300',
  B: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  C: 'bg-orange-100 text-orange-800 border-orange-300',
  N: 'bg-gray-100 text-gray-600 border-gray-300',
  P: 'bg-gray-100 text-gray-600 border-gray-300',
  Z: 'bg-red-100 text-red-800 border-red-300',
};

export function ClaimVenuePage() {
  const navigate = useNavigate();
  const { searchVenues, claimVenue } = useVenue();

  const [query, setQuery] = useState('');
  const [borough, setBorough] = useState('');
  const [results, setResults] = useState<VenueSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [claimingId, setClaimingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [successId, setSuccessId] = useState<number | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query.trim() && !borough) {
      setResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      setError('');
      try {
        const data = await searchVenues(query.trim(), borough || undefined);
        setResults(data);
      } catch {
        setError('Search failed. Please try again.');
      } finally {
        setSearchLoading(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, borough, searchVenues]);

  const handleClaim = async (venue: VenueSearchResult) => {
    setClaimingId(venue.id);
    setError('');
    try {
      await claimVenue(venue.id);
      setSuccessId(venue.id);
      // After brief success flash, navigate to dashboard
      setTimeout(() => navigate('/venue/dashboard'), 1200);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to claim venue');
      setClaimingId(null);
    }
  };

  return (
    <div>
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Search Controls */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by restaurant name…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 h-11"
                autoFocus
              />
            </div>
            <Select value={borough || 'all'} onValueChange={(v) => setBorough(v === 'all' ? '' : v)}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="All boroughs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All boroughs</SelectItem>
                {BOROUGHS.map((b) => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        {/* Results */}
        {searchLoading && (
          <div className="text-center py-10 text-muted-foreground text-sm">Searching…</div>
        )}

        {!searchLoading && results.length === 0 && (query.trim() || borough) && (
          <div className="text-center py-10 text-muted-foreground text-sm">
            No venues found. Try a different name or borough.
          </div>
        )}

        {!searchLoading && !query.trim() && !borough && (
          <div className="text-center py-10 text-muted-foreground text-sm">
            Type a restaurant name to search the database.
          </div>
        )}

        <div className="space-y-3">
          {results.map((venue) => {
            const isSuccess = successId === venue.id;
            const isClaiming = claimingId === venue.id;
            const gradeColor = GRADE_COLORS[venue.sanitationGrade] ?? GRADE_COLORS['N'];

            return (
              <Card key={venue.id} className={isSuccess ? 'ring-2 ring-green-400' : ''}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    {/* Name + claimed badge */}
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                        {venue.name}
                        {venue.isClaimed && (
                          <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                            <Lock className="w-3 h-3 mr-1" />
                            Claimed{venue.claimedBy ? ` by ${venue.claimedBy}` : ''}
                          </Badge>
                        )}
                      </CardTitle>
                      {/* Address */}
                      <CardDescription className="flex items-start gap-1 mt-1">
                        <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
                        <span>
                          {venue.streetAddress}
                          {venue.neighborhood ? ` · ${venue.neighborhood}` : ''}
                          {venue.borough ? `, ${venue.borough}` : ''}
                          {venue.zipcode ? ` ${venue.zipcode}` : ''}
                        </span>
                      </CardDescription>
                    </div>
                    {/* Sanitation grade */}
                    <div className="shrink-0 text-center">
                      <Badge className={`${gradeColor} border font-bold text-sm px-2.5 py-1`}>
                        {venue.sanitationGrade || '–'}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-0.5">Grade</p>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-0 space-y-3">
                  {/* Rating + cuisine + price */}
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    {venue.googleRating != null && (
                      <span className="flex items-center gap-1 font-medium">
                        <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                        {venue.googleRating.toFixed(1)}
                        {venue.googleReviewCount > 0 && (
                          <span className="text-muted-foreground font-normal">({venue.googleReviewCount})</span>
                        )}
                      </span>
                    )}
                    {venue.cuisineType && (
                      <Badge variant="secondary" className="text-xs">{venue.cuisineType}</Badge>
                    )}
                    {venue.priceRange && (
                      <span className="text-muted-foreground font-medium">{venue.priceRange}</span>
                    )}
                  </div>

                  {/* Contact row */}
                  {(venue.phone || venue.website) && (
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      {venue.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {venue.phone}
                        </span>
                      )}
                      {venue.website && (
                        <a
                          href={venue.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Globe className="w-3 h-3" />
                          Website
                        </a>
                      )}
                    </div>
                  )}

                  {/* Dietary tags */}
                  {venue.dietaryTags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {venue.dietaryTags.map((tag) => (
                        <Badge
                          key={tag}
                          className="text-xs bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Service options + seating */}
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {venue.hasDineIn && <span className="bg-gray-100 px-2 py-0.5 rounded">Dine-in</span>}
                    {venue.hasTakeout && <span className="bg-gray-100 px-2 py-0.5 rounded">Takeout</span>}
                    {venue.hasDelivery && <span className="bg-gray-100 px-2 py-0.5 rounded">Delivery</span>}
                    {venue.isReservable && <span className="bg-gray-100 px-2 py-0.5 rounded">Reservations</span>}
                    {venue.hasGroupSeating && (
                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        Group seating
                        {venue.seatingCapacity ? ` · ${venue.seatingCapacity} seats` : ''}
                      </span>
                    )}
                    {venue.hasStudentDiscount && (
                      <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded flex items-center gap-1">
                        <Ticket className="w-3 h-3" />
                        Student discount
                      </span>
                    )}
                  </div>

                  {/* Last inspection */}
                  {venue.lastInspectionDate && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Last inspected: {new Date(venue.lastInspectionDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                      {venue.lastInspectionScore != null && ` · Score ${venue.lastInspectionScore}`}
                    </p>
                  )}

                  {/* Claim button */}
                  <div className="flex justify-end pt-1 border-t">
                    {isSuccess ? (
                      <Button size="sm" disabled className="bg-green-600 text-white">
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Claimed!
                      </Button>
                    ) : venue.isClaimed ? (
                      <Button size="sm" variant="outline" disabled>
                        Already claimed
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        disabled={isClaiming}
                        onClick={() => handleClaim(venue)}
                        className="bg-orange-600 hover:bg-orange-700 text-white"
                      >
                        {isClaiming ? 'Claiming…' : 'Claim This Venue'}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
