import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useAdmin } from '@/app/contexts/admin-context';
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
import { ShieldCheck } from 'lucide-react';

export function AdminResetPasswordPage() {
  const { uid = '', token = '' } = useParams();
  const navigate = useNavigate();
  const { validateAdminPasswordResetToken, confirmAdminPasswordReset } = useAdmin();

  const [isValidating, setIsValidating] = useState(true);
  const [isValidLink, setIsValidLink] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const validateLink = async () => {
      if (!uid || !token) {
        setError('Invalid or expired reset link.');
        setIsValidating(false);
        setIsValidLink(false);
        return;
      }

      try {
        await validateAdminPasswordResetToken(uid, token);
        setIsValidLink(true);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Invalid or expired reset link.';
        setError(message);
        setIsValidLink(false);
      } finally {
        setIsValidating(false);
      }
    };

    validateLink();
  }, [uid, token, validateAdminPasswordResetToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!newPassword || !confirmPassword) {
      setError('Please enter and confirm your new password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setIsSubmitting(true);
      await confirmAdminPasswordReset(uid, token, newPassword);
      setSuccess(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to reset password.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 via-indigo-400 to-blue-300 p-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        ></div>
      </div>

      <Card className="w-full max-w-md bg-white/95 backdrop-blur-sm shadow-2xl border-indigo-200/50 relative z-10">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl flex items-center justify-center shadow-lg">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <div>
            <CardTitle className="text-3xl text-gray-900">Reset Password</CardTitle>
            <CardDescription className="text-base mt-2">
              Create a new password for your admin account
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {isValidating ? (
            <div className="text-center py-4">
              <div className="rounded-full h-10 w-10 border-4 border-indigo-500 border-t-transparent animate-spin mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Validating reset link...
              </p>
            </div>
          ) : success ? (
            <div className="space-y-4">
              <p className="text-sm text-green-700 text-center">
                Your password has been reset successfully.
              </p>
              <Button
                type="button"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg"
                onClick={() => navigate('/admin/login')}
              >
                Back to Admin Login
              </Button>
            </div>
          ) : !isValidLink ? (
            <div className="space-y-4">
              <p className="text-sm text-red-600 text-center">
                {error || 'Invalid or expired reset link.'}
              </p>
              <Button
                type="button"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg"
                onClick={() => navigate('/admin/login')}
              >
                Back to Admin Login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="adminNewPassword">New Password</Label>
                <Input
                  id="adminNewPassword"
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminConfirmPassword">Confirm New Password</Label>
                <Input
                  id="adminConfirmPassword"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : 'Save New Password'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
