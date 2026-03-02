import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useVenue } from '@/app/contexts/venue-context';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { ArrowLeft, Store } from 'lucide-react';
import { Badge } from '@/app/components/ui/badge';

const boroughs = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'];
const cuisineTypes = [
  'American',
  'Italian',
  'Chinese',
  'Japanese',
  'Mexican',
  'Thai',
  'Indian',
  'French',
  'Mediterranean',
  'Korean',
  'Vietnamese',
  'Greek',
  'Spanish',
  'Middle Eastern',
  'Asian Fusion',
  'Latin American',
  'Caribbean',
];

const dietaryOptionsList = [
  'Vegetarian',
  'Vegan',
  'Vegan Options',
  'Gluten-Free',
  'Halal',
  'Kosher',
  'Dairy-Free',
];

export function AddRestaurantPage() {
  const navigate = useNavigate();
  const { addRestaurant } = useVenue();

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [borough, setBorough] = useState('Manhattan');
  const [neighborhood, setNeighborhood] = useState('');
  const [cuisine, setCuisine] = useState('American');
  const [priceRange, setPriceRange] = useState<'$' | '$$' | '$$$' | '$$$$'>('$$');
  const [sanitationGrade, setSanitationGrade] = useState<'A' | 'B' | 'C' | 'Pending'>('A');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [seatingCapacity, setSeatingCapacity] = useState('50');
  const [groupSeating, setGroupSeating] = useState(true);
  const [studentDiscount, setStudentDiscount] = useState(false);
  const [discountDetails, setDiscountDetails] = useState('');
  const [selectedDietaryOptions, setSelectedDietaryOptions] = useState<string[]>([]);

  const toggleDietaryOption = (option: string) => {
    if (selectedDietaryOptions.includes(option)) {
      setSelectedDietaryOptions(selectedDietaryOptions.filter(o => o !== option));
    } else {
      setSelectedDietaryOptions([...selectedDietaryOptions, option]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    addRestaurant({
      name,
      address,
      borough,
      neighborhood,
      cuisine,
      priceRange,
      sanitationGrade,
      lastInspection: new Date().toISOString().split('T')[0],
      studentDiscount,
      discountDetails: studentDiscount ? discountDetails : undefined,
      seatingCapacity: parseInt(seatingCapacity),
      groupSeating,
      dietaryOptions: selectedDietaryOptions,
      phoneNumber,
      email,
    });

    navigate('/venue/dashboard');
  };

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
              Add a new verified restaurant listing
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <Card className="border-0 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-purple-500/90 to-pink-500/90 text-white rounded-t-xl pb-6">
            <CardTitle className="text-xl">Restaurant Details</CardTitle>
            <CardDescription className="text-purple-50 pt-1">
              Fill in the information about your restaurant
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-8 pb-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2">Basic Information</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-base">Restaurant Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., The Purple Bistro"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cuisine">Cuisine Type</Label>
                    <Select value={cuisine} onValueChange={setCuisine}>
                      <SelectTrigger id="cuisine" className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {cuisineTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="priceRange">Price Range</Label>
                    <Select value={priceRange} onValueChange={(val) => setPriceRange(val as any)}>
                      <SelectTrigger id="priceRange" className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="$">$ - Budget friendly</SelectItem>
                        <SelectItem value="$$">$$ - Moderate</SelectItem>
                        <SelectItem value="$$$">$$$ - Upscale</SelectItem>
                        <SelectItem value="$$$$">$$$$ - Fine dining</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Location */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2">Location</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="address" className="text-base">Street Address</Label>
                  <Input
                    id="address"
                    placeholder="e.g., 123 MacDougal St, New York, NY 10012"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="borough">Borough</Label>
                    <Select value={borough} onValueChange={setBorough}>
                      <SelectTrigger id="borough" className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {boroughs.map((b) => (
                          <SelectItem key={b} value={b}>
                            {b}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="neighborhood">Neighborhood</Label>
                    <Input
                      id="neighborhood"
                      placeholder="e.g., Greenwich Village"
                      value={neighborhood}
                      onChange={(e) => setNeighborhood(e.target.value)}
                      required
                      className="h-11"
                    />
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2">Contact Information</h3>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="(212) 555-0123"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      required
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="contact@restaurant.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-11"
                    />
                  </div>
                </div>
              </div>

              {/* Restaurant Details */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2">Restaurant Details</h3>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sanitation">Sanitation Grade</Label>
                    <Select value={sanitationGrade} onValueChange={(val) => setSanitationGrade(val as any)}>
                      <SelectTrigger id="sanitation" className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A">Grade A</SelectItem>
                        <SelectItem value="B">Grade B</SelectItem>
                        <SelectItem value="C">Grade C</SelectItem>
                        <SelectItem value="Pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="capacity">Seating Capacity</Label>
                    <Input
                      id="capacity"
                      type="number"
                      min="1"
                      placeholder="50"
                      value={seatingCapacity}
                      onChange={(e) => setSeatingCapacity(e.target.value)}
                      required
                      className="h-11"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Group Seating</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={groupSeating ? "default" : "outline"}
                      className={groupSeating ? "bg-purple-600 hover:bg-purple-700 flex-1" : "flex-1"}
                      onClick={() => setGroupSeating(true)}
                    >
                      Yes
                    </Button>
                    <Button
                      type="button"
                      variant={!groupSeating ? "default" : "outline"}
                      className={!groupSeating ? "bg-purple-600 hover:bg-purple-700 flex-1" : "flex-1"}
                      onClick={() => setGroupSeating(false)}
                    >
                      No
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Dietary Options</Label>
                  <div className="flex flex-wrap gap-2">
                    {dietaryOptionsList.map((option) => (
                      <Badge
                        key={option}
                        variant={selectedDietaryOptions.includes(option) ? "default" : "outline"}
                        className={`cursor-pointer ${
                          selectedDietaryOptions.includes(option)
                            ? "bg-purple-600 hover:bg-purple-700"
                            : "hover:bg-purple-50"
                        }`}
                        onClick={() => toggleDietaryOption(option)}
                      >
                        {option}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {/* Student Discount */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2">Student Benefits</h3>
                
                <div className="space-y-3">
                  <Label>Offer Student Discount?</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={studentDiscount ? "default" : "outline"}
                      className={studentDiscount ? "bg-purple-600 hover:bg-purple-700 flex-1" : "flex-1"}
                      onClick={() => setStudentDiscount(true)}
                    >
                      Yes
                    </Button>
                    <Button
                      type="button"
                      variant={!studentDiscount ? "default" : "outline"}
                      className={!studentDiscount ? "bg-purple-600 hover:bg-purple-700 flex-1" : "flex-1"}
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
                >
                  Add Restaurant
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
