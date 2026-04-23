import { useState } from 'react';

interface UserAvatarProps {
  photoUrl?: string | null;
  name?: string | null;
  email?: string | null;
  role?: 'student' | 'venue_manager' | 'admin';
  size?: number;
  className?: string;
}

const GRADIENT: Record<string, string> = {
  admin: 'from-blue-400 to-blue-600',
  venue_manager: 'from-orange-400 to-orange-600',
  student: 'from-purple-400 to-pink-400',
};

function getInitial(name?: string | null, email?: string | null): string {
  const trimmed = (name || '').trim();
  if (trimmed) return trimmed.charAt(0).toUpperCase();
  const local = (email || '').split('@')[0];
  return (local || '?').charAt(0).toUpperCase();
}

export function UserAvatar({
  photoUrl,
  name,
  email,
  role,
  size = 40,
  className = '',
}: UserAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const style = { width: size, height: size };
  const gradient = GRADIENT[role ?? 'student'];

  if (photoUrl && !imgError) {
    return (
      <img
        src={photoUrl}
        alt={name || email || 'User avatar'}
        style={{ ...style, objectFit: 'cover', display: 'block' }}
        className={`rounded-full ${className}`}
        onError={() => setImgError(true)}
      />
    );
  }

  const initial = getInitial(name, email);
  const fontSize = Math.max(10, Math.round(size * 0.4));
  return (
    <div
      aria-label={`${initial} avatar`}
      style={{ ...style, fontSize }}
      className={`rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-semibold select-none ${className}`}
    >
      {initial}
    </div>
  );
}
