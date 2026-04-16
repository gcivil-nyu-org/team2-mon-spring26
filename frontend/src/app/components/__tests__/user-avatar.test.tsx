import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { UserAvatar } from '@/app/components/user-avatar';

describe('UserAvatar', () => {
  it('renders single initial from name', () => {
    render(<UserAvatar name="Alice Smith" />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('renders single initial from single-word name', () => {
    render(<UserAvatar name="Madonna" />);
    expect(screen.getByText('M')).toBeInTheDocument();
  });

  it('derives initial from email when name is blank', () => {
    render(<UserAvatar email="chess@nyu.edu" />);
    expect(screen.getByText('C')).toBeInTheDocument();
  });

  it('renders "?" when no name or email', () => {
    render(<UserAvatar />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('applies custom size via inline style', () => {
    render(<UserAvatar name="X Y" size={64} />);
    const el = screen.getByText('X');
    expect(el.style.width).toBe('64px');
    expect(el.style.height).toBe('64px');
  });

  it('uses purple gradient for student (default)', () => {
    const { container } = render(<UserAvatar name="Alice" />);
    const el = container.firstChild as HTMLElement;
    expect(el.classList.contains('from-purple-400')).toBe(true);
    expect(el.classList.contains('to-pink-400')).toBe(true);
  });

  it('uses blue gradient for admin', () => {
    const { container } = render(<UserAvatar name="Admin" role="admin" />);
    const el = container.firstChild as HTMLElement;
    expect(el.classList.contains('from-blue-400')).toBe(true);
    expect(el.classList.contains('to-blue-600')).toBe(true);
  });

  it('uses orange gradient for venue_manager', () => {
    const { container } = render(<UserAvatar name="Venue" role="venue_manager" />);
    const el = container.firstChild as HTMLElement;
    expect(el.classList.contains('from-orange-400')).toBe(true);
    expect(el.classList.contains('to-orange-600')).toBe(true);
  });
});
