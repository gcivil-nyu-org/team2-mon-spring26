import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useAdmin } from '@/app/contexts/admin-context';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { ArrowLeft, Check, X, ChevronLeft, ChevronRight } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000';

function apiUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

function getCookie(name: string): string {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() ?? '';
  return '';
}

interface VenueClaim {
  id: number;
  status: string;
  note: string;
  adminNote: string;
  createdAt: string;
  reviewedAt: string | null;
  venue: {
    id: number;
    name: string;
    streetAddress: string;
    borough: string;
    neighborhood: string;
    cuisineType: string;
  };
  manager: {
    id: number | null;
    businessName: string;
    businessEmail: string;
    userName: string;
    userEmail: string;
  };
}

export function AdminVenueVerificationPage() {
  const { currentAdmin } = useAdmin();
  const navigate = useNavigate();

  const [claims, setClaims] = useState<VenueClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [actionLoading, setActionLoading] = useState<Record<number, boolean>>({});

  const fetchClaims = useCallback(async () => {
    if (!currentAdmin) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      params.set('page', String(page));

      const response = await fetch(apiUrl(`/api/venues/admin/claims/?${params}`), {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setClaims(data.claims);
        setTotalPages(data.totalPages);
        setTotalCount(data.totalCount);
        setPage(data.page);
      }
    } catch (err) {
      console.error('Failed to fetch claims:', err);
    } finally {
      setLoading(false);
    }
  }, [currentAdmin, statusFilter, page]);

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  const handleAction = async (claimId: number, action: 'approve' | 'reject') => {
    setActionLoading((prev) => ({ ...prev, [claimId]: true }));
    try {
      const csrftoken = getCookie('csrftoken') || '';
      const response = await fetch(apiUrl(`/api/venues/admin/claims/${claimId}/`), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrftoken,
        },
        body: JSON.stringify({ action }),
      });
      if (response.ok) {
        // Update inline
        setClaims((prev) =>
          prev.map((c) =>
            c.id === claimId
              ? { ...c, status: action === 'approve' ? 'approved' : 'rejected' }
              : c
          )
        );
      } else {
        const data = await response.json();
        alert(data.error || 'Action failed');
      }
    } catch (err) {
      console.error('Claim action error:', err);
    } finally {
      setActionLoading((prev) => ({ ...prev, [claimId]: false }));
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge
            variant="outline"
            className="bg-yellow-50 text-yellow-700 border-yellow-200"
          >
            Pending
          </Badge>
        );
      case 'approved':
        return (
          <Badge
            variant="outline"
            className="bg-green-50 text-green-700 border-green-200"
          >
            Approved
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            Rejected
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-blue-50/40">
      {/* Header bar */}
      <div className="bg-white border-b border-blue-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/admin/dashboard')}
            className="text-blue-700 hover:bg-blue-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-blue-900">Venue Verification</h1>
            <p className="text-sm text-blue-600">
              Review and approve venue manager claims — {totalCount} total
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-5">
        {/* Filter */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Filter by status:</span>
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-12">
            <div className="rounded-full h-10 w-10 border-4 border-slate-600 border-t-transparent animate-spin mx-auto mb-3" />
            <p className="text-muted-foreground">Loading claims...</p>
          </div>
        ) : claims.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border">
            <p className="text-muted-foreground">
              No venue claims found for this filter.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="text-left px-4 py-3 font-medium">Venue</th>
                    <th className="text-left px-4 py-3 font-medium">Address</th>
                    <th className="text-left px-4 py-3 font-medium">Manager</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Submitted</th>
                    <th className="text-right px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {claims.map((claim) => (
                    <tr
                      key={claim.id}
                      className="border-b last:border-b-0 hover:bg-slate-50/50"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">{claim.venue.name}</div>
                        {claim.venue.cuisineType && (
                          <div className="text-xs text-muted-foreground">
                            {claim.venue.cuisineType}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <div>{claim.venue.streetAddress}</div>
                        <div className="text-xs">
                          {[claim.venue.borough, claim.venue.neighborhood]
                            .filter(Boolean)
                            .join(', ')}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">
                          {claim.manager.userName || claim.manager.businessName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {claim.manager.userEmail}
                        </div>
                        {claim.manager.businessEmail &&
                          claim.manager.businessEmail !== claim.manager.userEmail && (
                            <div className="text-xs text-muted-foreground">
                              {claim.manager.businessEmail}
                            </div>
                          )}
                      </td>
                      <td className="px-4 py-3">{statusBadge(claim.status)}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(claim.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {claim.status === 'pending' ? (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-700 border-green-200 hover:bg-green-50 h-8"
                              disabled={actionLoading[claim.id]}
                              onClick={() => handleAction(claim.id, 'approve')}
                            >
                              <Check className="w-3.5 h-3.5 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-700 border-red-200 hover:bg-red-50 h-8"
                              disabled={actionLoading[claim.id]}
                              onClick={() => handleAction(claim.id, 'reject')}
                            >
                              <X className="w-3.5 h-3.5 mr-1" />
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {claim.reviewedAt
                              ? `Reviewed ${new Date(claim.reviewedAt).toLocaleDateString()}`
                              : '—'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t bg-slate-50">
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
    </div>
  );
}
