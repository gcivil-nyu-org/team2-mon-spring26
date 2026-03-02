import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useVenue } from '@/app/contexts/venue-context';
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
  LogOut,
  Store,
} from 'lucide-react';

export function VenueDashboardPage() {
  const { restaurants, currentManager, logoutVenueManager, deleteRestaurant } = useVenue();
  const navigate = useNavigate();
  const [restaurantToDelete, setRestaurantToDelete] = useState<string | null>(null);

  const handleLogout = () => {
    logoutVenueManager();
    navigate('/venue/login');
  };

  const handleDelete = (id: string) => {
    deleteRestaurant(id);
    setRestaurantToDelete(null);
  };

  const getSanitationGradeColor = (grade: string) => {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-violet-700 rounded-xl flex items-center justify-center">
              <Store className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Venue Manager Dashboard</h1>
              <p className="text-sm text-muted-foreground">Manage your restaurant listings</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={handleLogout}
            className="flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Stats Overview */}
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
                {restaurants.filter(r => r.isVerified).length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Student Discounts</CardDescription>
              <CardTitle className="text-3xl">
                {restaurants.filter(r => r.studentDiscount).length}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Add Restaurant Button */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-semibold">Your Restaurants</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your verified restaurant listings
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

        {/* Restaurant List */}
        {restaurants.length === 0 ? (
          <Card className="p-12">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
                <UtensilsCrossed className="w-8 h-8 text-purple-600" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">No Restaurants Yet</h3>
                <p className="text-muted-foreground mt-2">
                  Add your first restaurant to get started
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
                        {restaurant.cuisine} • {restaurant.priceRange}
                      </CardDescription>
                    </div>
                    <Badge className={`${getSanitationGradeColor(restaurant.sanitationGrade)} border px-3 py-1 text-base font-bold`}>
                      Grade {restaurant.sanitationGrade}
                    </Badge>
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
                            {restaurant.neighborhood}, {restaurant.borough}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <p>{restaurant.phoneNumber}</p>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <p className="truncate">{restaurant.email}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <p>
                          Capacity: {restaurant.seatingCapacity} seats
                          {restaurant.groupSeating && ' • Group seating available'}
                        </p>
                      </div>
                      {restaurant.studentDiscount && (
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
                      )}
                      <div className="flex flex-wrap gap-1">
                        {restaurant.dietaryOptions.map((option) => (
                          <Badge
                            key={option}
                            variant="outline"
                            className="text-xs"
                          >
                            {option}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      Last inspection: {new Date(restaurant.lastInspection).toLocaleDateString()}
                    </p>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => navigate(`/venue/edit-restaurant/${restaurant.id}`)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => setRestaurantToDelete(restaurant.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Delete Restaurant Confirmation Dialog */}
      <Dialog open={!!restaurantToDelete} onOpenChange={(open) => !open && setRestaurantToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this restaurant? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRestaurantToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleDelete(restaurantToDelete!)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}