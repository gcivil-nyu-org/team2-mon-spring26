export interface Restaurant {
  id: string;
  name: string;
  cuisine: string[];
  sanitationGrade: 'A' | 'B' | 'C' | 'N' | 'P' | 'Z';
  images: string[];
  badges: string[];
  address: string;
  inspectionDate: string;
  violations?: string[];
  menuLink?: string;
  notes?: string;
  latitude: number;
  longitude: number;
  distance: string; // e.g. "0.3 mi"
  cost: '$' | '$$' | '$$$'; // price range
  hasGroupSeating: boolean;
  hasStudentDiscount: boolean;
  studentDiscountAmount?: string; // e.g. "10%", "15%"
  rating: number; // 1-5 stars
  reviewCount: number;
  healthInspection?: {
    grade: 'A' | 'B' | 'C' | 'N' | 'P' | 'Z';
    score: number; // 0-100, lower is better
    inspectionDate: string;
    violations: Array<{
      type: string;
      description: string;
      severity: 'critical' | 'major' | 'minor';
    }>;
  };
  neighborhood?: string;
  seatingCapacity?: number | null;
  hasTakeout?: boolean;
  hasDelivery?: boolean;
  hasDineIn?: boolean;
  isReservable?: boolean;
  googleMapsUrl?: string;
  hours?: Record<string, string>;
}

export const mockRestaurants: Restaurant[] = [
  {
    id: '1',
    name: 'Taïm',
    cuisine: ['Mediterranean', 'Falafel', 'Vegetarian'],
    sanitationGrade: 'A',
    images: [
      'https://images.unsplash.com/photo-1768849352399-86a2fdbe226a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtZWRpdGVycmFuZWFuJTIwZmFsYWZlbCUyMHBsYXRlfGVufDF8fHx8MTc3MDE0NjEzNXww&ixlib=rb-4.1.0&q=80&w=1080',
      'https://images.unsplash.com/photo-1768849352399-86a2fdbe226a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtZWRpdGVycmFuZWFuJTIwZmFsYWZlbCUyMHBsYXRlfGVufDF8fHx8MTc3MDE0NjEzNXww&ixlib=rb-4.1.0&q=80&w=1080',
      'https://images.unsplash.com/photo-1768849352399-86a2fdbe226a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtZWRpdGVycmFuZWFuJTIwZmFsYWZlbCUyMHBsYXRlfGVufDF8fHx8MTc3MDE0NjEzNXww&ixlib=rb-4.1.0&q=80&w=1080'
    ],
    badges: ['Vegan Friendly', 'Student Discount 10%', 'Group Seating'],
    address: '222 Waverly Pl, New York, NY 10014',
    inspectionDate: '2025-12-15',
    violations: [],
    menuLink: 'https://taimfalafel.com',
    notes: 'Popular with NYU students. Cash and card accepted.',
    latitude: 40.7308,
    longitude: -73.9973,
    distance: '0.2 mi',
    cost: '$$',
    hasGroupSeating: true,
    hasStudentDiscount: true,
    studentDiscountAmount: '10%',
    rating: 4.5,
    reviewCount: 120,
    healthInspection: {
      grade: 'A',
      score: 10,
      inspectionDate: '2025-12-15',
      violations: []
    }
  },
  {
    id: '2',
    name: 'Joe\'s Pizza',
    cuisine: ['Italian', 'Pizza'],
    sanitationGrade: 'A',
    images: [
      'https://images.unsplash.com/photo-1551575485-6f27456fb86b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxuZXclMjB5b3JrJTIwcGl6emElMjBzbGljZXxlbnwxfHx8fDE3NzAxNDYxMzV8MA&ixlib=rb-4.1.0&q=80&w=1080',
      'https://images.unsplash.com/photo-1551575485-6f27456fb86b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxuZXclMjB5b3JrJTIwcGl6emElMjBzbGljZXxlbnwxfHx8fDE3NzAxNDYxMzV8MA&ixlib=rb-4.1.0&q=80&w=1080',
      'https://images.unsplash.com/photo-1551575485-6f27456fb86b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxuZXclMjB5b3JrJTIwcGl6emElMjBzbGljZXxlbnwxfHx8fDE3NzAxNDYxMzV8MA&ixlib=rb-4.1.0&q=80&w=1080'
    ],
    badges: ['NYU Classic', 'Quick Service', 'Late Night'],
    address: '7 Carmine St, New York, NY 10014',
    inspectionDate: '2026-01-10',
    violations: [],
    menuLink: 'https://joespizzanyc.com',
    notes: 'Famous NYC slice shop. Cash only.',
    latitude: 40.7303,
    longitude: -74.0022,
    distance: '0.3 mi',
    cost: '$',
    hasGroupSeating: false,
    hasStudentDiscount: false,
    rating: 4.8,
    reviewCount: 200,
    healthInspection: {
      grade: 'A',
      score: 5,
      inspectionDate: '2026-01-10',
      violations: []
    }
  },
  {
    id: '3',
    name: 'Mamoun\'s Falafel',
    cuisine: ['Middle Eastern', 'Halal', 'Vegetarian'],
    sanitationGrade: 'A',
    images: [
      'https://images.unsplash.com/photo-1611107517117-e5f1b0c898bf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmYWxhZmVsJTIwd3JhcCUyMHBsYXRlfGVufDF8fHx8MTc3MDE0NjEzNnww&ixlib=rb-4.1.0&q=80&w=1080',
      'https://images.unsplash.com/photo-1611107517117-e5f1b0c898bf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmYWxhZmVsJTIwd3JhcCUyMHBsYXRlfGVufDF8fHx8MTc3MDE0NjEzNnww&ixlib=rb-4.1.0&q=80&w=1080',
      'https://images.unsplash.com/photo-1611107517117-e5f1b0c898bf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmYWxhZmVsJTIwd3JhcCUyMHBsYXRlfGVufDF8fHx8MTc3MDE0NjEzNnww&ixlib=rb-4.1.0&q=80&w=1080'
    ],
    badges: ['Halal', 'Vegan Friendly', 'Student Favorite', 'Budget Friendly'],
    address: '119 MacDougal St, New York, NY 10012',
    inspectionDate: '2025-11-22',
    violations: [],
    menuLink: 'https://mamouns.com',
    notes: 'Open late. Legendary falafel since 1971.',
    latitude: 40.7298,
    longitude: -74.0003,
    distance: '0.4 mi',
    cost: '$',
    hasGroupSeating: false,
    hasStudentDiscount: true,
    studentDiscountAmount: '10%',
    rating: 4.7,
    reviewCount: 150,
    healthInspection: {
      grade: 'A',
      score: 10,
      inspectionDate: '2025-11-22',
      violations: []
    }
  },
  {
    id: '4',
    name: 'Bareburger',
    cuisine: ['American', 'Burgers', 'Organic'],
    sanitationGrade: 'A',
    images: [
      'https://images.unsplash.com/photo-1761315412811-4525e421e00b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnb3VybWV0JTIwYnVyZ2VyJTIwZnJpZXN8ZW58MXx8fHwxNzcwMTE0MzMyfDA&ixlib=rb-4.1.0&q=80&w=1080',
      'https://images.unsplash.com/photo-1761315412811-4525e421e00b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnb3VybWV0JTIwYnVyZ2VyJTIwZnJpZXN8ZW58MXx8fHwxNzcwMTE0MzMyfDA&ixlib=rb-4.1.0&q=80&w=1080',
      'https://images.unsplash.com/photo-1761315412811-4525e421e00b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnb3VybWV0JTIwYnVyZ2VyJTIwZnJpZXN8ZW58MXx8fHwxNzcwMTE0MzMyfDA&ixlib=rb-4.1.0&q=80&w=1080'
    ],
    badges: ['Vegetarian Options', 'Halal', 'Group Seating', 'Student Discount 15%'],
    address: '85 2nd Ave, New York, NY 10003',
    inspectionDate: '2026-01-05',
    violations: [],
    menuLink: 'https://bareburger.com',
    notes: 'Organic burgers with multiple protein options including plant-based.',
    latitude: 40.7263,
    longitude: -73.9872,
    distance: '0.5 mi',
    cost: '$$',
    hasGroupSeating: true,
    hasStudentDiscount: true,
    studentDiscountAmount: '15%',
    rating: 4.6,
    reviewCount: 100,
    healthInspection: {
      grade: 'A',
      score: 15,
      inspectionDate: '2026-01-05',
      violations: []
    }
  },
  {
    id: '5',
    name: 'Veselka',
    cuisine: ['Ukrainian', 'Eastern European', 'Comfort Food'],
    sanitationGrade: 'A',
    images: [
      'https://images.unsplash.com/photo-1686998423980-ab223d183055?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwaWVyb2dpZXMlMjBzb3VyJTIwY3JlYW18ZW58MXx8fHwxNzcwMTQ2MTM3fDA&ixlib=rb-4.1.0&q=80&w=1080',
      'https://images.unsplash.com/photo-1686998423980-ab223d183055?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwaWVyb2dpZXMlMjBzb3VyJTIwY3JlYW18ZW58MXx8fHwxNzcwMTQ2MTM3fDA&ixlib=rb-4.1.0&q=80&w=1080',
      'https://images.unsplash.com/photo-1686998423980-ab223d183055?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwaWVyb2dpZXMlMjBzb3VyJTIwY3JlYW18ZW58MXx8fHwxNzcwMTQ2MTM3fDA&ixlib=rb-4.1.0&q=80&w=1080'
    ],
    badges: ['24/7 Open', 'Vegetarian Options', 'Group Seating', 'NYU Institution'],
    address: '144 2nd Ave, New York, NY 10003',
    inspectionDate: '2025-12-28',
    violations: [],
    menuLink: 'https://veselka.com',
    notes: 'Open 24 hours. Ukrainian comfort food.',
    latitude: 40.7287,
    longitude: -73.9866,
    distance: '0.6 mi',
    cost: '$$',
    hasGroupSeating: true,
    hasStudentDiscount: false,
    rating: 4.4,
    reviewCount: 80,
    healthInspection: {
      grade: 'A',
      score: 20,
      inspectionDate: '2025-12-28',
      violations: []
    }
  },
  {
    id: '6',
    name: 'Xi\'an Famous Foods',
    cuisine: ['Chinese', 'Noodles', 'Spicy'],
    sanitationGrade: 'A',
    images: [
      'https://images.unsplash.com/photo-1679279726940-be5ce80c632c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoYW5kJTIwcHVsbGVkJTIwbm9vZGxlcyUyMHNwaWN5fGVufDF8fHx8MTc3MDE0NjEzN3ww&ixlib=rb-4.1.0&q=80&w=1080',
      'https://images.unsplash.com/photo-1679279726940-be5ce80c632c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoYW5kJTIwcHVsbGVkJTIwbm9vZGxlcyUyMHNwaWN5fGVufDF8fHx8MTc3MDE0NjEzN3ww&ixlib=rb-4.1.0&q=80&w=1080',
      'https://images.unsplash.com/photo-1679279726940-be5ce80c632c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoYW5kJTIwcHVsbGVkJTIwbm9vZGxlcyUyMHNwaWN5fGVufDF8fHx8MTc3MDE0NjEzN3ww&ixlib=rb-4.1.0&q=80&w=1080'
    ],
    badges: ['Spicy Options', 'Quick Service', 'Budget Friendly'],
    address: '67 Bayard St, New York, NY 10013',
    inspectionDate: '2025-10-30',
    violations: ['Minor violation: Storage of food items'],
    menuLink: 'https://xianfoods.com',
    notes: 'Hand-pulled noodles. Can be very spicy.',
    latitude: 40.7154,
    longitude: -73.9987,
    distance: '0.7 mi',
    cost: '$',
    hasGroupSeating: false,
    hasStudentDiscount: false,
    rating: 4.3,
    reviewCount: 70,
    healthInspection: {
      grade: 'A',
      score: 25,
      inspectionDate: '2025-10-30',
      violations: [
        {
          type: 'Storage of food items',
          description: 'Food items not properly stored.',
          severity: 'minor'
        }
      ]
    }
  },
  {
    id: '7',
    name: 'by CHLOE.',
    cuisine: ['Vegan', 'American', 'Plant-Based'],
    sanitationGrade: 'A',
    images: [
      'https://images.unsplash.com/photo-1630927575947-0506e3328fbe?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx2ZWdhbiUyMGJ1cmdlciUyMGF2b2NhZG98ZW58MXx8fHwxNzcwMTQ2MTM4fDA&ixlib=rb-4.1.0&q=80&w=1080',
      'https://images.unsplash.com/photo-1630927575947-0506e3328fbe?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx2ZWdhbiUyMGJ1cmdlciUyMGF2b2NhZG98ZW58MXx8fHwxNzcwMTQ2MTM4fDA&ixlib=rb-4.1.0&q=80&w=1080',
      'https://images.unsplash.com/photo-1630927575947-0506e3328fbe?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx2ZWdhbiUyMGJ1cmdlciUyMGF2b2NhZG98ZW58MXx8fHwxNzcwMTQ2MTM4fDA&ixlib=rb-4.1.0&q=80&w=1080'
    ],
    badges: ['Fully Vegan', 'Instagram Worthy', 'Group Seating'],
    address: '185 Bleecker St, New York, NY 10012',
    inspectionDate: '2026-01-18',
    violations: [],
    menuLink: 'https://eatbychloe.com',
    notes: '100% plant-based menu. Great for dietary restrictions.',
    latitude: 40.7287,
    longitude: -74.0007,
    distance: '0.8 mi',
    cost: '$$',
    hasGroupSeating: true,
    hasStudentDiscount: false,
    rating: 4.2,
    reviewCount: 60,
    healthInspection: {
      grade: 'A',
      score: 30,
      inspectionDate: '2026-01-18',
      violations: []
    }
  },
  {
    id: '8',
    name: 'Artichoke Basille\'s Pizza',
    cuisine: ['Italian', 'Pizza'],
    sanitationGrade: 'B',
    images: [
      'https://images.unsplash.com/photo-1564271822403-0e2f9f11b16e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhcnRpY2hva2UlMjBwaXp6YSUyMHNsaWNlfGVufDF8fHx8MTc3MDE0NjEzOHww&ixlib=rb-4.1.0&q=80&w=1080',
      'https://images.unsplash.com/photo-1564271822403-0e2f9f11b16e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhcnRpY2hva2UlMjBwaXp6YSUyMHNsaWNlfGVufDF8fHx8MTc3MDE0NjEzOHww&ixlib=rb-4.1.0&q=80&w=1080',
      'https://images.unsplash.com/photo-1564271822403-0e2f9f11b16e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhcnRpY2hva2UlMjBwaXp6YSUyMHNsaWNlfGVufDF8fHx8MTc3MDE0NjEzOHww&ixlib=rb-4.1.0&q=80&w=1080'
    ],
    badges: ['Late Night', 'NYU Favorite', 'Unique Menu'],
    address: '328 E 14th St, New York, NY 10003',
    inspectionDate: '2025-09-14',
    violations: ['Food temperature', 'Facility maintenance'],
    menuLink: 'https://artichokepizza.com',
    notes: 'Famous artichoke slice. Open late on weekends.',
    latitude: 40.7314,
    longitude: -73.9820,
    distance: '0.9 mi',
    cost: '$',
    hasGroupSeating: false,
    hasStudentDiscount: false,
    rating: 4.1,
    reviewCount: 50,
    healthInspection: {
      grade: 'B',
      score: 35,
      inspectionDate: '2025-09-14',
      violations: [
        {
          type: 'Food temperature',
          description: 'Food not served at proper temperature.',
          severity: 'major'
        },
        {
          type: 'Facility maintenance',
          description: 'Facility not properly maintained.',
          severity: 'major'
        }
      ]
    }
  },
  {
    id: '9',
    name: 'Num Pang',
    cuisine: ['Cambodian', 'Sandwiches', 'Asian Fusion'],
    sanitationGrade: 'A',
    images: [
      'https://images.unsplash.com/photo-1571917411767-20545014a0bc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiYW5oJTIwbWklMjBzYW5kd2ljaCUyMGFzaWFufGVufDF8fHx8MTc3MDE0NjEzOXww&ixlib=rb-4.1.0&q=80&w=1080',
      'https://images.unsplash.com/photo-1571917411767-20545014a0bc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiYW5oJTIwbWklMjBzYW5kd2ljaCUyMGFzaWFufGVufDF8fHx8MTc3MDE0NjEzOXww&ixlib=rb-4.1.0&q=80&w=1080',
      'https://images.unsplash.com/photo-1571917411767-20545014a0bc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiYW5oJTIwbWklMjBzYW5kd2ljaCUyMGFzaWFufGVufDF8fHx8MTc3MDE0NjEzOXww&ixlib=rb-4.1.0&q=80&w=1080'
    ],
    badges: ['Quick Service', 'Unique Flavors', 'Halal'],
    address: '140 E 41st St, New York, NY 10017',
    inspectionDate: '2025-11-05',
    violations: [],
    menuLink: 'https://numpangkitchen.com',
    notes: 'Cambodian-style sandwiches. Fresh ingredients.',
    latitude: 40.7505,
    longitude: -73.9765,
    distance: '1.0 mi',
    cost: '$',
    hasGroupSeating: false,
    hasStudentDiscount: false,
    rating: 4.0,
    reviewCount: 40,
    healthInspection: {
      grade: 'A',
      score: 40,
      inspectionDate: '2025-11-05',
      violations: []
    }
  },
  {
    id: '10',
    name: 'Dig Inn',
    cuisine: ['American', 'Healthy', 'Farm-to-Table'],
    sanitationGrade: 'A',
    images: [
      'https://images.unsplash.com/photo-1644704170910-a0cdf183649b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoZWFsdGh5JTIwZ3JhaW4lMjBib3dsJTIwdmVnZXRhYmxlc3xlbnwxfHx8fDE3NzAxMTY5NDN8MA&ixlib=rb-4.1.0&q=80&w=1080',
      'https://images.unsplash.com/photo-1644704170910-a0cdf183649b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoZWFsdGh5JTIwZ3JhaW4lMjBib3dsJTIwdmVnZXRhYmxlc3xlbnwxfHx8fDE3NzAxMTY5NDN8MA&ixlib=rb-4.1.0&q=80&w=1080',
      'https://images.unsplash.com/photo-1644704170910-a0cdf183649b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoZWFsdGh5JTIwZ3JhaW4lMjBib3dsJTIwdmVnZXRhYmxlc3xlbnwxfHx8fDE3NzAxMTY5NDN8MA&ixlib=rb-4.1.0&q=80&w=1080'
    ],
    badges: ['Healthy Options', 'Vegetarian Friendly', 'Quick Service', 'Student Discount 10%'],
    address: '80 E 8th St, New York, NY 10003',
    inspectionDate: '2026-01-20',
    violations: [],
    menuLink: 'https://diginn.com',
    notes: 'Build your own bowls. Seasonal vegetables.',
    latitude: 40.7297,
    longitude: -73.9925,
    distance: '1.1 mi',
    cost: '$$',
    hasGroupSeating: false,
    hasStudentDiscount: true,
    studentDiscountAmount: '10%',
    rating: 3.9,
    reviewCount: 30,
    healthInspection: {
      grade: 'A',
      score: 45,
      inspectionDate: '2026-01-20',
      violations: []
    }
  },
  {
    id: '11',
    name: 'The Halal Guys',
    cuisine: ['Middle Eastern', 'Halal', 'Street Food'],
    sanitationGrade: 'A',
    images: [
      'https://images.unsplash.com/photo-1719670712556-638018bd8238?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoYWxhbCUyMGNoaWNrZW4lMjByaWNlJTIwcGxhdHRlcnxlbnwxfHx8fDE3NzAxNDYxMzl8MA&ixlib=rb-4.1.0&q=80&w=1080',
      'https://images.unsplash.com/photo-1719670712556-638018bd8238?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoYWxhbCUyMGNoaWNrZW4lMjByaWNlJTIwcGxhdHRlcnxlbnwxfHx8fDE3NzAxNDYxMzl8MA&ixlib=rb-4.1.0&q=80&w=1080',
      'https://images.unsplash.com/photo-1719670712556-638018bd8238?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoYWxhbCUyMGNoaWNrZW4lMjByaWNlJTIwcGxhdHRlcnxlbnwxfHx8fDE3NzAxNDYxMzl8MA&ixlib=rb-4.1.0&q=80&w=1080'
    ],
    badges: ['Halal', 'Late Night', 'Budget Friendly', 'NYU Classic'],
    address: '307 W 4th St, New York, NY 10014',
    inspectionDate: '2025-12-01',
    violations: [],
    notes: 'Famous street cart turned restaurant. Large portions.',
    latitude: 40.7334,
    longitude: -74.0027,
    distance: '1.2 mi',
    cost: '$',
    hasGroupSeating: false,
    hasStudentDiscount: false,
    rating: 3.8,
    reviewCount: 20,
    healthInspection: {
      grade: 'A',
      score: 50,
      inspectionDate: '2025-12-01',
      violations: []
    }
  },
  {
    id: '12',
    name: 'Sweetgreen',
    cuisine: ['Salads', 'Healthy', 'Organic'],
    sanitationGrade: 'A',
    images: [
      'https://images.unsplash.com/photo-1681330266932-391fd00f805f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmVzaCUyMHNhbGFkJTIwYm93bCUyMGNvbG9yZnVsfGVufDF8fHx8MTc3MDE0NjE0MHww&ixlib=rb-4.1.0&q=80&w=1080',
      'https://images.unsplash.com/photo-1681330266932-391fd00f805f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmVzaCUyMHNhbGFkJTIwYm93bCUyMGNvbG9yZnVsfGVufDF8fHx8MTc3MDE0NjE0MHww&ixlib=rb-4.1.0&q=80&w=1080',
      'https://images.unsplash.com/photo-1681330266932-391fd00f805f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmVzaCUyMHNhbGFkJTIwYm93bCUyMGNvbG9yZnVsfGVufDF8fHx8MTc3MDE0NjE0MHww&ixlib=rb-4.1.0&q=80&w=1080'
    ],
    badges: ['Healthy Options', 'Vegan Friendly', 'Student Discount 10%', 'Group Seating'],
    address: '1164 Broadway, New York, NY 10001',
    inspectionDate: '2026-01-12',
    violations: [],
    menuLink: 'https://sweetgreen.com',
    notes: 'Fresh salads and warm bowls. Seasonal menu.',
    latitude: 40.7453,
    longitude: -73.9882,
    distance: '1.3 mi',
    cost: '$$',
    hasGroupSeating: true,
    hasStudentDiscount: true,
    studentDiscountAmount: '10%',
    rating: 3.7,
    reviewCount: 10,
    healthInspection: {
      grade: 'A',
      score: 55,
      inspectionDate: '2026-01-12',
      violations: []
    }
  },
  {
    id: '13',
    name: 'Superiority Burger',
    cuisine: ['Vegetarian', 'Burgers', 'American'],
    sanitationGrade: 'A',
    images: [
      'https://images.unsplash.com/photo-1626414375188-805f321bd821?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx2ZWdldGFyaWFuJTIwYnVyZ2VyJTIwc2FuZHdpY2h8ZW58MXx8fHwxNzcwMTQ2MTQwfDA&ixlib=rb-4.1.0&q=80&w=1080',
      'https://images.unsplash.com/photo-1626414375188-805f321bd821?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx2ZWdldGFyaWFuJTIwYnVyZ2VyJTIwc2FuZHdpY2h8ZW58MXx8fHwxNzcwMTQ2MTQwfDA&ixlib=rb-4.1.0&q=80&w=1080',
      'https://images.unsplash.com/photo-1626414375188-805f321bd821?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx2ZWdldGFyaWFuJTIwYnVyZ2VyJTIwc2FuZHdpY2h8ZW58MXx8fHwxNzcwMTQ2MTQwfDA&ixlib=rb-4.1.0&q=80&w=1080'
    ],
    badges: ['Fully Vegetarian', 'Cult Favorite', 'Unique Menu'],
    address: '119 Avenue A, New York, NY 10009',
    inspectionDate: '2025-10-18',
    violations: [],
    notes: 'Vegetarian fast food. Minimalist space. Often has a line.',
    latitude: 40.7261,
    longitude: -73.9823,
    distance: '1.4 mi',
    cost: '$',
    hasGroupSeating: false,
    hasStudentDiscount: false,
    rating: 3.6,
    reviewCount: 5,
    healthInspection: {
      grade: 'A',
      score: 60,
      inspectionDate: '2025-10-18',
      violations: []
    }
  },
  {
    id: '14',
    name: 'Raku',
    cuisine: ['Japanese', 'Ramen', 'Udon'],
    sanitationGrade: 'A',
    images: [
      'https://images.unsplash.com/photo-1734313276354-75c96b3c0c36?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyYW1lbiUyMGJvd2wlMjBub29kbGVzJTIwZWdnfGVufDF8fHx8MTc3MDE0NjE0MXww&ixlib=rb-4.1.0&q=80&w=1080',
      'https://images.unsplash.com/photo-1734313276354-75c96b3c0c36?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyYW1lbiUyMGJvd2wlMjBub29kbGVzJTIwZWdnfGVufDF8fHx8MTc3MDE0NjE0MXww&ixlib=rb-4.1.0&q=80&w=1080',
      'https://images.unsplash.com/photo-1734313276354-75c96b3c0c36?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyYW1lbiUyMGJvd2wlMjBub29kbGVzJTIwZWdnfGVufDF8fHx8MTc3MDE0NjE0MXww&ixlib=rb-4.1.0&q=80&w=1080'
    ],
    badges: ['Authentic Japanese', 'Vegetarian Options', 'Group Seating'],
    address: '342 E 6th St, New York, NY 10003',
    inspectionDate: '2025-11-30',
    violations: [],
    menuLink: 'https://rakuudon.com',
    notes: 'Authentic udon in a cozy setting.',
    latitude: 40.7251,
    longitude: -73.9820,
    distance: '1.5 mi',
    cost: '$$',
    hasGroupSeating: true,
    hasStudentDiscount: false,
    rating: 3.5,
    reviewCount: 3,
    healthInspection: {
      grade: 'A',
      score: 65,
      inspectionDate: '2025-11-30',
      violations: []
    }
  },
  {
    id: '15',
    name: 'Two Boots',
    cuisine: ['Pizza', 'Cajun', 'Italian'],
    sanitationGrade: 'B',
    images: [
      'https://images.unsplash.com/photo-1751654888220-3c157ac61550?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzcGVjaWFsdHklMjBwaXp6YSUyMHRvcHBpbmdzfGVufDF8fHx8MTc3MDE0NjE0MXww&ixlib=rb-4.1.0&q=80&w=1080',
      'https://images.unsplash.com/photo-1751654888220-3c157ac61550?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzcGVjaWFsdHklMjBwaXp6YSUyMHRvcHBpbmdzfGVufDF8fHx8MTc3MDE0NjE0MXww&ixlib=rb-4.1.0&q=80&w=1080',
      'https://images.unsplash.com/photo-1751654888220-3c157ac61550?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzcGVjaWFsdHklMjBwaXp6YSUyMHRvcHBpbmdzfGVufDF8fHx8MTc3MDE0NjE0MXww&ixlib=rb-4.1.0&q=80&w=1080'
    ],
    badges: ['Unique Flavors', 'Late Night', 'Vegetarian Options', 'Student Discount 15%'],
    address: '42 Avenue A, New York, NY 10009',
    inspectionDate: '2025-08-22',
    violations: ['Minor plumbing issue', 'Cleanliness of non-food surfaces'],
    menuLink: 'https://twoboots.com',
    notes: 'Cajun-inspired pizza with creative toppings.',
    latitude: 40.7244,
    longitude: -73.9849,
    distance: '1.6 mi',
    cost: '$$',
    hasGroupSeating: false,
    hasStudentDiscount: true,
    studentDiscountAmount: '15%',
    rating: 3.4,
    reviewCount: 2,
    healthInspection: {
      grade: 'B',
      score: 70,
      inspectionDate: '2025-08-22',
      violations: [
        {
          type: 'Minor plumbing issue',
          description: 'Plumbing issue detected.',
          severity: 'minor'
        },
        {
          type: 'Cleanliness of non-food surfaces',
          description: 'Non-food surfaces not clean.',
          severity: 'major'
        }
      ]
    }
  }
];