import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/app/contexts/app-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Button } from '@/app/components/ui/button';
import { Textarea } from '@/app/components/ui/textarea';
import { UserAvatar } from '@/app/components/user-avatar';
import { toast } from 'sonner';
import { Camera, Loader2 } from 'lucide-react';

const ACCEPTED_TYPES = 'image/jpeg,image/png,image/gif,image/webp';
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export function ProfileEditPage() {
  const { currentUser, updateProfile, uploadProfilePhoto } = useApp();

  // Text field state — pre-filled from currentUser
  const [firstName, setFirstName] = useState(currentUser?.firstName ?? '');
  const [lastName, setLastName] = useState(currentUser?.lastName ?? '');
  const [phone, setPhone] = useState(currentUser?.phone ?? '');
  const [bio, setBio] = useState(currentUser?.bio ?? '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Photo state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Re-sync if currentUser changes (e.g. after save)
  useEffect(() => {
    if (currentUser) {
      setFirstName(currentUser.firstName ?? '');
      setLastName(currentUser.lastName ?? '');
      setPhone(currentUser.phone ?? '');
      setBio(currentUser.bio ?? '');
    }
  }, [currentUser]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_SIZE_BYTES) {
      toast.error('File too large. Maximum size is 5 MB.');
      return;
    }
    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleUploadPhoto = async () => {
    if (!selectedFile) return;
    setUploadingPhoto(true);
    try {
      await uploadProfilePhoto(selectedFile);
      toast.success('Profile photo updated.');
      setSelectedFile(null);
      // Revoke old object URL to free memory
      if (preview) URL.revokeObjectURL(preview);
      setPreview(null);
    } catch (e) {
      toast.error((e as Error).message || 'Failed to upload photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await updateProfile({ firstName, lastName, phone, bio });
      toast.success('Profile updated.');
    } catch (e) {
      toast.error((e as Error).message || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const displayPhotoUrl = preview ?? currentUser?.photoUrl ?? '';

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">Edit Profile</h1>

      {/* Photo section */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Photo</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <div className="relative">
            <UserAvatar
              photoUrl={displayPhotoUrl}
              name={currentUser?.name}
              email={currentUser?.email}
              role={currentUser?.role}
              size={96}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 bg-white border border-gray-200 rounded-full p-1.5 shadow hover:bg-gray-50 cursor-pointer"
              aria-label="Change photo"
            >
              <Camera className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            className="hidden"
            onChange={handleFileChange}
          />

          {selectedFile && (
            <div className="flex flex-col items-center gap-2 w-full">
              <p className="text-sm text-gray-500 truncate max-w-xs">{selectedFile.name}</p>
              <Button
                onClick={handleUploadPhoto}
                disabled={uploadingPhoto}
                className="w-full"
              >
                {uploadingPhoto ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading…
                  </>
                ) : (
                  'Upload Photo'
                )}
              </Button>
            </div>
          )}

          <p className="text-xs text-gray-400">JPEG, PNG, GIF or WebP · max 5 MB</p>
        </CardContent>
      </Card>

      {/* Text fields section */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                maxLength={150}
                placeholder="First name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                maxLength={150}
                placeholder="Last name"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone (optional)</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={30}
              placeholder="+1 212 555 0100"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <Label htmlFor="bio">Bio (optional)</Label>
              <span className="text-xs text-gray-400">{bio.length}/500</span>
            </div>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
              rows={4}
              placeholder="Tell your group members a bit about yourself…"
            />
          </div>

          <Button
            onClick={handleSaveProfile}
            disabled={savingProfile}
            className="w-full"
          >
            {savingProfile ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
