import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Switch } from '@/app/components/ui/switch';
import { Badge } from '@/app/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { UserAvatar } from '@/app/components/user-avatar';
import { Save, Trash2, ImageOff } from 'lucide-react';

const API = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000';

function getCookie(name: string): string {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() ?? '';
  return '';
}

interface Membership {
  groupId: number;
  groupName: string;
  role: string;
  joinDate: string | null;
}

interface ChatSummary {
  chatId: number;
  chatType: string;
  chatName: string;
  role: string;
}

interface UserDetail {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  role: 'student' | 'venue_manager' | 'admin';
  phone: string;
  photoUrl: string;
  isActive: boolean;
  createdAt: string | null;
  preferences: {
    dietary: string[];
    cuisines: string[];
    foodTypes: string[];
    minimumSanitationGrade: string;
  } | null;
  venueManager: {
    businessName: string;
    businessEmail: string;
    businessPhone: string;
    isVerified: boolean;
  } | null;
  memberships: Membership[];
  chats: ChatSummary[];
}

export function AdminUserEditPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [role, setRole] = useState<UserDetail['role']>('student');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API}/api/auth/admin/users/${userId}/`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          const u = data.user as UserDetail;
          setUser(u);
          setFirstName(u.firstName);
          setLastName(u.lastName);
          setEmail(u.email);
          setPhone(u.phone || '');
          setPhotoUrl(u.photoUrl || '');
          setRole(u.role);
          setIsActive(u.isActive);
        }
      } catch (err) {
        console.error('Failed to load user:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const csrftoken = getCookie('csrftoken') || '';
      const body = {
        firstName,
        lastName,
        email,
        phone,
        photoUrl,
        role,
        isActive,
      };
      const res = await fetch(`${API}/api/auth/admin/users/${userId}/`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrftoken,
        },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        toast.success('User saved successfully.');
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to save user.');
      }
    } catch (err) {
      console.error('Save error:', err);
      toast.error('An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePhoto = async () => {
    setPhotoUrl('');
    try {
      const csrftoken = getCookie('csrftoken') || '';
      const res = await fetch(`${API}/api/auth/admin/users/${userId}/`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrftoken,
        },
        body: JSON.stringify({ photoUrl: '' }),
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        toast.success('Photo removed.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to remove photo.');
    }
  };

  const handleDelete = async () => {
    if (
      !window.confirm(
        `Delete ${user?.name || user?.email}?\n\nThey will be removed from all groups and chats. Groups and group chats will stay intact.`
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      const csrftoken = getCookie('csrftoken') || '';
      const res = await fetch(`${API}/api/auth/admin/users/${userId}/`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'X-CSRFToken': csrftoken },
      });
      if (res.ok) {
        toast.success('User deleted.');
        navigate('/admin/users');
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to delete user.');
      }
    } catch (err) {
      console.error(err);
      toast.error('An error occurred while deleting.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="rounded-full h-10 w-10 border-4 border-indigo-500 border-t-transparent animate-spin mx-auto mb-3" />
          <p className="text-muted-foreground">Loading user…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">User not found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <UserAvatar
            photoUrl={photoUrl}
            name={`${firstName} ${lastName}`.trim() || user.name}
            email={email}
            size={64}
          />
          <div>
            <h2 className="text-2xl font-semibold">
              {`${firstName} ${lastName}`.trim() || user.email}
            </h2>
            <p className="text-xs text-muted-foreground">ID #{user.id}</p>
          </div>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white"
        >
          <Save className="w-4 h-4 mr-1.5" />
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>

      {/* Profile photo */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Photo</CardTitle>
          <CardDescription>
            Paste an image URL. Leave blank to use the default initials avatar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-4">
            <UserAvatar
              photoUrl={photoUrl}
              name={`${firstName} ${lastName}`.trim() || user.name}
              email={email}
              size={72}
            />
            <div className="flex-1">
              <Label>Photo URL</Label>
              <Input
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder="https://…"
              />
            </div>
          </div>
          {user.photoUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRemovePhoto}
              className="text-red-700 border-red-200 hover:bg-red-50"
            >
              <ImageOff className="w-4 h-4 mr-1.5" />
              Remove Photo
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Basic info */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>First Name</Label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div>
              <Label>Last Name</Label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Role</Label>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as UserDetail['role'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="venue_manager">Venue Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <div className="flex items-center gap-2.5">
                <Switch checked={isActive} onCheckedChange={setIsActive} />
                <Label>{isActive ? 'Active' : 'Inactive'}</Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Venue manager profile */}
      {user.venueManager && (
        <Card>
          <CardHeader>
            <CardTitle>Venue Manager Profile</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Business</span>
              <span className="font-medium">
                {user.venueManager.businessName || '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Business Email</span>
              <span className="font-medium">
                {user.venueManager.businessEmail || '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Business Phone</span>
              <span className="font-medium">
                {user.venueManager.businessPhone || '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Verified</span>
              <span>
                {user.venueManager.isVerified ? (
                  <Badge className="bg-green-50 text-green-700 border-green-200">
                    Verified
                  </Badge>
                ) : (
                  <Badge variant="outline">Unverified</Badge>
                )}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Groups */}
      <Card>
        <CardHeader>
          <CardTitle>Group Memberships ({user.memberships.length})</CardTitle>
          <CardDescription>
            Groups this user belongs to. Deleting the user removes them from
            every group while keeping the groups intact.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {user.memberships.length === 0 ? (
            <p className="text-sm text-muted-foreground">No groups.</p>
          ) : (
            <ul className="divide-y">
              {user.memberships.map((m) => (
                <li
                  key={m.groupId}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <span className="font-medium">{m.groupName}</span>
                  <Badge variant="outline" className="text-xs">
                    {m.role}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Chats */}
      <Card>
        <CardHeader>
          <CardTitle>Chats ({user.chats.length})</CardTitle>
          <CardDescription>
            Active chat memberships. On delete, group chats are reassigned to
            another member.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {user.chats.length === 0 ? (
            <p className="text-sm text-muted-foreground">No chats.</p>
          ) : (
            <ul className="divide-y">
              {user.chats.map((c) => (
                <li
                  key={c.chatId}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <span className="font-medium">
                    {c.chatName || `Chat #${c.chatId}`}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {c.chatType}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-700">Danger Zone</CardTitle>
          <CardDescription>
            Permanently delete this user. They will be removed from all groups
            and chats. Groups and group chats will stay intact.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            disabled={deleting}
            onClick={handleDelete}
            className="text-red-700 border-red-200 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            {deleting ? 'Deleting…' : 'Delete User'}
          </Button>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white flex-1"
        >
          <Save className="w-4 h-4 mr-1.5" />
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
        <Button variant="outline" onClick={() => navigate('/admin/users')}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
