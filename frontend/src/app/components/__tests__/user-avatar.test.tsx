import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { UserAvatar } from '@/app/components/user-avatar';

describe('UserAvatar', () => {
  it('renders an image when photoUrl is provided', () => {
    render(<UserAvatar photoUrl="https://cdn.test/a.jpg" name="Alice Smith" />);
    const img = screen.getByRole('img') as HTMLImageElement;
    expect(img.src).toBe('https://cdn.test/a.jpg');
    expect(img.alt).toBe('Alice Smith');
  });

  it('falls back to initials when no photoUrl', () => {
    render(<UserAvatar name="Alice Smith" />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('AS')).toBeInTheDocument();
  });

  it('derives initials from first two letters of single-word name', () => {
    render(<UserAvatar name="Madonna" />);
    expect(screen.getByText('MA')).toBeInTheDocument();
  });

  it('derives initials from email local-part when name is blank', () => {
    render(<UserAvatar email="chess@nyu.edu" />);
    expect(screen.getByText('CH')).toBeInTheDocument();
  });

  it('renders "?" when no name or email', () => {
    render(<UserAvatar />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('falls back to initials when image fails to load', () => {
    render(
      <UserAvatar photoUrl="https://cdn.test/broken.jpg" name="Bob Jones" />
    );
    const img = screen.getByRole('img');
    fireEvent.error(img);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('BJ')).toBeInTheDocument();
  });

  it('applies custom size via inline style', () => {
    render(<UserAvatar name="X Y" size={64} />);
    const el = screen.getByText('XY');
    expect(el.style.width).toBe('64px');
    expect(el.style.height).toBe('64px');
  });

  it('produces a stable color for the same seed', () => {
    const { container: a } = render(<UserAvatar email="same@test.local" />);
    const { container: b } = render(<UserAvatar email="same@test.local" />);
    const classA = a.firstChild as HTMLElement;
    const classB = b.firstChild as HTMLElement;
    const colorA = Array.from(classA.classList).find((c) => c.startsWith('bg-'));
    const colorB = Array.from(classB.classList).find((c) => c.startsWith('bg-'));
    expect(colorA).toBeDefined();
    expect(colorA).toBe(colorB);
  });
});
