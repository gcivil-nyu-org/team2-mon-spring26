import { useNavigate } from 'react-router';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { ArrowLeft } from 'lucide-react';
import { useApp } from '@/app/contexts/app-context';

export function PreferencesPage() {
  const navigate = useNavigate();
  const { currentUser } = useApp();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      <header className="bg-white border-b">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/home')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl">Preferences</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Cuisine Preferences</CardTitle>
            <CardDescription>
              Your preferred cuisines (currently view-only in this demo)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {currentUser?.preferences.cuisines.map((cuisine) => (
                <Badge key={cuisine} variant="secondary" className="text-sm">
                  {cuisine}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dietary Restrictions</CardTitle>
            <CardDescription>
              Your dietary needs and preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {currentUser?.preferences.dietary.length === 0 ? (
                <p className="text-sm text-muted-foreground">No dietary restrictions</p>
              ) : (
                currentUser?.preferences.dietary.map((diet) => (
                  <Badge key={diet} variant="secondary" className="text-sm">
                    {diet}
                  </Badge>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Button
          onClick={() => navigate('/home')}
          className="w-full"
        >
          Back to Home
        </Button>
      </main>
    </div>
  );
}
