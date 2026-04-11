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
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-2xl">Admin Reset Password</CardTitle>
          <CardDescription className="text-center">
            Create a new password for your admin account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isValidating ? (
            <p className="text-sm text-muted-foreground text-center">
              Validating reset link...
            </p>
          ) : success ? (
            <div className="space-y-4">
              <p className="text-sm text-green-700 text-center">
                Your password has been reset successfully.
              </p>
              <Button
                type="button"
                className="w-full"
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
                className="w-full"
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
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save New Password'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
