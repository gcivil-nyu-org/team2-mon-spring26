import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner'; // ← Add this import
import { useVenue } from '@/app/contexts/venue-context';
import type {
  ManagedVenue,
  StudentDiscount,
  DiscountFormData,
  VenueUpdateData,
} from '@/app/contexts/venue-context';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Checkbox } from '@/app/components/ui/checkbox';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Badge } from '@/app/components/ui/badge';
import { Plus, Trash2, Pencil, CheckCircle } from 'lucide-react';
import preferenceOptions from '@/app/data/preference-options.json';

const BOROUGHS = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'];
const PRICE_RANGES = ['$', '$$', '$$$', '$$$$'];
const SANITATION_GRADES = ['A', 'B', 'C', 'N', 'Z', 'P'];
const DIETARY_OPTIONS = ['Vegan', 'Vegetarian', 'Kosher'] as const;

const EMPTY_DISCOUNT_FORM: DiscountFormData = {
  discountType: '',
  discountValue: '',
  description: '',
  requiresNyuId: true,
  isActive: true,
  validFrom: '',
  validUntil: '',
};

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

export function VenueDiscountPage() {
  const { venueId } = useParams<{ venueId: string }>();
  const navigate = useNavigate();
  const {
    fetchVenueDetail,
    fetchDiscounts,
    createDiscount,
    updateDiscount,
    deleteDiscount,
    updateVenue,
  } = useVenue();

  const [venue, setVenue] = useState<ManagedVenue | null>(null);
  const [discounts, setDiscounts] = useState<StudentDiscount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
  const [hasDineIn, setHasDineIn] = useState(false);
  const [isReservable, setIsReservable] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [hours, setHours] = useState('');
  const [dietaryTags, setDietaryTags] = useState<string[]>([]);
  const [foodTypeTags, setFoodTypeTags] = useState<string[]>([]);

  const [savingVenue, setSavingVenue] = useState(false);
  const [venueSaveError, setVenueSaveError] = useState('');

  const [discountDialogOpen, setDiscountDialogOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<StudentDiscount | null>(null);
  const [discountForm, setDiscountForm] =
    useState<DiscountFormData>(EMPTY_DISCOUNT_FORM);
  const [discountSaving, setDiscountSaving] = useState(false);
  const [discountError, setDiscountError] = useState('');

  useEffect(() => {
    if (!venueId) return;
    const id = Number(venueId);

    const load = async () => {
      setLoading(true);
      try {
        const [venueData, discountData] = await Promise.all([
          fetchVenueDetail(id),
          fetchDiscounts(id),
        ]);
        setVenue(venueData);
        setDiscounts(discountData);
      } catch (err) {
        console.error(err);
        setError('Unable to load venue details.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [venueId, fetchVenueDetail, fetchDiscounts]);

  useEffect(() => {
    if (!venue) return;
    setName(venue.name);
    setStreetAddress(venue.streetAddress ?? '');
    setBorough(venue.borough ?? '');
    setNeighborhood(venue.neighborhood ?? '');
    setZipcode(venue.zipcode ?? '');
    setPhone(venue.phone ?? '');
    setEmail(venue.email ?? '');
    setWebsite(venue.website ?? '');
    setCuisineType(venue.cuisineType ?? '');
    setPriceRange(venue.priceRange ?? '');
    setSanitationGrade(venue.sanitationGrade ?? '');
    setSeatingCapacity(
      venue.seatingCapacity != null ? String(venue.seatingCapacity) : ''
    );
    setHasGroupSeating(venue.hasGroupSeating ?? false);
    setHasTakeout(venue.hasTakeout ?? false);
    setHasDelivery(venue.hasDelivery ?? false);
    setHasDineIn(venue.hasDineIn ?? false);
    setIsReservable(venue.isReservable ?? false);
    setIsActive(venue.isActive ?? false);
    setHours(venue.hours ?? '');
    setDietaryTags(venue.dietaryTags ?? []);
    setFoodTypeTags(venue.foodTypeTags ?? []);
  }, [venue]);

  const canEditVenue = venue?.isVerified || venue?.claimStatus === 'approved';
  const canEditDiscounts = canEditVenue;

  const allCuisines = uniqueStrings([
    ...(preferenceOptions.cuisines as string[]),
    venue?.cuisineType ?? '',
  ]);
  const allDietary = uniqueStrings([
    ...(preferenceOptions.dietary as string[]),
    ...(venue?.dietaryTags ?? []),
  ]);
  const allFoodTypes = uniqueStrings([
    ...(preferenceOptions.foodTypes as string[]),
    ...(venue?.foodTypeTags ?? []),
  ]);

  const toggleTag = (tag: string, values: string[], setter: (v: string[]) => void) => {
    setter(
      values.includes(tag) ? values.filter((item) => item !== tag) : [...values, tag]
    );
  };

  const handleSaveVenue = async () => {
    if (!venueId || !venue) return;
    setSavingVenue(true);
    setVenueSaveError('');

    try {
      const updated = await updateVenue(Number(venueId), {
        // Explicitly exclude: name, sanitationGrade (admin-only)
        streetAddress,
        borough,
        neighborhood,
        zipcode,
        phone,
        email,
        website,
        cuisineType,
        priceRange,
        seatingCapacity: seatingCapacity ? Number(seatingCapacity) : null,
        hasGroupSeating,
        hasTakeout,
        hasDelivery,
        hasDineIn,
        isReservable,
        isActive,
        hours: hours || undefined, // add hours field
        dietaryTags,
        foodTypeTags,
      } as VenueUpdateData);

      setVenue(updated);
      toast.success('Venue details saved successfully.');
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : 'Failed to save venue details.';
      setVenueSaveError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setSavingVenue(false);
    }
  };

  const openAddDiscount = () => {
    setEditingDiscount(null);
    setDiscountForm(EMPTY_DISCOUNT_FORM);
    setDiscountError('');
    setDiscountDialogOpen(true);
  };

  const openEditDiscount = (discount: StudentDiscount) => {
    setEditingDiscount(discount);
    setDiscountForm({
      discountType: discount.discountType,
      discountValue: discount.discountValue,
      description: discount.description,
      requiresNyuId: discount.requiresNyuId,
      isActive: discount.isActive,
      validFrom: discount.validFrom ?? '',
      validUntil: discount.validUntil ?? '',
    });
    setDiscountError('');
    setDiscountDialogOpen(true);
  };

  const handleSaveDiscount = async () => {
    if (!venueId) return;
    if (!discountForm.discountType.trim() || !discountForm.discountValue.trim()) {
      setDiscountError('Discount type and value are required.');
      return;
    }

    setDiscountSaving(true);
    setDiscountError('');

    try {
      const id = Number(venueId);

      if (editingDiscount) {
        const updated = await updateDiscount(id, editingDiscount.id, discountForm);
        setDiscounts((prev) =>
          prev.map((item) => (item.id === updated.id ? updated : item))
        );
      } else {
        const created = await createDiscount(id, discountForm);
        setDiscounts((prev) => [created, ...prev]);
      }

      setDiscountDialogOpen(false);
    } catch (err: unknown) {
      setDiscountError(err instanceof Error ? err.message : 'Failed to save discount.');
    } finally {
      setDiscountSaving(false);
    }
  };

  const handleDeleteDiscount = async (discountId: number) => {
    if (!venueId) return;
    try {
      await deleteDiscount(Number(venueId), discountId);
      setDiscounts((prev) => prev.filter((item) => item.id !== discountId));
    } catch (err: unknown) {
      setDiscountError(
        err instanceof Error
          ? err instanceof Error
            ? err.message
            : 'Failed to delete discount.'
          : 'Failed to delete discount.'
      );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="h-10 w-10 rounded-full border-4 border-orange-500 border-t-transparent animate-spin mx-auto mb-3" />
          <p className="text-muted-foreground">Loading venue…</p>
        </div>
      </div>
    );
  }

  if (error || !venue) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 text-center">
        <p className="text-red-600">{error || 'Venue not found.'}</p>
        <Button className="mt-4" onClick={() => navigate('/venue/dashboard')}>
          Back to dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{venue.name}</h1>
          <p className="text-sm text-muted-foreground">
            {venue.cuisineType} · {venue.priceRange}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {venue.isVerified && (
            <Badge className="bg-green-100 text-green-700 border-green-300 text-xs">
              <CheckCircle className="w-3 h-3 mr-1" />
              Verified
            </Badge>
          )}
          <Badge className="text-xs">
            {venue.claimStatus === 'approved' ? 'Approved' : 'Pending'}
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Venue details</CardTitle>
          <CardDescription>
            Edit venue details for this approved venue. Name and sanitation grade are
            read-only for venue managers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4">
            <div>
              <Label>Venue Name</Label>
              <Input value={name} disabled />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Cuisine Type</Label>
                <Select value={cuisineType} onValueChange={setCuisineType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select cuisine" />
                  </SelectTrigger>
                  <SelectContent>
                    {allCuisines.map((cuisine) => (
                      <SelectItem key={cuisine} value={cuisine}>
                        {cuisine}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Price Range</Label>
                <Select value={priceRange} onValueChange={setPriceRange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select price range" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRICE_RANGES.map((range) => (
                      <SelectItem key={range} value={range}>
                        {range}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Sanitation Grade</Label>
                <Select
                  value={sanitationGrade}
                  onValueChange={setSanitationGrade}
                  disabled
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Disabled" />
                  </SelectTrigger>
                  <SelectContent>
                    {SANITATION_GRADES.map((grade) => (
                      <SelectItem key={grade} value={grade}>
                        {grade}
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
                  onChange={(event) => setSeatingCapacity(event.target.value)}
                  placeholder="e.g. 50"
                  disabled={!canEditVenue}
                />
              </div>
            </div>
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle>Location</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div>
                  <Label>Street Address</Label>
                  <Input
                    value={streetAddress}
                    onChange={(event) => setStreetAddress(event.target.value)}
                    disabled={!canEditVenue}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Borough</Label>
                    <Select
                      value={borough}
                      onValueChange={setBorough}
                      disabled={!canEditVenue}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select borough" />
                      </SelectTrigger>
                      <SelectContent>
                        {BOROUGHS.map((value) => (
                          <SelectItem key={value} value={value}>
                            {value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Neighborhood</Label>
                    <Input
                      value={neighborhood}
                      onChange={(event) => setNeighborhood(event.target.value)}
                      disabled={!canEditVenue}
                    />
                  </div>
                  <div>
                    <Label>Zipcode</Label>
                    <Input
                      value={zipcode}
                      onChange={(event) => setZipcode(event.target.value)}
                      disabled={!canEditVenue}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle>Contact</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Phone</Label>
                    <Input
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      disabled={!canEditVenue}
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      disabled={!canEditVenue}
                    />
                  </div>
                  <div>
                    <Label>Website</Label>
                    <Input
                      value={website}
                      onChange={(event) => setWebsite(event.target.value)}
                      disabled={!canEditVenue}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Dietary Options</CardTitle>
                  <CardDescription>
                    Select dietary tags offered by the venue
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {allDietary.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className={`rounded-full border px-3 py-1 text-sm ${
                          dietaryTags.includes(tag)
                            ? 'bg-orange-600 text-white border-orange-600'
                            : 'bg-background text-muted-foreground border-border'
                        }`}
                        onClick={() => toggleTag(tag, dietaryTags, setDietaryTags)}
                        disabled={!canEditVenue}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Food Types</CardTitle>
                  <CardDescription>
                    Select food type tags offered by the venue
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {allFoodTypes.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className={`rounded-full border px-3 py-1 text-sm ${
                          foodTypeTags.includes(tag)
                            ? 'bg-orange-600 text-white border-orange-600'
                            : 'bg-background text-muted-foreground border-border'
                        }`}
                        onClick={() => toggleTag(tag, foodTypeTags, setFoodTypeTags)}
                        disabled={!canEditVenue}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle>Service & Status</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Hours</Label>
                    <Input
                      value={hours}
                      onChange={(event) => setHours(event.target.value)}
                      disabled={!canEditVenue}
                    />
                  </div>
                  <div>
                    <Label>Reserve status</Label>
                    <Select
                      value={isReservable ? 'yes' : 'no'}
                      onValueChange={(value) => setIsReservable(value === 'yes')}
                      disabled={!canEditVenue}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <label className="inline-flex items-center gap-2">
                    <Checkbox
                      checked={hasGroupSeating}
                      onCheckedChange={(checked) =>
                        setHasGroupSeating(Boolean(checked))
                      }
                      disabled={!canEditVenue}
                    />
                    <span className="text-sm">Group seating</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <Checkbox
                      checked={hasTakeout}
                      onCheckedChange={(checked) => setHasTakeout(Boolean(checked))}
                      disabled={!canEditVenue}
                    />
                    <span className="text-sm">Takeout</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <Checkbox
                      checked={hasDelivery}
                      onCheckedChange={(checked) => setHasDelivery(Boolean(checked))}
                      disabled={!canEditVenue}
                    />
                    <span className="text-sm">Delivery</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <Checkbox
                      checked={hasDineIn}
                      onCheckedChange={(checked) => setHasDineIn(Boolean(checked))}
                      disabled={!canEditVenue}
                    />
                    <span className="text-sm">Dine-in</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <Checkbox
                      checked={isActive}
                      onCheckedChange={(checked) => setIsActive(Boolean(checked))}
                      disabled={!canEditVenue}
                    />
                    <span className="text-sm">Active</span>
                  </label>
                </div>
              </CardContent>
            </Card>
          </div>

          {venueSaveError && <p className="text-sm text-red-600">{venueSaveError}</p>}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
            <Button
              onClick={handleSaveVenue}
              disabled={!canEditVenue || savingVenue}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {savingVenue ? 'Saving…' : 'Save Venue Details'}
            </Button>
            <Button variant="outline" onClick={() => navigate('/venue/dashboard')}>
              Back to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>

      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Student Discounts</h2>
            <p className="text-sm text-muted-foreground">
              Discounts visible to NYU students browsing venues.
            </p>
          </div>
          <Button
            onClick={openAddDiscount}
            disabled={!canEditDiscounts}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Student Discount
          </Button>
        </div>

        {discounts.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No discounts have been added yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {discounts.map((discount) => (
              <Card key={discount.id}>
                <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-6">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{discount.discountType}</p>
                      <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs">
                        {discount.discountValue}
                      </Badge>
                      {!discount.isActive && (
                        <Badge variant="outline" className="text-xs">
                          Inactive
                        </Badge>
                      )}
                      {discount.requiresNyuId && (
                        <Badge variant="outline" className="text-xs">
                          NYU ID required
                        </Badge>
                      )}
                    </div>
                    {discount.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {discount.description}
                      </p>
                    )}
                    {(discount.validFrom || discount.validUntil) && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Valid{' '}
                        {discount.validFrom
                          ? new Date(discount.validFrom).toLocaleDateString()
                          : 'now'}{' '}
                        –{' '}
                        {discount.validUntil
                          ? new Date(discount.validUntil).toLocaleDateString()
                          : 'ongoing'}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDiscount(discount)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteDiscount(discount.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {discountError && <p className="text-sm text-red-600 mt-2">{discountError}</p>}
      </div>

      <Dialog open={discountDialogOpen} onOpenChange={setDiscountDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingDiscount ? 'Edit Discount' : 'Add Student Discount'}
            </DialogTitle>
            <DialogDescription>
              This discount will be visible to NYU students browsing venues.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="discountType">Discount Type</Label>
              <Input
                id="discountType"
                placeholder="e.g. Percentage Off, Free Item"
                value={discountForm.discountType}
                onChange={(event) =>
                  setDiscountForm((form) => ({
                    ...form,
                    discountType: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="discountValue">Discount Value</Label>
              <Input
                id="discountValue"
                placeholder="e.g. 15% off, Free dessert with NYU ID"
                value={discountForm.discountValue}
                onChange={(event) =>
                  setDiscountForm((form) => ({
                    ...form,
                    discountValue: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="discountDescription">Additional details</Label>
              <Input
                id="discountDescription"
                placeholder="Optional description"
                value={discountForm.description}
                onChange={(event) =>
                  setDiscountForm((form) => ({
                    ...form,
                    description: event.target.value,
                  }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="validFrom">Valid from</Label>
                <Input
                  id="validFrom"
                  type="date"
                  value={discountForm.validFrom}
                  onChange={(event) =>
                    setDiscountForm((form) => ({
                      ...form,
                      validFrom: event.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="validUntil">Valid until</Label>
                <Input
                  id="validUntil"
                  type="date"
                  value={discountForm.validUntil}
                  onChange={(event) =>
                    setDiscountForm((form) => ({
                      ...form,
                      validUntil: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <label className="inline-flex items-center gap-2">
                <Checkbox
                  checked={discountForm.requiresNyuId}
                  onCheckedChange={(checked) =>
                    setDiscountForm((form) => ({
                      ...form,
                      requiresNyuId: Boolean(checked),
                    }))
                  }
                />
                <span className="text-sm">Requires NYU ID</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <Checkbox
                  checked={discountForm.isActive}
                  onCheckedChange={(checked) =>
                    setDiscountForm((form) => ({
                      ...form,
                      isActive: Boolean(checked),
                    }))
                  }
                />
                <span className="text-sm">Active</span>
              </label>
            </div>
            {discountError && <p className="text-sm text-red-600">{discountError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscountDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveDiscount}
              disabled={discountSaving}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {discountSaving
                ? 'Saving…'
                : editingDiscount
                  ? 'Save Changes'
                  : 'Add Discount'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
