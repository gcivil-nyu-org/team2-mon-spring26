import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Badge } from '@/app/components/ui/badge';
import { Label } from '@/app/components/ui/label';
import { Switch } from '@/app/components/ui/switch';
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
import { Save, UserX } from 'lucide-react';
import preferenceOptions from '@/app/data/preference-options.json';

const API = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000';
const BOROUGHS = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'];
const PRICE_RANGES = ['$', '$$', '$$$', '$$$$'];
const SANITATION_GRADES = ['A', 'B', 'C', 'N', 'Z', 'P'];

function getCookie(name: string): string {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() ?? '';
  return '';
}

interface VenueDetail {
  id: number;
  name: string;
  streetAddress: string;
  borough: string;
  neighborhood: string;
  zipcode: string;
  phone: string;
  email: string;
  website: string;
  cuisineType: string;
  priceRange: string;
  sanitationGrade: string;
  seatingCapacity: number | null;
  hasGroupSeating: boolean;
  hasTakeout: boolean;
  hasDelivery: boolean;
  hasDineIn: boolean;
  isReservable: boolean;
  isVerified: boolean;
  isActive: boolean;
  dietaryTags: string[];
  foodTypeTags: string[];
  googleRating: number | null;
  googleReviewCount: number;
  googleMapsUrl: string;
  lastInspectionDate: string | null;
  lastInspectionGrade: string;
  lastInspectionScore: number | null;
  isClaimed: boolean;
  manager: {
    id: number;
    businessName: string;
    userName: string;
    userEmail: string;
  } | null;
}

interface TagOptions {
  cuisineTypes: { id: number; name: string }[];
  dietaryTags: string[];
  foodTypeTags: string[];
}

export function AdminVenueEditPage() {
  const { venueId } = useParams<{ venueId: string }>();
  const navigate = useNavigate();

  const [venue, setVenue] = useState<VenueDetail | null>(null);
  const [options, setOptions] = useState<TagOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [name, setName] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [borough, setBorough] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [zipcode, setZipcode] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [cuisineType, setCuisineType] = useState('');
  const [priceRange, setPriceRange] = useState('');
  const [sanitationGrade, setSanitationGrade] = useState('');
  const [seatingCapacity, setSeatingCapacity] = useState('');
  const [hasGroupSeating, setHasGroupSeating] = useState(false);
  const [hasTakeout, setHasTakeout] = useState(false);
  const [hasDelivery, setHasDelivery] = useState(false);
  const [hasDineIn, setHasDineIn] = useState(true);
  const [isReservable, setIsReservable] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [dietaryTags, setDietaryTags] = useState<string[]>([]);
  const [foodTypeTags, setFoodTypeTags] = useState<string[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [venueRes, optionsRes] = await Promise.all([
          fetch(`${API}/api/venues/admin/venues/${venueId}/`, {
            credentials: 'include',
          }),
          fetch(`${API}/api/venues/admin/options/`, { credentials: 'include' }),
        ]);
        if (venueRes.ok) {
          const vData = await venueRes.json();
          const v = vData.venue as VenueDetail;
          setVenue(v);
          setName(v.name);
          setStreetAddress(v.streetAddress);
          setBorough(v.borough);
          setNeighborhood(v.neighborhood);
          setZipcode(v.zipcode);
          setPhone(v.phone);
          setEmail(v.email);
          setWebsite(v.website);
          setCuisineType(v.cuisineType);
          setPriceRange(v.priceRange);
          setSanitationGrade(v.sanitationGrade);
          setSeatingCapacity(v.seatingCapacity ? String(v.seatingCapacity) : '');
          setHasGroupSeating(v.hasGroupSeating);
          setHasTakeout(v.hasTakeout);
          setHasDelivery(v.hasDelivery);
          setHasDineIn(v.hasDineIn);
          setIsReservable(v.isReservable);
          setIsVerified(v.isVerified);
          setIsActive(v.isActive);
          setDietaryTags(v.dietaryTags);
          setFoodTypeTags(v.foodTypeTags);
        }
        if (optionsRes.ok) {
          setOptions(await optionsRes.json());
        }
      } catch (err) {
        console.error('Failed to load venue:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [venueId]);

  const toggleTag = (list: string[], setter: (v: string[]) => void, tag: string) => {
    setter(list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const csrftoken = getCookie('csrftoken') || '';
      const body = {
        name,
        streetAddress,
        borough,
        neighborhood,
        zipcode,
        phone,
        email,
        website,
        cuisineType,
        priceRange,
        sanitationGrade,
        seatingCapacity: seatingCapacity ? Number(seatingCapacity) : null,
        hasGroupSeating,
        hasTakeout,
        hasDelivery,
        hasDineIn,
        isReservable,
        isVerified,
        isActive,
        dietaryTags,
        foodTypeTags,
      };
      const res = await fetch(`${API}/api/venues/admin/venues/${venueId}/`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrftoken,
        },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast.success('Venue saved successfully.');
        const data = await res.json();
        setVenue(data.venue);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to save venue.');
      }
    } catch (err) {
      console.error('Save error:', err);
      toast.error('An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  const unique = (arr: string[]) => [...new Set(arr)].sort();

  const allCuisines = unique([
    ...(options?.cuisineTypes.map((c) => c.name) ?? []),
    ...(preferenceOptions.cuisines as string[]),
    ...(venue?.cuisineType ? [venue.cuisineType] : []),
  ]);

  const allDietary = unique([
    ...(options?.dietaryTags ?? []),
    ...(preferenceOptions.dietary as string[]),
    ...dietaryTags,
  ]);

  const allFoodTypes = unique([
    ...(options?.foodTypeTags ?? []),
    ...(preferenceOptions.foodTypes as string[]),
    ...foodTypeTags,
  ]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="rounded-full h-10 w-10 border-4 border-indigo-500 border-t-transparent animate-spin mx-auto mb-3" />
          <p className="text-muted-foreground">Loading venue…</p>
        </div>
      </div>
    );
  }

  if (!venue) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Venue not found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-5">
      {/* Venue name + Save button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">{venue.name}</h2>
          <p className="text-xs text-muted-foreground">ID #{venue.id}</p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white"
        >
          <Save className="w-4 h-4 mr-1.5" />
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div>
              <Label>Venue Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cuisine Type</Label>
                <Select value={cuisineType} onValueChange={setCuisineType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select cuisine" />
                  </SelectTrigger>
                  <SelectContent>
                    {allCuisines.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Price Range</Label>
                <Select value={priceRange} onValueChange={setPriceRange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRICE_RANGES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Sanitation Grade</Label>
                <Select value={sanitationGrade} onValueChange={setSanitationGrade}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {SANITATION_GRADES.map((g) => (
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Seating Capacity</Label>
                <Input
                  type="number"
                  value={seatingCapacity}
                  onChange={(e) => setSeatingCapacity(e.target.value)}
                  placeholder="e.g. 50"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Location */}
        <Card>
          <CardHeader>
            <CardTitle>Location</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div>
              <Label>Street Address</Label>
              <Input
                value={streetAddress}
                onChange={(e) => setStreetAddress(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Borough</Label>
                <Select value={borough} onValueChange={setBorough}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {BOROUGHS.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Neighborhood</Label>
                <Input
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                />
              </div>
              <div>
                <Label>Zipcode</Label>
                <Input
                  value={zipcode}
                  onChange={(e) => setZipcode(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Phone</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <Label>Website</Label>
                <Input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dietary Tags */}
        <Card>
          <CardHeader>
            <CardTitle>Dietary Options</CardTitle>
            <CardDescription>
              Select dietary options this venue offers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {allDietary.map((tag) => (
                <Badge
                  key={tag}
                  asChild
                  variant={dietaryTags.includes(tag) ? 'default' : 'secondary'}
                  className={`text-sm py-1.5 px-4 transition-colors ${
                    dietaryTags.includes(tag)
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-transparent shadow-sm'
                      : 'hover:bg-muted'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleTag(dietaryTags, setDietaryTags, tag)}
                    aria-pressed={dietaryTags.includes(tag)}
                    className="cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 rounded-md"
                  >
                    {tag}
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Food Type Tags */}
        <Card>
          <CardHeader>
            <CardTitle>Food Types</CardTitle>
            <CardDescription>
              Types of food this venue serves
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {allFoodTypes.map((tag) => (
                <Badge
                  key={tag}
                  asChild
                  variant={foodTypeTags.includes(tag) ? 'default' : 'secondary'}
                  className={`text-sm py-1.5 px-4 transition-colors ${
                    foodTypeTags.includes(tag)
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-transparent shadow-sm'
                      : 'hover:bg-muted'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleTag(foodTypeTags, setFoodTypeTags, tag)}
                    aria-pressed={foodTypeTags.includes(tag)}
                    className="cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 rounded-md"
                  >
                    {tag}
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Service Options */}
        <Card>
          <CardHeader>
            <CardTitle>Service & Status</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-4">
              {(
                [
                  ['Has Group Seating', hasGroupSeating, setHasGroupSeating],
                  ['Has Takeout', hasTakeout, setHasTakeout],
                  ['Has Delivery', hasDelivery, setHasDelivery],
                  ['Has Dine-In', hasDineIn, setHasDineIn],
                  ['Is Reservable', isReservable, setIsReservable],
                  ['Is Verified', isVerified, setIsVerified],
                  ['Is Active', isActive, setIsActive],
                ] as [string, boolean, (v: boolean) => void][]
              ).map(([label, value, setter]) => (
                <div key={label} className="flex items-center gap-2.5">
                  <Switch
                    checked={value}
                    onCheckedChange={setter}
                  />
                  <Label className="text-sm">{label}</Label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Venue Manager */}
        <Card>
          <CardHeader>
            <CardTitle>Venue Manager</CardTitle>
            <CardDescription>
              {venue.manager
                ? 'This venue is currently managed by a venue manager.'
                : 'No venue manager is assigned. A manager can claim this venue.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {venue.manager ? (
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-4 border">
                  <div className="grid gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name</span>
                      <span className="font-medium">
                        {venue.manager.userName || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Business</span>
                      <span className="font-medium">
                        {venue.manager.businessName || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Email</span>
                      <span className="font-medium">
                        {venue.manager.userEmail}
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="text-red-700 border-red-200 hover:bg-red-50 w-full"
                  onClick={async () => {
                    if (
                      !window.confirm(
                        `Remove ${venue.manager?.userName || venue.manager?.userEmail} as venue manager?\n\nThis will revoke their verification and all associated claims will be rejected. The venue will become available for a new manager to claim.`
                      )
                    )
                      return;
                    try {
                      const csrftoken = getCookie('csrftoken') || '';
                      const res = await fetch(
                        `${API}/api/venues/admin/venues/${venueId}/`,
                        {
                          method: 'PATCH',
                          credentials: 'include',
                          headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': csrftoken,
                          },
                          body: JSON.stringify({ removeManager: true }),
                        }
                      );
                      if (res.ok) {
                        const data = await res.json();
                        setVenue(data.venue);
                        setIsVerified(false);
                        toast.success('Venue manager removed successfully.');
                      } else {
                        const data = await res.json();
                        toast.error(data.error || 'Failed to remove manager.');
                      }
                    } catch (err) {
                      console.error(err);
                      toast.error('An error occurred.');
                    }
                  }}
                >
                  <UserX className="w-4 h-4 mr-1.5" />
                  Remove Venue Manager
                </Button>
              </div>
            ) : (
              <div className="text-center py-4">
                <Badge variant="outline">
                  Unclaimed
                </Badge>
                <p className="text-xs text-muted-foreground mt-2">
                  A venue manager can claim this venue from their dashboard.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Read-only Google / Inspection info */}
        {(venue.googleRating || venue.lastInspectionGrade) && (
          <Card>
            <CardHeader>
              <CardTitle>Inspection & Ratings</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              {venue.googleRating && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Google Rating</span>
                  <span className="font-medium">
                    {venue.googleRating}★ ({venue.googleReviewCount} reviews)
                  </span>
                </div>
              )}
              {venue.lastInspectionGrade && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Inspection</span>
                  <span className="font-medium">
                    Grade {venue.lastInspectionGrade}
                    {venue.lastInspectionScore != null &&
                      ` (Score: ${venue.lastInspectionScore})`}
                    {venue.lastInspectionDate && ` — ${venue.lastInspectionDate}`}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Save button at bottom */}
        <div className="flex gap-3">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white flex-1"
          >
            <Save className="w-4 h-4 mr-1.5" />
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        <Button
          variant="outline"
          onClick={() => navigate('/admin/venues')}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
