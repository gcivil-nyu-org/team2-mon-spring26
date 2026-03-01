import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useApp } from '@/app/contexts/app-context';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { UtensilsCrossed, Mail, CheckCircle2 } from 'lucide-react';

export function LoginPage() {
  const [email, setEmail] = useState('alex@nyu.edu');
  const [password, setPassword] = useState('password');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState('');
  const { login, getAllUsers } = useApp();
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    login(email, password);
    navigate('/home');
  };

  const handleForgotPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    
    // Check if email exists in mock users
    const users = getAllUsers();
    const userExists = users.some(u => u.email === resetEmail);
    
    if (!userExists) {
      setResetError('No account found with this email address.');
      return;
    }
    
    // Simulate sending reset email
    setResetSent(true);
  };

  const handleCloseForgotPassword = () => {
    setShowForgotPassword(false);
    setResetEmail('');
    setResetSent(false);
    setResetError('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-500 via-purple-400 to-violet-300 p-4 relative overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}></div>
      </div>
      
      <Card className="w-full max-w-md bg-gray-50/90 backdrop-blur-sm shadow-2xl border-gray-200/50 relative z-10">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-purple-600 to-violet-700 rounded-2xl flex items-center justify-center shadow-lg">
            <UtensilsCrossed className="w-8 h-8 text-white" />
          </div>
          <div>
            <CardTitle className="text-3xl text-gray-900">Meal Swipe</CardTitle>
            <CardDescription className="text-base mt-2">
              Swipe, match, and dine with friends near NYU
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@nyu.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                >
                  Forgot Password?
                </button>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full bg-purple-700 hover:bg-purple-800 text-white shadow-lg">
              Sign In
            </Button>
            
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-gray-50 px-2 text-muted-foreground">Or</span>
              </div>
            </div>
            
            <Button 
              type="button" 
              variant="outline" 
              className="w-full border-purple-200 hover:bg-purple-50"
              onClick={() => navigate('/register')}
            >
              Create New Account
            </Button>
            
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Demo: Use alex@nyu.edu, sarah@nyu.edu, or jordan@nyu.edu
              </p>
              <button
                type="button"
                onClick={() => navigate('/venue/login')}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Venue Manager Login
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
      
      <Dialog open={showForgotPassword} onOpenChange={handleCloseForgotPassword}>
        <DialogContent className="sm:max-w-md">
          {!resetSent ? (
            <>
              <DialogHeader>
                <DialogTitle>Forgot Password?</DialogTitle>
                <DialogDescription>
                  Enter your email address and we'll send you a link to reset your password.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="resetEmail">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="resetEmail"
                      type="email"
                      placeholder="your.email@nyu.edu"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="pl-9"
                      required
                    />
                  </div>
                  {resetError && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                      {resetError}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCloseForgotPassword}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-purple-700 hover:bg-purple-800 text-white shadow-lg"
                  >
                    Send Reset Link
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <>
              <DialogHeader>
                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <DialogTitle className="text-center">Check Your Email</DialogTitle>
                <DialogDescription className="text-center">
                  We've sent a password reset link to <span className="font-medium text-foreground">{resetEmail}</span>. 
                  Click the link in the email to reset your password.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="bg-muted/50 p-4 rounded-lg text-sm">
                  <p className="text-muted-foreground">
                    <strong className="text-foreground">Note:</strong> This is a demo. In a real application, you would receive an email with a secure reset link.
                  </p>
                </div>
                <Button
                  onClick={handleCloseForgotPassword}
                  className="w-full bg-purple-700 hover:bg-purple-800 text-white shadow-lg"
                >
                  Back to Login
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}