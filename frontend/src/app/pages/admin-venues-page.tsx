import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Badge } from '@/app/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { Search, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';

const API = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000';

interface VenueSummary {
  id: number;
  name: string;
  streetAddress: string;
  borough: string;
  neighborhood: string;
  cuisineType: string;
  priceRange: string;
  sanitationGrade: string;
  isVerified: boolean;
  isActive: boolean;
  isClaimed: boolean;
}

const BOROUGHS = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'];

export function AdminVenuesPage() {
  const navigate = useNavigate();
  const [venues, setVenues] = useState<VenueSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [borough, setBorough] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchVenues = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (borough) params.set('borough', borough);
      params.set('page', String(page));
      const res = await fetch(`${API}/api/venues/admin/venues/?${params}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setVenues(data.venues);
        setTotalPages(data.totalPages);
        setTotalCount(data.totalCount);
        setPage(data.page);
      }
    } catch (err) {
      console.error('Failed to fetch venues:', err);
    } finally {
      setLoading(false);
    }
  }, [query, borough, page]);

  useEffect(() => {
    fetchVenues();
  }, [fetchVenues]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <p className="text-sm text-muted-foreground">{totalCount} venues total</p>

      {/* Search bar */}
        <form onSubmit={handleSearch} className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Venue Name
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name…"
                className="pl-9"
              />
            </div>
          </div>
          <div className="w-48">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Borough
            </label>
            <Select
              value={borough || 'all'}
              onValueChange={(v) => {
                setBorough(v === 'all' ? '' : v);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All boroughs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All boroughs</SelectItem>
                {BOROUGHS.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="submit"
            className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white h-10"
          >
            Search
          </Button>
        </form>

        {/* Table */}
        {loading ? (
          <div className="text-center py-16">
            <div className="rounded-full h-10 w-10 border-4 border-indigo-500 border-t-transparent animate-spin mx-auto mb-3" />
            <p className="text-muted-foreground">Loading venues…</p>
          </div>
        ) : venues.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border">
            <p className="text-muted-foreground">No venues found.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 font-semibold">Venue</th>
                    <th className="text-left px-4 py-3 font-semibold">Location</th>
                    <th className="text-left px-4 py-3 font-semibold">Cuisine</th>
                    <th className="text-left px-4 py-3 font-semibold">Grade</th>
                    <th className="text-left px-4 py-3 font-semibold">Status</th>
                    <th className="text-right px-4 py-3 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {venues.map((v) => (
                    <tr
                      key={v.id}
                      className="border-b last:border-b-0 hover:bg-muted/30 cursor-pointer"
                      onClick={() => navigate(`/admin/venues/${v.id}`)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">{v.name}</div>
                        {v.priceRange && (
                          <span className="text-xs text-muted-foreground">{v.priceRange}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <div>{v.streetAddress}</div>
                        <div className="text-xs">
                          {[v.borough, v.neighborhood].filter(Boolean).join(', ')}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {v.cuisineType || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {v.sanitationGrade ? (
                          <Badge variant="outline">
                            {v.sanitationGrade}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5 flex-wrap">
                          {v.isVerified && (
                            <Badge
                              variant="outline"
                              className="bg-green-50 text-green-700 border-green-200 text-xs"
                            >
                              Verified
                            </Badge>
                          )}
                          {v.isClaimed && (
                            <Badge
                              variant="outline"
                              className="bg-amber-50 text-amber-700 border-amber-200 text-xs"
                            >
                              Claimed
                            </Badge>
                          )}
                          {!v.isActive && (
                            <Badge
                              variant="outline"
                              className="bg-red-50 text-red-600 border-red-200 text-xs"
                            >
                              Inactive
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/admin/venues/${v.id}`);
                          }}
                        >
                          <Pencil className="w-3.5 h-3.5 mr-1" />
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30">
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
    </div>
  );
}
