import { useState } from 'react';

interface UserAvatarProps {
  photoUrl?: string | null;
  name?: string | null;
  email?: string | null;
  size?: number;
  className?: string;
}

const PALETTE = [
  'bg-indigo-500',
  'bg-blue-500',
  'bg-violet-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-rose-500',
  'bg-orange-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-teal-500',
  'bg-cyan-500',
  'bg-sky-500',
];

function getInitials(name?: string | null, email?: string | null): string {
  const trimmed = (name || '').trim();
  if (trimmed) {
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  const local = (email || '').split('@')[0];
  return (local || '?').slice(0, 2).toUpperCase();
}

function getColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function UserAvatar({
  photoUrl,
  name,
  email,
  size = 40,
  className = '',
}: UserAvatarProps) {
  const [broken, setBroken] = useState(false);

  const initials = getInitials(name, email);
  const seed = email || name || 'user';
  const colorClass = getColor(seed);
  const fontSize = Math.max(10, Math.round(size * 0.4));

  const style = { width: size, height: size };

  if (photoUrl && !broken) {
    return (
      <img
        src={photoUrl}
        alt={name || email || 'User avatar'}
        onError={() => setBroken(true)}
        style={style}
        className={`rounded-full object-cover border border-gray-200 ${className}`}
      />
    );
  }

  return (
    <div
      aria-label={`${initials} avatar`}
      style={{ ...style, fontSize }}
      className={`rounded-full flex items-center justify-center text-white font-semibold select-none ${colorClass} ${className}`}
    >
      {initials}
    </div>
  );
}
