import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useVenue } from '@/app/contexts/venue-context';
import type { VenueSearchResult } from '@/app/contexts/venue-context';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';
import {
  ArrowLeft,
  Store,
  Search,
  CheckCircle,
  MapPin,
  Phone,
  UtensilsCrossed,
} from 'lucide-react';
import { Badge } from '@/app/components/ui/badge';

export function AddRestaurantPage() {
  const navigate = useNavigate();
  const { searchVenues, claimVenue, venueError, venueLoading } = useVenue();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<VenueSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<VenueSearchResult | null>(null);

  // Student discount state (only editable field)
  const [studentDiscount, setStudentDiscount] = useState(false);
  const [discountDetails, setDiscountDetails] = useState('');

  const [submitError, setSubmitError] = useState('');
  const searchRef = useRef<HTMLDivElement>(null);

  // Debounced search as user types
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      const results = await searchVenues(searchQuery);
      setSearchResults(results);
      setShowDropdown(true);
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, searchVenues]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectVenue = (venue: VenueSearchResult) => {
    setSelectedVenue(venue);
    setSearchQuery(venue.name);
    setShowDropdown(false);
    setSubmitError('');
  };

  const handleClearSelection = () => {
    setSelectedVenue(null);
    setSearchQuery('');
    setSearchResults([]);
    setStudentDiscount(false);
    setDiscountDetails('');
    setSubmitError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (!selectedVenue) {
      setSubmitError('Please search for and select a venue from the list');
      return;
    }

    const success = await claimVenue(
      selectedVenue.id,
      studentDiscount,
      discountDetails
    );

    if (success) {
      navigate('/venue/dashboard');
    }
  };

  const getSanitationColor = (grade: string) => {
    switch (grade) {
      case 'A':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'B':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'C':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const errorMessage = submitError || venueError;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/venue/dashboard')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl flex items-center gap-2">
              <Store className="w-5 h-5 text-purple-600" />
              Add Restaurant
            </h1>
            <p className="text-sm text-muted-foreground">
              Search for your restaurant and claim it
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <Card className="border-0 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-purple-500/90 to-pink-500/90 text-white rounded-t-xl pb-6">
            <CardTitle className="text-xl">Find Your Restaurant</CardTitle>
            <CardDescription className="text-purple-50 pt-1">
              Search by restaurant name to find and claim your listing
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-8 pb-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Search Box */}
              <div className="space-y-2" ref={searchRef}>
                <Label htmlFor="search" className="text-base font-semibold">
                  Restaurant Name
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Start typing your restaurant name..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      if (selectedVenue) setSelectedVenue(null);
                    }}
                    className="pl-9 h-11"
                    autoComplete="off"
                  />
                  {isSearching && (
                    <div className="absolute right-3 top-3 text-xs text-muted-foreground">
                      Searching...
                    </div>
                  )}

                  {/* Dropdown Results */}
                  {showDropdown && searchResults.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                      {searchResults.map((venue) => (
                        <button
                          key={venue.id}
                          type="button"
                          className="w-full text-left px-4 py-3 hover:bg-purple-50 border-b last:border-0 transition-colors"
                          onClick={() => handleSelectVenue(venue)}
                        >
                          <div className="font-medium text-sm">{venue.name}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3" />
                            {venue.street_address}, {venue.borough}
                            {venue.sanitation_grade && (
                              <span
                                className={`ml-2 px-1.5 py-0.5 rounded text-xs font-bold border ${getSanitationColor(venue.sanitation_grade)}`}
                              >
                                Grade {venue.sanitation_grade}
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* No results message */}
                  {showDropdown &&
                    searchResults.length === 0 &&
                    !isSearching &&
                    searchQuery.length >= 2 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg p-4 text-center text-sm text-muted-foreground">
                        No restaurants found matching "{searchQuery}"
                      </div>
                    )}
                </div>
              </div>

              {/* Selected Venue Preview */}
              {selectedVenue && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-purple-600" />
                      <h3 className="font-semibold text-purple-900">
                        Selected Restaurant
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearSelection}
                      className="text-xs text-purple-500 hover:text-purple-700 underline"
                    >
                      Clear selection
                    </button>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    {/* Left column */}
                    <div className="space-y-2">
                      <div>
                        <span className="font-semibold text-lg text-gray-900">
                          {selectedVenue.name}
                        </span>
                      </div>
                      <div className="flex items-start gap-1.5 text-gray-600">
                        <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <div>
                          <p>{selectedVenue.street_address}</p>
                          <p>
                            {selectedVenue.neighborhood &&
                              `${selectedVenue.neighborhood}, `}
                            {selectedVenue.borough}
                          </p>
                        </div>
                      </div>
                      {selectedVenue.phone && (
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <Phone className="w-4 h-4 flex-shrink-0" />
                          <p>{selectedVenue.phone}</p>
                        </div>
                      )}
                      {selectedVenue.cuisine_type && (
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <UtensilsCrossed className="w-4 h-4 flex-shrink-0" />
                          <p>{selectedVenue.cuisine_type}</p>
                        </div>
                      )}
                    </div>

                    {/* Right column */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {selectedVenue.price_range && (
                          <Badge variant="outline">{selectedVenue.price_range}</Badge>
                        )}
                        {selectedVenue.sanitation_grade && (
                          <span
                            className={`px-2 py-1 rounded text-xs font-bold border ${getSanitationColor(selectedVenue.sanitation_grade)}`}
                          >
                            Grade {selectedVenue.sanitation_grade}
                          </span>
                        )}
                        {selectedVenue.is_verified && (
                          <Badge className="bg-green-100 text-green-700 border-green-300">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Verified
                          </Badge>
                        )}
                      </div>
                      {selectedVenue.seating_capacity && (
                        <p className="text-gray-600">
                          Capacity: {selectedVenue.seating_capacity} seats
                          {selectedVenue.has_group_seating && ' • Group seating'}
                        </p>
                      )}
                      {selectedVenue.google_rating && (
                        <p className="text-gray-600">
                          Google Rating: ⭐ {selectedVenue.google_rating}
                        </p>
                      )}
                      {selectedVenue.dietary_tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {selectedVenue.dietary_tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Student Discount Section — only editable part */}
              {selectedVenue && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2">
                    Student Benefits
                  </h3>

                  <div className="space-y-3">
                    <Label>Offer Student Discount?</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={studentDiscount ? 'default' : 'outline'}
                        className={
                          studentDiscount
                            ? 'bg-purple-600 hover:bg-purple-700 flex-1'
                            : 'flex-1'
                        }
                        onClick={() => setStudentDiscount(true)}
                      >
                        Yes
                      </Button>
                      <Button
                        type="button"
                        variant={!studentDiscount ? 'default' : 'outline'}
                        className={
                          !studentDiscount
                            ? 'bg-purple-600 hover:bg-purple-700 flex-1'
                            : 'flex-1'
                        }
                        onClick={() => setStudentDiscount(false)}
                      >
                        No
                      </Button>
                    </div>
                  </div>

                  {studentDiscount && (
                    <div className="space-y-2">
                      <Label htmlFor="discountDetails">Discount Details</Label>
                      <Input
                        id="discountDetails"
                        placeholder="e.g., 15% off with NYU ID"
                        value={discountDetails}
                        onChange={(e) => setDiscountDetails(e.target.value)}
                        className="h-11"
                      />
                    </div>
                  )}
                </div>
              )}

              {errorMessage && <p className="text-sm text-red-500">{errorMessage}</p>}

              <div className="pt-4 flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/venue/dashboard')}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  disabled={venueLoading || !selectedVenue}
                >
                  {venueLoading ? 'Claiming...' : 'Claim Restaurant'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
