import { createContext, useContext, useState, ReactNode } from 'react';

export interface Restaurant {
  id: string;
  name: string;
  address: string;
  borough: string;
  neighborhood: string;
  cuisine: string;
  priceRange: '$' | '$$' | '$$$' | '$$$$';
  sanitationGrade: 'A' | 'B' | 'C' | 'Pending';
  lastInspection: string;
  studentDiscount: boolean;
  discountDetails?: string;
  isVerified: boolean;
  seatingCapacity: number;
  groupSeating: boolean;
  dietaryOptions: string[];
  phoneNumber: string;
  email: string;
  managerId: string;
}

export interface VenueManager {
  id: string;
  name: string;
  email: string;
  password: string;
  businessName: string;
}

interface VenueContextType {
  restaurants: Restaurant[];
  currentManager: VenueManager | null;
  addRestaurant: (restaurant: Omit<Restaurant, 'id' | 'isVerified' | 'managerId'>) => Restaurant;
  updateRestaurant: (id: string, updates: Partial<Restaurant>) => void;
  deleteRestaurant: (id: string) => void;
  loginVenueManager: (email: string, password: string) => boolean;
  registerVenueManager: (name: string, email: string, businessName: string, password: string) => boolean;
  logoutVenueManager: () => void;
}

const VenueContext = createContext<VenueContextType | undefined>(undefined);

// Mock venue managers
const mockVenueManagers: VenueManager[] = [
  {
    id: 'manager-1',
    name: 'Michael Chen',
    email: 'manager@purplebistro.com',
    password: 'password',
    businessName: 'Purple Bistro Restaurant Group',
  },
];

// Mock data for venue manager
const mockRestaurants: Restaurant[] = [
  {
    id: 'rest-1',
    name: 'The Purple Bistro',
    address: '123 MacDougal St, New York, NY 10012',
    borough: 'Manhattan',
    neighborhood: 'Greenwich Village',
    cuisine: 'French',
    priceRange: '$$',
    sanitationGrade: 'A',
    lastInspection: '2025-01-15',
    studentDiscount: true,
    discountDetails: '15% off with NYU ID',
    isVerified: true,
    seatingCapacity: 60,
    groupSeating: true,
    dietaryOptions: ['Vegetarian', 'Vegan Options', 'Gluten-Free'],
    phoneNumber: '(212) 555-0123',
    email: 'contact@purplebistro.com',
    managerId: 'manager-1',
  },
  {
    id: 'rest-2',
    name: 'Noodle Paradise',
    address: '456 Bleecker St, New York, NY 10012',
    borough: 'Manhattan',
    neighborhood: 'Greenwich Village',
    cuisine: 'Asian Fusion',
    priceRange: '$',
    sanitationGrade: 'A',
    lastInspection: '2025-01-20',
    studentDiscount: true,
    discountDetails: '10% off all orders',
    isVerified: true,
    seatingCapacity: 40,
    groupSeating: true,
    dietaryOptions: ['Vegetarian', 'Vegan', 'Halal'],
    phoneNumber: '(212) 555-0456',
    email: 'hello@noodleparadise.com',
    managerId: 'manager-1',
  },
  {
    id: 'rest-3',
    name: 'Washington Square Grill',
    address: '789 Washington Sq S, New York, NY 10012',
    borough: 'Manhattan',
    neighborhood: 'Greenwich Village',
    cuisine: 'American',
    priceRange: '$$$',
    sanitationGrade: 'A',
    lastInspection: '2024-12-10',
    studentDiscount: false,
    isVerified: true,
    seatingCapacity: 80,
    groupSeating: true,
    dietaryOptions: ['Vegetarian', 'Gluten-Free'],
    phoneNumber: '(212) 555-0789',
    email: 'info@wsqgrill.com',
    managerId: 'manager-1',
  },
];

export function VenueProvider({ children }: { children: ReactNode }) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>(mockRestaurants);
  const [venueManagers, setVenueManagers] = useState<VenueManager[]>(mockVenueManagers);
  const [currentManager, setCurrentManager] = useState<VenueManager | null>(null);

  const loginVenueManager = (email: string, password: string): boolean => {
    const manager = venueManagers.find(m => m.email === email && m.password === password);
    if (manager) {
      setCurrentManager(manager);
      return true;
    }
    return false;
  };

  const registerVenueManager = (name: string, email: string, businessName: string, password: string): boolean => {
    // Check if email already exists
    if (venueManagers.some(m => m.email === email)) {
      return false;
    }

    const newManager: VenueManager = {
      id: `manager-${Date.now()}`,
      name,
      email,
      password,
      businessName,
    };

    setVenueManagers([...venueManagers, newManager]);
    setCurrentManager(newManager);
    return true;
  };

  const logoutVenueManager = () => {
    setCurrentManager(null);
  };

  const addRestaurant = (restaurantData: Omit<Restaurant, 'id' | 'isVerified' | 'managerId'>): Restaurant => {
    if (!currentManager) {
      throw new Error('No venue manager logged in');
    }

    const newRestaurant: Restaurant = {
      ...restaurantData,
      id: `rest-${Date.now()}`,
      isVerified: true, // Auto-verify for demo purposes
      managerId: currentManager.id,
    };
    setRestaurants([...restaurants, newRestaurant]);
    return newRestaurant;
  };

  const updateRestaurant = (id: string, updates: Partial<Restaurant>) => {
    setRestaurants(restaurants.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const deleteRestaurant = (id: string) => {
    setRestaurants(restaurants.filter(r => r.id !== id));
  };

  // Filter restaurants to only show those belonging to current manager
  const managerRestaurants = currentManager
    ? restaurants.filter(r => r.managerId === currentManager.id)
    : restaurants;

  return (
    <VenueContext.Provider value={{
      restaurants: managerRestaurants,
      currentManager,
      addRestaurant,
      updateRestaurant,
      deleteRestaurant,
      loginVenueManager,
      registerVenueManager,
      logoutVenueManager,
    }}>
      {children}
    </VenueContext.Provider>
  );
}

export function useVenue() {
  const context = useContext(VenueContext);
  if (!context) {
    throw new Error('useVenue must be used within a VenueProvider');
  }
  return context;
}