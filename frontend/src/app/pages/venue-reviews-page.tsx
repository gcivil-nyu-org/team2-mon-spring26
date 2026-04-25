import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useVenue } from '@/app/contexts/venue-context';
import type { VenueReview, VenueReviewsPayload } from '@/app/contexts/venue-context';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { Star, ArrowLeft, MessageSquareReply, Image as ImageIcon } from 'lucide-react';

export function VenueReviewsPage() {
  const { venueId } = useParams<{ venueId: string }>();
  const navigate = useNavigate();
  const { fetchVenueReviews, replyToReview } = useVenue();

  const [payload, setPayload] = useState<VenueReviewsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const [replyingId, setReplyingId] = useState<number | null>(null);

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
        setLoading(true);
        const data = await fetchVenueReviews(id);
        if (!cancelled) {
          setPayload(data);
          setError('');
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load reviews');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [venueId, fetchVenueReviews]);

  const venue = payload?.venue;
  const reviews = useMemo(() => payload?.reviews ?? [], [payload]);

  const handleReply = async (review: VenueReview) => {
    if (!venueId) return;
    const text = (replyDrafts[review.id] || '').trim();
    if (!text) {
      setError('Reply content is required.');
      return;
    }

    const numericVenueId = Number.parseInt(venueId, 10);
    setReplyingId(review.id);
    try {
      const comment = await replyToReview(numericVenueId, review.id, text);
      setPayload((current) =>
        current
          ? {
              ...current,
              reviews: current.reviews.map((item) =>
                item.id === review.id
                  ? { ...item, comments: [...item.comments, comment] }
                  : item
              ),
            }
          : current
      );
      setReplyDrafts((current) => ({ ...current, [review.id]: '' }));
      setError('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to post reply');
    } finally {
      setReplyingId(null);
    }
  };

  const stars = (rating: number) =>
    Array.from({ length: 5 }, (_, index) => index < rating);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="rounded-full h-10 w-10 border-4 border-orange-500 border-t-transparent animate-spin mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Loading reviews…</p>
        </div>
      </div>
    );
  }

  if (error && !payload) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <p className="text-red-600">{error}</p>
          <Button onClick={() => navigate('/venue/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (!venue) {
    return null;
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Button variant="ghost" className="mb-3 px-0" onClick={() => navigate('/venue/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-semibold">{venue.name}</h1>
          <p className="text-muted-foreground mt-1">
            {venue.cuisineType || 'Venue reviews'} · {venue.priceRange || 'No price range'}
          </p>
        </div>
        <Badge variant="outline" className="self-start">
          {reviews.length} review{reviews.length === 1 ? '' : 's'}
        </Badge>
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {reviews.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No reviews yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <Card key={review.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-lg">{review.title || 'Untitled review'}</CardTitle>
                      {!review.isVisible && (
                        <Badge variant="destructive" className="text-xs">
                          Hidden
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="flex flex-wrap items-center gap-2">
                      <span>{review.author.name}</span>
                      <span>·</span>
                      <span>{review.author.email}</span>
                      <span>·</span>
                      <span>{new Date(review.visitDate).toLocaleDateString()}</span>
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    {review.rating}/5
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {review.content && <p className="text-sm leading-6">{review.content}</p>}

                {review.additionalPhotos.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <ImageIcon className="w-3.5 h-3.5" />
                      Additional photos
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {review.additionalPhotos.map((photo) => (
                        <a
                          key={photo}
                          href={photo}
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded-md overflow-hidden border bg-muted"
                        >
                          <img src={photo} alt="Review upload" className="h-28 w-full object-cover" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Responses
                  </p>
                  {review.comments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No responses yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {review.comments.map((comment) => (
                        <div key={comment.id} className="rounded-md border bg-muted/40 p-3 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium">{comment.author.name}</p>
                            {comment.isManagerResponse && (
                              <Badge variant="outline" className="text-xs">
                                Owner Response
                              </Badge>
                            )}
                            {!comment.isVisible && (
                              <Badge variant="destructive" className="text-xs">
                                Hidden
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm leading-6">{comment.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {payload?.canReply && (
                  <div className="space-y-2 pt-2">
                    <Label htmlFor={`reply-${review.id}`}>Owner Response</Label>
                    <Textarea
                      id={`reply-${review.id}`}
                      value={replyDrafts[review.id] || ''}
                      onChange={(event) =>
                        setReplyDrafts((current) => ({
                          ...current,
                          [review.id]: event.target.value,
                        }))
                      }
                      placeholder="Write a response to this review"
                    />
                    <div className="flex justify-end">
                      <Button
                        onClick={() => handleReply(review)}
                        disabled={replyingId === review.id}
                      >
                        <MessageSquareReply className="w-4 h-4 mr-2" />
                        {replyingId === review.id ? 'Posting…' : 'Post Response'}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
