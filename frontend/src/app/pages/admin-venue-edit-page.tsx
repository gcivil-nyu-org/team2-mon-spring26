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
import { ArrowLeft, Save, UserX } from 'lucide-react';
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

  // Build combined options lists — merge DB options, hardcoded prefs, AND the
  // venue's current tags so every possible option is always visible.
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
      <div className="min-h-screen bg-blue-50/40 flex items-center justify-center">
        <div className="text-center">
          <div className="rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent animate-spin mx-auto mb-3" />
          <p className="text-blue-600">Loading venue…</p>
        </div>
      </div>
    );
  }

  if (!venue) {
    return (
      <div className="min-h-screen bg-blue-50/40 flex items-center justify-center">
        <p className="text-blue-600">Venue not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-50/40">
      {/* Header */}
      <div className="bg-white border-b border-blue-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/admin/venues')}
              className="text-blue-700 hover:bg-blue-100"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-blue-900">{venue.name}</h1>
              <p className="text-xs text-blue-500">ID #{venue.id}</p>
            </div>
          </div>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Save className="w-4 h-4 mr-1.5" />
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">
        {/* Basic Info */}
        <Card className="border-blue-100">
          <CardHeader>
            <CardTitle className="text-blue-900">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div>
              <Label className="text-blue-800">Venue Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border-blue-200 focus-visible:ring-blue-400"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-blue-800">Cuisine Type</Label>
                <Select value={cuisineType} onValueChange={setCuisineType}>
                  <SelectTrigger className="border-blue-200">
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
                <Label className="text-blue-800">Price Range</Label>
                <Select value={priceRange} onValueChange={setPriceRange}>
                  <SelectTrigger className="border-blue-200">
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
                <Label className="text-blue-800">Sanitation Grade</Label>
                <Select value={sanitationGrade} onValueChange={setSanitationGrade}>
                  <SelectTrigger className="border-blue-200">
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
                <Label className="text-blue-800">Seating Capacity</Label>
                <Input
                  type="number"
                  value={seatingCapacity}
                  onChange={(e) => setSeatingCapacity(e.target.value)}
                  className="border-blue-200 focus-visible:ring-blue-400"
                  placeholder="e.g. 50"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Location */}
        <Card className="border-blue-100">
          <CardHeader>
            <CardTitle className="text-blue-900">Location</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div>
              <Label className="text-blue-800">Street Address</Label>
              <Input
                value={streetAddress}
                onChange={(e) => setStreetAddress(e.target.value)}
                className="border-blue-200 focus-visible:ring-blue-400"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-blue-800">Borough</Label>
                <Select value={borough} onValueChange={setBorough}>
                  <SelectTrigger className="border-blue-200">
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
                <Label className="text-blue-800">Neighborhood</Label>
                <Input
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  className="border-blue-200 focus-visible:ring-blue-400"
                />
              </div>
              <div>
                <Label className="text-blue-800">Zipcode</Label>
                <Input
                  value={zipcode}
                  onChange={(e) => setZipcode(e.target.value)}
                  className="border-blue-200 focus-visible:ring-blue-400"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card className="border-blue-100">
          <CardHeader>
            <CardTitle className="text-blue-900">Contact</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-blue-800">Phone</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="border-blue-200 focus-visible:ring-blue-400"
                />
              </div>
              <div>
                <Label className="text-blue-800">Email</Label>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="border-blue-200 focus-visible:ring-blue-400"
                />
              </div>
              <div>
                <Label className="text-blue-800">Website</Label>
                <Input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="border-blue-200 focus-visible:ring-blue-400"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dietary Tags */}
        <Card className="border-blue-100">
          <CardHeader>
            <CardTitle className="text-blue-900">Dietary Options</CardTitle>
            <CardDescription className="text-blue-500">
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
                      ? 'bg-blue-600 hover:bg-blue-700 text-white border-transparent shadow-sm'
                      : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleTag(dietaryTags, setDietaryTags, tag)}
                    aria-pressed={dietaryTags.includes(tag)}
                    className="cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 rounded-md"
                  >
                    {tag}
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Food Type Tags */}
        <Card className="border-blue-100">
          <CardHeader>
            <CardTitle className="text-blue-900">Food Types</CardTitle>
            <CardDescription className="text-blue-500">
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
                      ? 'bg-blue-600 hover:bg-blue-700 text-white border-transparent shadow-sm'
                      : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleTag(foodTypeTags, setFoodTypeTags, tag)}
                    aria-pressed={foodTypeTags.includes(tag)}
                    className="cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 rounded-md"
                  >
                    {tag}
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Service Options */}
        <Card className="border-blue-100">
          <CardHeader>
            <CardTitle className="text-blue-900">Service & Status</CardTitle>
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
                    className="data-[state=checked]:bg-blue-600"
                  />
                  <Label className="text-blue-800 text-sm">{label}</Label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Venue Manager */}
        <Card className="border-blue-100">
          <CardHeader>
            <CardTitle className="text-blue-900">Venue Manager</CardTitle>
            <CardDescription className="text-blue-500">
              {venue.manager
                ? 'This venue is currently managed by a venue manager.'
                : 'No venue manager is assigned. A manager can claim this venue.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {venue.manager ? (
              <div className="space-y-4">
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                  <div className="grid gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-blue-600">Name</span>
                      <span className="font-medium text-blue-900">
                        {venue.manager.userName || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-600">Business</span>
                      <span className="font-medium text-blue-900">
                        {venue.manager.businessName || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-600">Email</span>
                      <span className="font-medium text-blue-900">
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
                <Badge
                  variant="outline"
                  className="bg-blue-50 text-blue-600 border-blue-200"
                >
                  Unclaimed
                </Badge>
                <p className="text-xs text-blue-400 mt-2">
                  A venue manager can claim this venue from their dashboard.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Read-only Google / Inspection info */}
        {(venue.googleRating || venue.lastInspectionGrade) && (
          <Card className="border-blue-100">
            <CardHeader>
              <CardTitle className="text-blue-900">Inspection & Ratings</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              {venue.googleRating && (
                <div className="flex justify-between">
                  <span className="text-blue-600">Google Rating</span>
                  <span className="font-medium text-blue-900">
                    {venue.googleRating}★ ({venue.googleReviewCount} reviews)
                  </span>
                </div>
              )}
              {venue.lastInspectionGrade && (
                <div className="flex justify-between">
                  <span className="text-blue-600">Last Inspection</span>
                  <span className="font-medium text-blue-900">
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

        {/* Save button at bottom too */}
        <div className="flex gap-3">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white flex-1"
          >
            <Save className="w-4 h-4 mr-1.5" />
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/admin/venues')}
            className="border-blue-200 text-blue-700 hover:bg-blue-50"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
