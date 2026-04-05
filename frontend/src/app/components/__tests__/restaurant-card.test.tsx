import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, type Mock } from 'vitest';
import { RestaurantCard } from '../restaurant-card';
import type { Restaurant } from '@/app/data/mock-restaurants';

/* Mock Framer Motion */
vi.mock('motion/react', () => ({
  motion: {
    div: 'div',
  },
  AnimatePresence: 'div',
}));

/* Mock App Context */
vi.mock('@/app/contexts/app-context', () => ({
  useApp: vi.fn()
}));
import { useApp } from '@/app/contexts/app-context';

const mockRestaurant: Restaurant = {
  id: "1",
  name: "Test Venue",
  cuisine: ["Pizza"],
  rating: 4.8,
  reviewCount: 150,
  distance: "0.5 miles",
  cost: "$$",
  latitude: 40.7128,
  longitude: -74.0060,
  inspectionDate: "2023-01-01",
  address: "123 Test St",
  sanitationGrade: "A",
  badges: ["Group Seating", "Student Discount"],
  images: ["https://example.com/test.jpg"],
  hasGroupSeating: true,
  hasStudentDiscount: true,
  studentDiscountAmount: "10% off with NYU ID",
  neighborhood: "Greenwich Village",
  seatingCapacity: 45,
  hasTakeout: true,
  hasDelivery: false,
  hasDineIn: true,
  isReservable: false,
  googleMapsUrl: "https://maps.google.com/?cid=123",
  hours: {
    "Monday": "9:00 AM - 5:00 PM"
  }
};

describe('RestaurantCard', () => {
  it('renders correctly with new missing fields (neighborhood, seating capacity, service options)', () => {
    (useApp as Mock).mockReturnValue({
      currentUser: { id: "1", preferences: { dietary: [] } }
    });
    
    render(
      <RestaurantCard 
        restaurant={mockRestaurant} 
        onSwipe={vi.fn()} 
      />
    );
    
    // Check neighborhood
    expect(screen.getByText(/Greenwich Village/)).toBeInTheDocument();
    
    // Check capacity
    expect(screen.getByText(/Seats ~45/)).toBeInTheDocument();
    
    // Check service options (rendered conditionally via Badges)
    expect(screen.getByText('Takeout')).toBeInTheDocument();
    expect(screen.getByText('Dine-in')).toBeInTheDocument();
    expect(screen.queryByText('Delivery')).not.toBeInTheDocument();
    expect(screen.queryByText('Reservable')).not.toBeInTheDocument();
  });

  it('hides swipe buttons and sets readonly styles when isReadonly is true', () => {
    (useApp as Mock).mockReturnValue({
      currentUser: { id: "1", preferences: { dietary: [] } }
    });
    
    render(
      <RestaurantCard 
        restaurant={mockRestaurant} 
        isReadonly={true} 
      />
    );
    
    // Buttons should not be present
    expect(screen.queryByRole('button', { name: /swipe/i })).not.toBeInTheDocument();
    
    // View Full Details button should be present
    expect(screen.getByText('View Full Details')).toBeInTheDocument();
  });

  it('uses googleMapsUrl when Directions is clicked', () => {
    const originalOpen = window.open;
    window.open = vi.fn();
    (useApp as Mock).mockReturnValue({
      currentUser: { id: "1", preferences: { dietary: [] } }
    });
    
    render(
      <RestaurantCard 
        restaurant={mockRestaurant} 
        isReadonly={true} 
      />
    );
    
    // Click View Full Details to open dialog
    const viewDetailsBtn = screen.getByText('View Full Details').closest('button');
    fireEvent.click(viewDetailsBtn!);

    // Click Directions
    const btn = screen.getByText('Directions').closest('button');
    fireEvent.click(btn!);
    
    expect(window.open).toHaveBeenCalledWith('https://maps.google.com/?cid=123', '_blank');
    window.open = originalOpen;
  });

  it('falls back to google maps address search if googleMapsUrl is missing', () => {
    const originalOpen = window.open;
    window.open = vi.fn();
    (useApp as Mock).mockReturnValue({
      currentUser: { id: "1", preferences: { dietary: [] } }
    });
    
    render(
      <RestaurantCard 
        restaurant={{...mockRestaurant, googleMapsUrl: undefined}} 
        isReadonly={true} 
      />
    );
    
    // Click View Full Details to open dialog
    const viewDetailsBtn = screen.getByText('View Full Details').closest('button');
    fireEvent.click(viewDetailsBtn!);

    // Click Directions
    const btn = screen.getByText('Directions').closest('button');
    fireEvent.click(btn!);
    
    expect(window.open).toHaveBeenCalledWith('https://maps.google.com/?q=123%20Test%20St', '_blank');
    window.open = originalOpen;
  });
});
