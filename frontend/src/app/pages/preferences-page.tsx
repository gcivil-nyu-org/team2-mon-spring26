import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/app/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Label } from '@/app/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { useApp } from '@/app/contexts/app-context';
import preferenceOptions from '@/app/data/preference-options.json';
import { formatSanitationGradeLabel } from '@/app/utils/sanitation-grade';

const SANITATION_OPTIONS = (preferenceOptions.minimumSanitationGrades ?? []).map(
  (grade) => ({ value: grade, label: formatSanitationGradeLabel(grade) })
);
// Keep the backend-visible grade codes in sync with the options file.

export function PreferencesPage() {
  const navigate = useNavigate();
  const { currentUser, updatePreferences } = useApp();

  const [dietary, setDietary] = useState<string[]>([]);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [foodTypes, setFoodTypes] = useState<string[]>([]);
  const [minimumSanitationGrade, setMinimumSanitationGrade] = useState<string>('A');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dietaryList: string[] = preferenceOptions.dietary ?? [];
  const cuisinesList: string[] = preferenceOptions.cuisines ?? [];
  const foodTypesList: string[] = preferenceOptions.foodTypes ?? [];

  useEffect(() => {
    if (currentUser?.preferences) {
      setDietary(currentUser.preferences.dietary ?? []);
      setCuisines(currentUser.preferences.cuisines ?? []);
      setFoodTypes(currentUser.preferences.foodTypes ?? []);
      setMinimumSanitationGrade(currentUser.preferences.minimumSanitationGrade ?? 'A');
    }
  }, [currentUser]);

  const toggleDietary = (option: string) => {
    setDietary((prev) =>
      prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]
    );
  };
  const toggleCuisine = (option: string) => {
    setCuisines((prev) =>
      prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]
    );
  };
  const toggleFoodType = (option: string) => {
    setFoodTypes((prev) =>
      prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]
    );
  };

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      await updatePreferences({
        dietary,
        cuisines,
        foodTypes,
        minimumSanitationGrade,
      });
      toast.success('Preferences saved.');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to save preferences.';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>


      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Cuisine Preferences</CardTitle>
            <CardDescription>Select cuisines you enjoy</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {cuisinesList.map((cuisine) => (
                <Badge
                  key={cuisine}
                  asChild
                  variant={cuisines.includes(cuisine) ? 'default' : 'secondary'}
                  className={`text-sm py-1.5 px-4 transition-colors ${
                    cuisines.includes(cuisine)
                      ? 'bg-zinc-950 hover:bg-zinc-800 text-zinc-50 border-transparent shadow-sm'
                      : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border-zinc-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleCuisine(cuisine)}
                    aria-pressed={cuisines.includes(cuisine)}
                    className="cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md"
                  >
                    {cuisine}
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dietary Restrictions</CardTitle>
            <CardDescription>Select any dietary restrictions you have</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {dietaryList.map((diet) => (
                <Badge
                  key={diet}
                  asChild
                  variant={dietary.includes(diet) ? 'default' : 'secondary'}
                  className={`text-sm py-1.5 px-4 transition-colors ${
                    dietary.includes(diet)
                      ? 'bg-zinc-950 hover:bg-zinc-800 text-zinc-50 border-transparent shadow-sm'
                      : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border-zinc-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleDietary(diet)}
                    aria-pressed={dietary.includes(diet)}
                    className="cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md"
                  >
                    {diet}
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Food Types</CardTitle>
            <CardDescription>Types of food you prefer</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {foodTypesList.map((type) => (
                <Badge
                  key={type}
                  asChild
                  variant={foodTypes.includes(type) ? 'default' : 'secondary'}
                  className={`text-sm py-1.5 px-4 transition-colors ${
                    foodTypes.includes(type)
                      ? 'bg-zinc-950 hover:bg-zinc-800 text-zinc-50 border-transparent shadow-sm'
                      : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border-zinc-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleFoodType(type)}
                    aria-pressed={foodTypes.includes(type)}
                    className="cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md"
                  >
                    {type}
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Minimum Sanitation Grade</CardTitle>
            <CardDescription>
              Only show restaurants with at least this grade
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Label htmlFor="sanitation" className="sr-only">
              Minimum sanitation grade
            </Label>
            <Select
              value={minimumSanitationGrade}
              onValueChange={setMinimumSanitationGrade}
            >
              <SelectTrigger id="sanitation" className="h-11 max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SANITATION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <div className="grid grid-cols-1 gap-4">
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? 'Saving…' : 'Save Preferences'}
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/home')}
            className="w-full"
          >
            Back to Home
          </Button>
        </div>
      </main>
    </>
  );
}
