import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useApp } from '@/app/contexts/app-context';
import { apiUrl, getCsrf } from '@/app/lib/api';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { ArrowLeft, Star } from 'lucide-react';

interface ReviewVenueSummary {
  id: number;
  name: string;
  streetAddress: string;
  borough: string;
  priceRange: string;
  cuisineType: string;
}

export function ReviewVenuePage() {
  const { venueId } = useParams<{ venueId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser } = useApp();

  const [venue, setVenue] = useState<ReviewVenueSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [rating, setRating] = useState('5');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [visitDate, setVisitDate] = useState(new Date().toISOString().slice(0, 10));
  const [additionalPhotos, setAdditionalPhotos] = useState('');

  useEffect(() => {
    if (!venueId) return;
    const id = Number.parseInt(venueId, 10);
    if (Number.isNaN(id)) {
      setError('Venue not found.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(apiUrl(`/api/venues/${id}/reviews/`), {
          credentials: 'include',
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to load venue');
        }
        if (!cancelled) {
          setVenue(data.venue as ReviewVenueSummary);
          setError('');
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load venue');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [venueId]);

  const handleSubmit = async () => {
    if (!venueId) return;
    const id = Number.parseInt(venueId, 10);
    if (Number.isNaN(id)) {
      setError('Venue not found.');
      return;
    }

    const photoList = additionalPhotos
      .split(/[\n,]/)
      .map((value) => value.trim())
      .filter(Boolean);

    setSaving(true);
    setError('');
    try {
      const response = await fetch(apiUrl(`/api/venues/${id}/reviews/`), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCsrf(),
        },
        body: JSON.stringify({
          rating: Number.parseInt(rating, 10),
          title,
          content,
          visitDate,
          additionalPhotos: photoList,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit review');
      }
      setSuccess('Review submitted successfully.');
      setTitle('');
      setContent('');
      setAdditionalPhotos('');
      const eventId = searchParams.get('eventId');
      if (eventId) {
        setTimeout(() => navigate(`/match/${eventId}`), 1200);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit review');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="rounded-full h-10 w-10 border-4 border-purple-500 border-t-transparent animate-spin mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Loading review form…</p>
        </div>
      </div>
    );
  }

  if (error && !venue) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <p className="text-red-600">{error}</p>
          <Button onClick={() => navigate('/home')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  if (!venue) return null;

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <Button variant="ghost" className="px-0" onClick={() => navigate(-1)}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
            Write a Review
          </CardTitle>
          <CardDescription>
            {venue.name}{venue.cuisineType ? ` · ${venue.cuisineType}` : ''}{venue.priceRange ? ` · ${venue.priceRange}` : ''}
            {currentUser?.name ? ` · by ${currentUser.name}` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-700">{success}</p>}

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rating">Rating</Label>
              <Select value={rating} onValueChange={setRating}>
                <SelectTrigger id="rating">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 — Excellent</SelectItem>
                  <SelectItem value="4">4 — Good</SelectItem>
                  <SelectItem value="3">3 — OK</SelectItem>
                  <SelectItem value="2">2 — Weak</SelectItem>
                  <SelectItem value="1">1 — Poor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="visitDate">Visit Date</Label>
              <Input
                id="visitDate"
                type="date"
                value={visitDate}
                onChange={(event) => setVisitDate(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="Optional title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Review</Label>
            <Textarea
              id="content"
              placeholder="Tell other students what stood out"
              rows={6}
              value={content}
              onChange={(event) => setContent(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="additionalPhotos">Additional Photo URLs</Label>
            <Textarea
              id="additionalPhotos"
              placeholder="Paste one or more image URLs, separated by commas or new lines"
              rows={4}
              value={additionalPhotos}
              onChange={(event) => setAdditionalPhotos(event.target.value)}
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? 'Submitting…' : 'Submit Review'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
