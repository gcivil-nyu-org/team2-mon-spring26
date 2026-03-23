import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/app/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Badge } from '@/app/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { UtensilsCrossed } from 'lucide-react';
import preferenceOptions from '@/app/data/preference-options.json';
import { formatSanitationGradeLabel } from '@/app/utils/sanitation-grade';
import { useApp } from '@/app/contexts/app-context';

const dietaryCatalog: string[] = preferenceOptions.dietary ?? [];
const cuisineCatalog: string[] = preferenceOptions.cuisines ?? [];
const foodTypeCatalog: string[] = preferenceOptions.foodTypes ?? [];
const sanitationCatalog: string[] = preferenceOptions.minimumSanitationGrades ?? [];

export function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useApp();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [selectedDietary, setSelectedDietary] = useState<string[]>([]);
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);
  const [selectedFoodTypes, setSelectedFoodTypes] = useState<string[]>([]);
  const [step, setStep] = useState<'account' | 'preferences'>('account');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [minimumSanitationGrade, setMinimumSanitationGrade] = useState<string>('A');

  const toggleDietary = (option: string) => {
    setSelectedDietary((prev) =>
      prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]
    );
  };

  const toggleCuisine = (option: string) => {
    setSelectedCuisines((prev) =>
      prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]
    );
  };

  const toggleFoodType = (option: string) => {
    setSelectedFoodTypes((prev) =>
      prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]
    );
  };

  const validateAccountInfo = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!formData.email.includes('@')) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAccountNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateAccountInfo()) {
      setStep('preferences');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await register({
        first_name: formData.name.split(' ')[0] || '',
        last_name: formData.name.split(' ').slice(1).join(' ') || '',
        email: formData.email,
        password: formData.password,
        preferences: {
          cuisines: selectedCuisines,
          dietary: selectedDietary,
          foodTypes: selectedFoodTypes,
          minimum_sanitation_grade: minimumSanitationGrade,
        },
      });
      navigate('/home');
    } catch (err: unknown) {
      setErrors({ form: err instanceof Error ? err.message : 'Registration failed' });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 via-purple-400 to-violet-300 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        ></div>
      </div>

      <Card className="w-full max-w-md bg-gray-50/90 backdrop-blur-sm shadow-2xl border-gray-200/50 relative z-10">
        <CardHeader>
          <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-violet-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <UtensilsCrossed className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-center text-2xl text-gray-900">
            {step === 'account' ? 'Create Account' : 'Set Your Preferences'}
          </CardTitle>
          <CardDescription className="text-center">
            {step === 'account'
              ? 'Join Meal Swipe to find restaurants with your friends'
              : 'Help us personalize your restaurant recommendations'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {step === 'account' ? (
            <form onSubmit={handleAccountNext} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter your name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
                {errors.name && <p className="text-sm text-red-600">{errors.name}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">NYU Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.name@nyu.edu"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
                {errors.email && <p className="text-sm text-red-600">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Create a password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                />
                {errors.password && (
                  <p className="text-sm text-red-600">{errors.password}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Re-enter your password"
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    setFormData({ ...formData, confirmPassword: e.target.value })
                  }
                />
                {errors.confirmPassword && (
                  <p className="text-sm text-red-600">{errors.confirmPassword}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-purple-700 hover:bg-purple-800 text-white shadow-lg"
              >
                Continue
              </Button>

              <div className="text-center text-sm">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="text-purple-600 hover:text-purple-700 font-medium"
                >
                  Sign in
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-6">
              {/* Dietary Restrictions */}
              <div className="space-y-3">
                <Label>Dietary Restrictions (Optional)</Label>
                <p className="text-xs text-muted-foreground">
                  Select any dietary restrictions you have
                </p>
                <div className="flex flex-wrap gap-2">
                  {dietaryCatalog.map((option) => (
                    <Badge
                      key={option}
                      variant={selectedDietary.includes(option) ? 'default' : 'outline'}
                      className={`cursor-pointer ${
                        selectedDietary.includes(option)
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                          : ''
                      }`}
                      onClick={() => toggleDietary(option)}
                    >
                      {option}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Favorite Cuisines */}
              <div className="space-y-3">
                <Label>Favorite Cuisines (Optional)</Label>
                <p className="text-xs text-muted-foreground">
                  Select cuisines you enjoy
                </p>
                <div className="flex flex-wrap gap-2">
                  {cuisineCatalog.map((option) => (
                    <Badge
                      key={option}
                      variant={
                        selectedCuisines.includes(option) ? 'default' : 'outline'
                      }
                      className={`cursor-pointer ${
                        selectedCuisines.includes(option)
                          ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white'
                          : ''
                      }`}
                      onClick={() => toggleCuisine(option)}
                    >
                      {option}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label>Food Types (Optional)</Label>
                <p className="text-xs text-muted-foreground">
                  Select formats you enjoy
                </p>
                <div className="flex flex-wrap gap-2">
                  {foodTypeCatalog.map((option) => (
                    <Badge
                      key={option}
                      variant={
                        selectedFoodTypes.includes(option) ? 'default' : 'outline'
                      }
                      className={`cursor-pointer ${
                        selectedFoodTypes.includes(option)
                          ? 'bg-gradient-to-r from-pink-500 to-red-500 text-white'
                          : ''
                      }`}
                      onClick={() => toggleFoodType(option)}
                    >
                      {option}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="minimumSanitationGrade">Minimum Sanitation Grade</Label>
                <p className="text-xs text-muted-foreground">
                  Only show restaurants with at least this grade
                </p>
                <Select
                  value={minimumSanitationGrade}
                  onValueChange={setMinimumSanitationGrade}
                >
                  <SelectTrigger id="minimumSanitationGrade" className="h-11 max-w-xs">
                    <SelectValue placeholder="Select a grade" />
                  </SelectTrigger>
                  <SelectContent>
                    {sanitationCatalog.map((grade) => (
                      <SelectItem key={grade} value={grade}>
                        {formatSanitationGradeLabel(grade)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep('account')}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600"
                >
                  Complete Registration
                </Button>
              </div>

              {errors.form && (
                <p className="text-sm text-red-600 text-center">{errors.form}</p>
              )}

              <p className="text-xs text-center text-muted-foreground">
                You can always update your preferences later
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
