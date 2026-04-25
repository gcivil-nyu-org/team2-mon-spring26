import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Badge } from '@/app/components/ui/badge';
import { apiUrl } from '@/app/lib/api';

type ReportStatus = 'pending' | 'confirmed' | 'rejected';

interface ModerationReport {
  id: number;
  status: ReportStatus;
  reason: string;
  createdAt: string;
  reviewedAt: string | null;
  contentType: 'review' | 'comment';
  content: {
    id: number;
    title: string;
    body: string;
    venueName: string;
    authorEmail: string;
    authorName: string;
  };
  reporter: {
    id: number;
    email: string;
    name: string;
  };
}

export function AdminModerationPage() {
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [status, setStatus] = useState<ReportStatus>('pending');
  const [loading, setLoading] = useState(false);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(apiUrl(`/api/venues/admin/moderation/?status=${status}`), {
        credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success) {
        setReports(data.reports ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const takeAction = async (reportId: number, action: 'confirm' | 'reject') => {
    const response = await fetch(apiUrl(`/api/venues/admin/moderation/${reportId}/`), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) return;
    setReports((prev) => prev.filter((report) => report.id !== reportId));
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Moderation Queue</h2>
        <div className="w-44">
          <Select value={status} onValueChange={(value) => setStatus(value as ReportStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading moderation queue...</p>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No reports in this queue.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <Card key={report.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-lg">
                    {report.contentType === 'review' ? 'Review' : 'Comment'} on {report.content.venueName}
                  </CardTitle>
                  <Badge variant="outline">{report.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm"><span className="font-medium">Reporter:</span> {report.reporter.name} ({report.reporter.email})</p>
                <p className="text-sm"><span className="font-medium">Author:</span> {report.content.authorName} ({report.content.authorEmail})</p>
                <p className="text-sm"><span className="font-medium">Reason:</span> {report.reason}</p>
                <p className="text-sm"><span className="font-medium">Content:</span> {report.content.title ? `${report.content.title} — ` : ''}{report.content.body || 'No text provided'}</p>
                {report.status === 'pending' && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="destructive"
                      onClick={() => takeAction(report.id, 'confirm')}
                    >
                      Confirm Violation
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => takeAction(report.id, 'reject')}
                    >
                      Reject Report
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
