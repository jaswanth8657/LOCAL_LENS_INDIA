export type VerificationStatus = 'VERIFIED' | 'ESTIMATED' | 'UNAVAILABLE';

export type TravelGroup = 'Solo' | 'Duo' | 'Family' | 'Friends';

export type TravelInterest =
  | 'food'
  | 'culture'
  | 'nature'
  | 'shopping'
  | 'beaches'
  | 'adventure'
  | 'history'
  | 'photography';

export interface Destination {
  id: string;
  slug?: string;
  name: string;
  state: string;
  region: 'North' | 'South' | 'East' | 'West' | 'North-East' | 'Central';
  tagline: string;
  description: string;
  imageUrl: string;
  bestTimeToVisit: string;
  averageDailyBudgetInr: number;
  latitude: number;
  longitude: number;
  popularCategories: TravelInterest[];
  verifiedStatus: VerificationStatus;
  placesCount?: number;
  isExternal?: boolean;
  resultType?: string;
  provenanceLabel?: string;
}

export interface Place {
  id: string;
  destinationId: string;
  name: string;
  category: TravelInterest | 'stay' | 'dining' | 'heritage' | 'market';
  subcategory?: string;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
  priceTier: 'Budget' | 'Moderate' | 'Premium' | 'Luxury';
  typicalCostInr?: number;
  ticketPriceInr?: number;
  openingHours?: string;
  rating?: number;
  reviewsCount?: number;
  matchScore?: number;
  matchReason?: string;
  distanceKm?: number;
  matchedInterests?: string[];
  scoringComponents?: Record<string, number>;
  
  // Data Provenance & Verification
  dataSource: string; // e.g., 'OpenStreetMap Overpass API', 'Nominatim'
  sourceRecordId?: string;
  sourceUrl?: string;
  verificationStatus: VerificationStatus;
  lastVerifiedAt: string;

  // Real-Time Image & Attribution (Phase 14)
  imageUrl?: string;
  imageAuthor?: string;
  imageLicense?: string;
  imageLicenseUrl?: string;
  imageSourceUrl?: string;
  imageProvenance?: string;
  wikiExtract?: string;
}

export interface UserPreferences {
  destination: string;
  destinationName?: string;
  interests: TravelInterest[];
  budgetPerDay: number;
  groupType: TravelGroup;
  groupSize?: number;
  durationDays: number;
}

export interface ItineraryStop {
  id: string;
  stopOrder: number;
  timeSlot: 'Morning' | 'Afternoon' | 'Evening' | 'Night';
  time: string;
  placeId?: string;
  placeName: string;
  category: string;
  durationMinutes: number;
  costInr: number;
  costStatus: VerificationStatus;
  localTips: string;
  transportToNext?: string;
  latitude?: number;
  longitude?: number;
}

export interface ItineraryDay {
  dayNumber: number;
  theme: string;
  date?: string;
  stops: ItineraryStop[];
  dayEstimatedCostInr: number;
}

export interface ExpenseBreakdown {
  accommodation: number;
  foodDining: number;
  localTransport: number;
  sightseeingTickets: number;
  bufferContingency: number;
  totalPerDay: number;
  totalTrip: number;
  isVerifiedBasis: boolean;
}

export interface Itinerary {
  id: string;
  title: string;
  destinationName: string;
  groupType: TravelGroup;
  durationDays: number;
  dailyBudgetInr: number;
  totalBudgetInr: number;
  createdAt: string;
  aiProviderUsed?: 'GEMINI' | 'OLLAMA' | 'DETERMINISTIC' | 'Gemini' | 'Ollama' | 'Deterministic Non-AI' | string;
  fallbackChain?: string[];
  notes?: string;
  coverageWarning?: string;
  days: ItineraryDay[];
  expenses: ExpenseBreakdown;
}

export type VoiceLanguage = 'en-IN' | 'hi-IN' | 'te-IN';

export interface VoiceState {
  isRecording: boolean;
  isProcessing: boolean;
  transcript: string;
  selectedLanguage: VoiceLanguage;
  permissionGranted: boolean | null;
  errorMessage: string | null;
}

