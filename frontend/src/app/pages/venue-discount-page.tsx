import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useVenue } from '@/app/contexts/venue-context';
import type { ManagedVenue, StudentDiscount, DiscountFormData } from '@/app/contexts/venue-context';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Badge } from '@/app/components/ui/badge';
import {
  MapPin,
  Phone,
  Mail,
  Users,
  Plus,
  Pencil,
  Trash2,
  CheckCircle,
  Globe,
} from 'lucide-react';

const GRADE_COLORS: Record<string, string> = {
  A: 'bg-green-100 text-green-800 border-green-300',
  B: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  C: 'bg-orange-100 text-orange-800 border-orange-300',
  N: 'bg-gray-100 text-gray-600 border-gray-300',
  P: 'bg-gray-100 text-gray-600 border-gray-300',
  Z: 'bg-red-100 text-red-800 border-red-300',
};

const EMPTY_FORM: DiscountFormData = {
  discountType: '',
  discountValue: '',
  description: '',
  requiresNyuId: true,
  isActive: true,
  validFrom: '',
  validUntil: '',
};

export function VenueDiscountPage() {
  const { venueId } = useParams<{ venueId: string }>();
  const navigate = useNavigate();
  const { fetchVenueDetail, fetchDiscounts, createDiscount, updateDiscount, deleteDiscount } = useVenue();

  const [venue, setVenue] = useState<ManagedVenue | null>(null);
  const [discounts, setDiscounts] = useState<StudentDiscount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<StudentDiscount | null>(null);
  const [form, setForm] = useState<DiscountFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    if (!venueId) return;
    const id = parseInt(venueId, 10);
    const load = async () => {
      try {
        const [venueData, discountData] = await Promise.all([
          fetchVenueDetail(id),
          fetchDiscounts(id),
        ]);
        setVenue(venueData);
        setDiscounts(discountData);
      } catch {
        setError('Could not load venue details.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [venueId, fetchVenueDetail, fetchDiscounts]);

  const openAddDialog = () => {
    setEditingDiscount(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setDialogOpen(true);
  };

  const openEditDialog = (discount: StudentDiscount) => {
    setEditingDiscount(discount);
    setForm({
      discountType: discount.discountType,
      discountValue: discount.discountValue,
      description: discount.description,
      requiresNyuId: discount.requiresNyuId,
      isActive: discount.isActive,
      validFrom: discount.validFrom ?? '',
      validUntil: discount.validUntil ?? '',
    });
    setFormError('');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!venueId) return;
    if (!form.discountType.trim() || !form.discountValue.trim()) {
      setFormError('Discount type and value are required.');
      return;
    }
    const id = parseInt(venueId, 10);
    setSaving(true);
    setFormError('');
    try {
      if (editingDiscount) {
        const updated = await updateDiscount(id, editingDiscount.id, form);
        setDiscounts((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      } else {
        const created = await createDiscount(id, form);
        setDiscounts((prev) => [created, ...prev]);
      }
      setDialogOpen(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (discountId: number) => {
    if (!venueId) return;
    const id = parseInt(venueId, 10);
    try {
      await deleteDiscount(id, discountId);
      setDiscounts((prev) => prev.filter((d) => d.id !== discountId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="rounded-full h-10 w-10 border-4 border-orange-500 border-t-transparent animate-spin mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Loading venue…</p>
        </div>
      </div>
    );
  }

  if (error || !venue) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-600">{error || 'Venue not found'}</p>
          <Button onClick={() => navigate('/venue/dashboard')}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  const gradeColor = GRADE_COLORS[venue.sanitationGrade] ?? GRADE_COLORS['N'];

  return (
    <div>
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Read-only Venue Info */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  {venue.name}
                  {venue.isVerified && (
                    <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-300 text-xs">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Verified
                    </Badge>
                  )}
                  {venue.claimStatus === 'pending' && (
                    <Badge variant="outline" className="text-xs text-amber-700 border-amber-300 bg-amber-50">
                      Pending verification
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {venue.cuisineType && `${venue.cuisineType} · `}{venue.priceRange}
                </CardDescription>
              </div>
              <Badge className={`${gradeColor} border font-bold text-base px-3 py-1 shrink-0`}>
                {venue.sanitationGrade || '–'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex items-start gap-2 text-muted-foreground">
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <p>{venue.streetAddress}</p>
                    {venue.neighborhood && <p>{venue.neighborhood}, {venue.borough}</p>}
                    {venue.zipcode && <p>{venue.zipcode}</p>}
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
                {venue.website && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Globe className="w-4 h-4 shrink-0" />
                    <a href={venue.website} target="_blank" rel="noopener noreferrer" className="truncate hover:underline">
                      {venue.website}
                    </a>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                {venue.seatingCapacity && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="w-4 h-4 shrink-0" />
                    <span>{venue.seatingCapacity} seats{venue.hasGroupSeating ? ' · Group seating' : ''}</span>
                  </div>
                )}
                {venue.lastInspectionDate && (
                  <p className="text-muted-foreground text-xs">
                    Last inspection: {new Date(venue.lastInspectionDate).toLocaleDateString()}
                    {venue.lastInspectionScore != null && ` · Score ${venue.lastInspectionScore}`}
                  </p>
                )}
                {venue.dietaryTags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {venue.dietaryTags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Discounts Management */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Student Discounts</h2>
              <p className="text-sm text-muted-foreground">Discounts available to NYU students</p>
            </div>
            <Button
              onClick={openAddDialog}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Discount
            </Button>
          </div>

          {discounts.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <p className="text-muted-foreground text-sm">No discounts yet. Add one to attract NYU students!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {discounts.map((discount) => (
                <Card key={discount.id}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">{discount.discountType || 'Discount'}</p>
                          <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs">
                            {discount.discountValue}
                          </Badge>
                          {!discount.isActive && (
                            <Badge variant="outline" className="text-xs text-muted-foreground">Inactive</Badge>
                          )}
                          {discount.requiresNyuId && (
                            <Badge variant="outline" className="text-xs">NYU ID required</Badge>
                          )}
                        </div>
                        {discount.description && (
                          <p className="text-sm text-muted-foreground">{discount.description}</p>
                        )}
                        {(discount.validFrom || discount.validUntil) && (
                          <p className="text-xs text-muted-foreground">
                            Valid:{' '}
                            {discount.validFrom ? new Date(discount.validFrom).toLocaleDateString() : '—'}
                            {' '}–{' '}
                            {discount.validUntil ? new Date(discount.validUntil).toLocaleDateString() : 'ongoing'}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(discount)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => setDeletingId(discount.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingDiscount ? 'Edit Discount' : 'Add Student Discount'}</DialogTitle>
            <DialogDescription>
              This discount will be visible to NYU students browsing venues.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="discountType">Discount Type</Label>
              <Input
                id="discountType"
                placeholder="e.g. Percentage Off, Free Item"
                value={form.discountType}
                onChange={(e) => setForm((f) => ({ ...f, discountType: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="discountValue">Discount Value</Label>
              <Input
                id="discountValue"
                placeholder="e.g. 15% off, Free dessert with NYU ID"
                value={form.discountValue}
                onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                placeholder="Additional details"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="validFrom">Valid From</Label>
                <Input
                  id="validFrom"
                  type="date"
                  value={form.validFrom}
                  onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="validUntil">Valid Until</Label>
                <Input
                  id="validUntil"
                  type="date"
                  value={form.validUntil}
                  onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.requiresNyuId}
                  onChange={(e) => setForm((f) => ({ ...f, requiresNyuId: e.target.checked }))}
                  className="w-4 h-4 accent-orange-600"
                />
                <span className="text-sm">Requires NYU ID</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="w-4 h-4 accent-orange-600"
                />
                <span className="text-sm">Active</span>
              </label>
            </div>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={saving}
              onClick={handleSave}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {saving ? 'Saving…' : editingDiscount ? 'Save Changes' : 'Add Discount'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deletingId !== null} onOpenChange={(open) => !open && setDeletingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Discount</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this discount? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deletingId !== null && handleDelete(deletingId)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
