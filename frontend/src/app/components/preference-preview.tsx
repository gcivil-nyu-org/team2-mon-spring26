import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Star } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/app/components/ui/sheet';
import { Badge } from '@/app/components/ui/badge';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import { Skeleton } from '@/app/components/ui/skeleton';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { RestaurantCard } from '@/app/components/restaurant-card';
import { useApp, type PreviewFilters } from '@/app/contexts/app-context';
import type { Restaurant } from '@/app/data/mock-restaurants';

interface PreviewSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: PreviewFilters;
  mode: 'user' | 'group';
  groupId?: string;
  title?: string;
}

interface TriggerProps {
  filters: PreviewFilters;
  mode?: 'user' | 'group';
  groupId?: string;
  className?: string;
  triggerLabel?: (count: number, loading: boolean) => string;
}

const DEBOUNCE_MS = 350;
const PAGE_SIZE = 30;

function filtersKey(filters: PreviewFilters): string {
  return JSON.stringify({
    c: [...(filters.cuisines ?? [])].sort(),
    d: [...(filters.dietary ?? [])].sort(),
    f: [...(filters.foodTypes ?? [])].sort(),
    g: filters.minimumSanitationGrade ?? '',
    p: filters.priceRange ?? '',
    b: filters.borough ?? '',
    n: filters.neighborhood ?? '',
  });
}

/** Live count for the trigger line. Debounced so toggling chips doesn't spam. */
function usePreviewCount(
  filters: PreviewFilters,
  mode: 'user' | 'group',
  groupId: string | undefined,
  enabled: boolean
) {
  const { fetchPreviewVenues, fetchGroupPreviewVenues } = useApp();
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const key = filtersKey(filters);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const result =
          mode === 'group' && groupId
            ? await fetchGroupPreviewVenues(groupId, {
                countOnly: true,
                signal: controller.signal,
              })
            : await fetchPreviewVenues(filters, {
                countOnly: true,
                signal: controller.signal,
              });
        setCount(result.count);
      } catch (err) {
        if ((err as { name?: string })?.name !== 'AbortError') {
          setCount(null);
        }
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // key serializes the relevant inputs so we don't refetch on identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, mode, groupId, enabled]);

  return { count, loading };
}

export function PreferencePreviewTrigger({
  filters,
  mode = 'user',
  groupId,
  className,
  triggerLabel,
}: TriggerProps) {
  const [open, setOpen] = useState(false);
  const { count, loading } = usePreviewCount(filters, mode, groupId, true);

  const label = useMemo(() => {
    if (triggerLabel) return triggerLabel(count ?? 0, loading);
    if (loading && count === null) return 'Counting available restaurants…';
    if (count === null) return 'View available restaurants';
    if (count === 0) return 'No restaurants match your preferences';
    if (count === 1) return 'View 1 available restaurant';
    return `View ${count} available restaurants`;
  }, [count, loading, triggerLabel]);

  return (
    <div className={className}>
      <div className="flex flex-col items-stretch gap-2 rounded-lg border border-dashed border-zinc-300 bg-zinc-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-zinc-700">
          <p className="font-medium text-zinc-900">{label}</p>
          <p className="text-xs text-zinc-500">
            Based on your current preferences. See exactly what your swipe session will pull.
          </p>
        </div>
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={() => setOpen(true)}
          disabled={count === 0}
          className="shrink-0"
        >
          <Search className="mr-1.5 h-4 w-4" />
          Preview restaurants
        </Button>
      </div>
      <PreferencePreviewSheet
        open={open}
        onOpenChange={setOpen}
        filters={filters}
        mode={mode}
        groupId={groupId}
      />
    </div>
  );
}

export function PreferencePreviewSheet({
  open,
  onOpenChange,
  filters,
  mode,
  groupId,
  title,
}: PreviewSheetProps) {
  const { fetchPreviewVenues, fetchGroupPreviewVenues, fetchVenuePreviewDetail } = useApp();
  const [venues, setVenues] = useState<Restaurant[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Restaurant | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const detailedVenuesRef = useRef<Map<string, Restaurant>>(new Map());
  // Incremented each time a fresh list is fetched, so the thumbnail prefetch
  // effect re-runs for the new set of venues without depending on `venues` directly
  // (which would re-trigger as thumbnails fill in).
  const listVersionRef = useRef(0);
  const [listVersion, setListVersion] = useState(0);

  const key = filtersKey(filters);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const run = async () => {
      try {
        const result =
          mode === 'group' && groupId
            ? await fetchGroupPreviewVenues(groupId, {
                limit: PAGE_SIZE,
                offset: 0,
                signal: controller.signal,
              })
            : await fetchPreviewVenues(filters, {
                limit: PAGE_SIZE,
                offset: 0,
                signal: controller.signal,
              });
        setVenues(result.venues);
        setCount(result.count);
        // Reset detail cache so we don't show stale photo data for venues that
        // aren't in the new result set.
        detailedVenuesRef.current = new Map();
        setSelected(result.venues[0] ?? null);
        // Signal the thumbnail prefetch effect to run for this new list.
        listVersionRef.current += 1;
        setListVersion(listVersionRef.current);
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setError((err as Error).message ?? 'Failed to load preview');
        setVenues([]);
        setCount(null);
        setSelected(null);
      } finally {
        setLoading(false);
      }
    };
    run();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, key, mode, groupId]);

  // Prefetch full details for all venues in the list so thumbnails appear without
  // waiting for the user to click. Concurrency is capped at 5 to avoid spiking
  // backend load. An AbortController cancels in-flight requests when the sheet
  // closes or filters change.
  useEffect(() => {
    if (listVersion === 0 || venues.length === 0) return;
    const controller = new AbortController();

    const needsFetch = venues.filter((v) => {
      if (v.images && v.images.length > 0) return false;
      if (detailedVenuesRef.current.has(v.id)) {
        // Already cached — patch immediately without a network call.
        const cached = detailedVenuesRef.current.get(v.id)!;
        setVenues((prev) => prev.map((p) => (p.id === cached.id ? cached : p)));
        setSelected((prev) =>
          prev?.id === cached.id && (!prev.images || prev.images.length === 0) ? cached : prev
        );
        return false;
      }
      return true;
    });

    // Run up to CONCURRENCY fetches at once, starting the next when one finishes.
    const CONCURRENCY = 5;
    let idx = 0;
    const runNext = () => {
      if (controller.signal.aborted || idx >= needsFetch.length) return;
      const venue = needsFetch[idx++];
      fetchVenuePreviewDetail(venue.id, controller.signal)
        .then((detailed) => {
          if (controller.signal.aborted) return;
          detailedVenuesRef.current.set(detailed.id, detailed);
          setVenues((prev) => prev.map((v) => (v.id === detailed.id ? detailed : v)));
          setSelected((prev) =>
            prev?.id === detailed.id && (!prev.images || prev.images.length === 0)
              ? detailed
              : prev
          );
        })
        .catch(() => {
          // Non-fatal — thumbnail stays empty for this venue.
        })
        .finally(runNext);
    };

    for (let i = 0; i < Math.min(CONCURRENCY, needsFetch.length); i++) {
      runNext();
    }

    return () => controller.abort();
    // listVersion changes only when a new list is fetched, not when thumbnails fill in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listVersion]);

  // Lazy-load full detail for the selected venue if it wasn't already prefetched.
  useEffect(() => {
    if (!selected) return;
    if (selected.images && selected.images.length > 0) return;
    if (detailedVenuesRef.current.has(selected.id)) {
      const cached = detailedVenuesRef.current.get(selected.id)!;
      setSelected(cached);
      return;
    }
    const controller = new AbortController();
    setDetailLoading(true);
    fetchVenuePreviewDetail(selected.id, controller.signal)
      .then((venue) => {
        if (controller.signal.aborted) return;
        detailedVenuesRef.current.set(venue.id, venue);
        setSelected(venue);
        setVenues((prev) => prev.map((v) => (v.id === venue.id ? venue : v)));
      })
      .catch(() => {
        // Non-fatal — fall back to whatever data we already have.
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailLoading(false);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const handleSelect = useCallback((venue: Restaurant) => {
    setSelected(venue);
  }, []);

  const headerCount = count ?? venues.length;
  const headerTitle =
    title ?? (mode === 'group' ? 'Group restaurant preview' : 'Restaurant preview');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="!max-w-[1100px] w-full sm:!max-w-[1100px] p-0 flex flex-col"
      >
        <SheetHeader className="border-b">
          <SheetTitle>{headerTitle}</SheetTitle>
          <SheetDescription>
            {loading
              ? 'Loading matching restaurants…'
              : error
                ? error
                : `${headerCount} restaurant${headerCount === 1 ? '' : 's'} match your current ${
                    mode === 'group' ? "group's combined" : ''
                  } preferences.`}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[340px_1fr]">
          <div className="border-r min-h-0">
            <ScrollArea className="h-full">
              <div className="flex flex-col divide-y">
                {loading && venues.length === 0
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="flex gap-3 p-3">
                        <Skeleton className="h-16 w-16 rounded-md" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                      </div>
                    ))
                  : venues.map((venue) => {
                      const isSelected = selected?.id === venue.id;
                      const thumb = venue.images?.[0] ?? '';
                      return (
                        <button
                          type="button"
                          key={venue.id}
                          onClick={() => handleSelect(venue)}
                          className={`flex gap-3 p-3 text-left transition-colors hover:bg-zinc-100 ${
                            isSelected ? 'bg-zinc-100' : ''
                          }`}
                        >
                          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-zinc-200">
                            {thumb ? (
                              <ImageWithFallback
                                src={thumb}
                                alt={venue.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <Skeleton className="h-full w-full" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-sm text-zinc-900">
                              {venue.name}
                            </p>
                            <p className="truncate text-xs text-zinc-500">
                              {venue.cuisine?.join(', ') || venue.neighborhood || ''}
                            </p>
                            <div className="mt-1 flex items-center gap-2 text-xs text-zinc-600">
                              <span>{venue.cost}</span>
                              {venue.rating > 0 && (
                                <span className="inline-flex items-center gap-0.5">
                                  <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                                  {venue.rating.toFixed(1)}
                                </span>
                              )}
                              <Badge
                                variant="outline"
                                className="px-1.5 py-0 text-[10px]"
                              >
                                {venue.sanitationGrade}
                              </Badge>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                {!loading && venues.length === 0 && (
                  <div className="p-6 text-center text-sm text-zinc-500">
                    No restaurants match the current filters. Try removing a cuisine
                    or lowering the sanitation grade.
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="min-h-0 overflow-auto bg-zinc-50">
            {selected ? (
              <div className="mx-auto max-w-md p-4">
                {detailLoading && (!selected.images || selected.images.length === 0) ? (
                  <div className="space-y-3">
                    <Skeleton className="h-64 w-full rounded-lg" />
                    <Skeleton className="h-6 w-2/3" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ) : (
                  <RestaurantCard restaurant={selected} isReadonly />
                )}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center p-8 text-sm text-zinc-500">
                Select a restaurant to see its details.
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
