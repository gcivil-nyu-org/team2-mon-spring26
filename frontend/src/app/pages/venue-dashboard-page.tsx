import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useVenue } from '@/app/contexts/venue-context';
import type { Restaurant } from '@/app/contexts/venue-context';
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
  LogOut,
  Store,
} from 'lucide-react';

export function VenueDashboardPage() {
  const { restaurants, currentManager, logoutVenueManager, unclaimVenue, updateDiscount } = useVenue();
  const navigate = useNavigate();

  // Remove dialog
  const [restaurantToRemove, setRestaurantToRemove] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  // Edit discount dialog
  const [editingRestaurant, setEditingRestaurant] = useState<Restaurant | null>(null);
  const [editDiscount, setEditDiscount] = useState(false);
  const [editDiscountDetails, setEditDiscountDetails] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const handleLogout = () => {
    logoutVenueManager();
    navigate('/venue/login');
  };

  const handleRemove = async (id: string) => {
    setRemoving(true);
    await unclaimVenue(id);
    setRemoving(false);
    setRestaurantToRemove(null);
  };

  const handleOpenEditDiscount = (restaurant: Restaurant) => {
    setEditingRestaurant(restaurant);
    setEditDiscount(restaurant.studentDiscount);
    setEditDiscountDetails(restaurant.discountDetails || '');
    setSaveError('');
  };

  const handleSaveDiscount = async () => {
    if (!editingRestaurant) return;
    setSaving(true);
    setSaveError('');
    const success = await updateDiscount(
      editingRestaurant.id,
      editDiscount,
      editDiscountDetails
    );
    setSaving(false);
    if (success) {
      setEditingRestaurant(null);
    } else {
      setSaveError('Failed to update discount. Please try again.');
    }
  };

  const getSanitationGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'bg-green-100 text-green-800 border-green-300';
      case 'B': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'C': return 'bg-orange-100 text-orange-800 border-orange-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-violet-700 rounded-xl flex items-center justify-center">
              <Store className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Venue Manager Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                {currentManager?.businessName || 'Manage your restaurant listings'}
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout} className="flex items-center gap-2">
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Restaurants</CardDescription>
              <CardTitle className="text-3xl">{restaurants.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Verified Listings</CardDescription>
              <CardTitle className="text-3xl">
                {restaurants.filter((r) => r.isVerified).length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Student Discounts</CardDescription>
              <CardTitle className="text-3xl">
                {restaurants.filter((r) => r.studentDiscount).length}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-semibold">Your Restaurants</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your claimed restaurant listings
            </p>
          </div>
          <Button
            onClick={() => navigate('/venue/add-restaurant')}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Restaurant
          </Button>
        </div>

        {restaurants.length === 0 ? (
          <Card className="p-12">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
                <UtensilsCrossed className="w-8 h-8 text-purple-600" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">No Restaurants Yet</h3>
                <p className="text-muted-foreground mt-2">
                  Search for your restaurant and claim it to get started
                </p>
              </div>
              <Button
                onClick={() => navigate('/venue/add-restaurant')}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Restaurant
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid gap-4">
            {restaurants.map((restaurant) => (
              <Card key={restaurant.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-xl">{restaurant.name}</CardTitle>
                        {restaurant.isVerified && (
                          <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-300">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Verified
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-base">
                        {restaurant.cuisine}
                        {restaurant.priceRange && ` • ${restaurant.priceRange}`}
                      </CardDescription>
                    </div>
                    {restaurant.sanitationGrade && (
                      <Badge className={`${getSanitationGradeColor(restaurant.sanitationGrade)} border px-3 py-1 text-base font-bold`}>
                        Grade {restaurant.sanitationGrade}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex items-start gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium">{restaurant.address}</p>
                          <p className="text-muted-foreground">
                            {restaurant.neighborhood && `${restaurant.neighborhood}, `}
                            {restaurant.borough}
                          </p>
                        </div>
                      </div>
                      {restaurant.phoneNumber && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <p>{restaurant.phoneNumber}</p>
                        </div>
                      )}
                      {restaurant.email && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <p className="truncate">{restaurant.email}</p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      {restaurant.seatingCapacity > 0 && (
                        <div className="flex items-center gap-2 text-sm">
                          <Users className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <p>
                            Capacity: {restaurant.seatingCapacity} seats
                            {restaurant.groupSeating && ' • Group seating available'}
                          </p>
                        </div>
                      )}
                      {restaurant.studentDiscount ? (
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                          <p className="text-sm font-medium text-purple-900">
                            Student Discount Active
                          </p>
                          {restaurant.discountDetails && (
                            <p className="text-xs text-purple-700 mt-1">
                              {restaurant.discountDetails}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No student discount</p>
                      )}
                      {restaurant.dietaryOptions.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {restaurant.dietaryOptions.map((option) => (
                            <Badge key={option} variant="outline" className="text-xs">
                              {option}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEditDiscount(restaurant)}
                    >
                      Edit Discount
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => setRestaurantToRemove(restaurant.id)}
                    >
                      Remove
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Edit Discount Dialog */}
      <Dialog
        open={!!editingRestaurant}
        onOpenChange={(open) => !open && setEditingRestaurant(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Student Discount</DialogTitle>
            <DialogDescription>
              {editingRestaurant?.name} — update or remove your student discount offer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Offer Student Discount?</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={editDiscount ? 'default' : 'outline'}
                  className={editDiscount ? 'bg-purple-600 hover:bg-purple-700 flex-1' : 'flex-1'}
                  onClick={() => setEditDiscount(true)}
                >
                  Yes
                </Button>
                <Button
                  type="button"
                  variant={!editDiscount ? 'default' : 'outline'}
                  className={!editDiscount ? 'bg-purple-600 hover:bg-purple-700 flex-1' : 'flex-1'}
                  onClick={() => setEditDiscount(false)}
                >
                  No
                </Button>
              </div>
            </div>
            {editDiscount && (
              <div className="space-y-2">
                <Label htmlFor="editDiscountDetails">Discount Details</Label>
                <Input
                  id="editDiscountDetails"
                  placeholder="e.g., 15% off with NYU ID"
                  value={editDiscountDetails}
                  onChange={(e) => setEditDiscountDetails(e.target.value)}
                />
              </div>
            )}
            {saveError && <p className="text-sm text-red-500">{saveError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRestaurant(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveDiscount}
              disabled={saving}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Confirmation Dialog */}
      <Dialog
        open={!!restaurantToRemove}
        onOpenChange={(open) => !open && setRestaurantToRemove(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Restaurant</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this restaurant from your profile?
              It will still exist in the database and can be claimed again later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestaurantToRemove(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={removing}
              onClick={() => handleRemove(restaurantToRemove!)}
            >
              {removing ? 'Removing...' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
