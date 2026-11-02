import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TripProvider, useTrip } from '../context/TripContext';
import { DestinationCard } from '../components/discovery/DestinationCard';
import { PlaceCard } from '../components/recommendations/PlaceCard';
import { DiscoverPage } from '../pages/DiscoverPage';
import { RecommendationsPage } from '../pages/RecommendationsPage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Destination, Place } from '../types';

const mockDestination: Destination = {
  id: 'visakhapatnam',
  name: 'Visakhapatnam',
  state: 'Andhra Pradesh',
  region: 'South',
  tagline: 'The Jewel of the East Coast',
  description: 'A vibrant coastal gem nestled between Eastern Ghats.',
  imageUrl: 'https://example.com/vizag.jpg',
  bestTimeToVisit: 'October to March',
  averageDailyBudgetInr: 1800,
  latitude: 17.6868,
  longitude: 83.2185,
  popularCategories: ['beaches', 'culture'],
  verifiedStatus: 'VERIFIED',
  placesCount: 22,
};

const mockPlace: Place = {
  id: 'vizag-1',
  destinationId: 'visakhapatnam',
  name: 'INS Kursura Submarine Museum',
  category: 'history',
  subcategory: 'Maritime Museum',
  description: 'Decommissioned Kalvari-class submarine preserved on RK Beach.',
  address: 'RK Beach Road, Visakhapatnam',
  latitude: 17.7164,
  longitude: 83.3331,
  priceTier: 'Budget',
  ticketPriceInr: 70,
  openingHours: '2:00 PM – 8:30 PM',
  matchScore: 96,
  dataSource: 'OpenStreetMap',
  verificationStatus: 'VERIFIED',
  lastVerifiedAt: '2026-10-30',
};

// Helper consumer to test TripContext added places & duplicate prevention
const TripConsumer = () => {
  const { addedPlaces, addPlaceToTrip, removePlaceFromTrip, isPlaceInTrip } = useTrip();
  return (
    <div>
      <span data-testid="added-count">{addedPlaces.length}</span>
      <span data-testid="is-in-trip">{isPlaceInTrip('vizag-1') ? 'yes' : 'no'}</span>
      <button
        data-testid="add-btn"
        onClick={() => addPlaceToTrip(mockPlace)}
      >
        Add Spot
      </button>
      <button
        data-testid="remove-btn"
        onClick={() => removePlaceFromTrip('vizag-1')}
      >
        Remove Spot
      </button>
    </div>
  );
};

describe('Phase 10C: UI Polish, Integration & Demo Readiness', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    localStorage.clear();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  it('Part 4: DestinationCard renders dynamic placesCount badge', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <TripProvider>
          <DestinationCard destination={mockDestination} />
        </TripProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('22 Local Spots')).toBeDefined();
    expect(screen.getByText('Visakhapatnam')).toBeDefined();
    expect(screen.getByText('Andhra Pradesh')).toBeDefined();
  });

  it('Part 4 Regression: DestinationCard renders genuine zero count as 0 Local Spots', () => {
    const zeroDestination: Destination = {
      ...mockDestination,
      id: 'empty-city',
      name: 'Empty City',
      placesCount: 0,
    };

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <TripProvider>
          <DestinationCard destination={zeroDestination} />
        </TripProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('0 Local Spots')).toBeDefined();
  });

  it('Part 4 Regression: DestinationCard renders neutral unavailable state when placesCount is missing', () => {
    const missingCountDestination: Destination = {
      ...mockDestination,
      id: 'missing-city',
      name: 'Missing City',
      placesCount: undefined,
    };

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <TripProvider>
          <DestinationCard destination={missingCountDestination} />
        </TripProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('Spots unavailable')).toBeDefined();
  });

  it('Part 3 Regression: RecommendationsPage renders revised non-misleading provenance filter labels', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <TripProvider>
            <RecommendationsPage />
          </TripProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Verify revised labels exist
    expect(screen.getByText('All Places')).toBeDefined();
    expect(screen.getByText('Source-Backed Coordinates')).toBeDefined();
    expect(screen.getByText('Known Ticket Fee')).toBeDefined();
    expect(screen.getByText('Fee Unavailable')).toBeDefined();

    // Verify misleading label "All Verified Places" is NOT present
    expect(screen.queryByText('All Verified Places')).toBeNull();
    expect(screen.queryByText('Fee Unavailable (N/A)')).toBeNull();
  });

  it('Part 2: TripContext prevents duplicate additions and updates addedPlaces correctly', () => {
    render(
      <TripProvider>
        <TripConsumer />
      </TripProvider>
    );

    expect(screen.getByTestId('added-count').textContent).toBe('0');
    expect(screen.getByTestId('is-in-trip').textContent).toBe('no');

    // First addition
    fireEvent.click(screen.getByTestId('add-btn'));
    expect(screen.getByTestId('added-count').textContent).toBe('1');
    expect(screen.getByTestId('is-in-trip').textContent).toBe('yes');

    // Duplicate addition should be prevented
    fireEvent.click(screen.getByTestId('add-btn'));
    expect(screen.getByTestId('added-count').textContent).toBe('1');

    // Removal
    fireEvent.click(screen.getByTestId('remove-btn'));
    expect(screen.getByTestId('added-count').textContent).toBe('0');
    expect(screen.getByTestId('is-in-trip').textContent).toBe('no');
  });

  it('Part 2: PlaceCard toggles Add to Trip and In Itinerary label with correct styling', () => {
    const onAdd = vi.fn();
    const onViewMap = vi.fn();

    const { rerender } = render(
      <PlaceCard
        place={mockPlace}
        onAddToItinerary={onAdd}
        onViewOnMap={onViewMap}
        isAddedToItinerary={false}
      />
    );

    // Initial state: Add to Trip
    const addBtn = screen.getByText('Add to Trip');
    expect(addBtn).toBeDefined();
    fireEvent.click(addBtn);
    expect(onAdd).toHaveBeenCalledWith(mockPlace);

    // Rerender as added
    rerender(
      <PlaceCard
        place={mockPlace}
        onAddToItinerary={onAdd}
        onViewOnMap={onViewMap}
        isAddedToItinerary={true}
      />
    );
    expect(screen.getByText('In Itinerary')).toBeDefined();

    // Map location button
    const mapBtn = screen.getByText('Map Location');
    fireEvent.click(mapBtn);
    expect(onViewMap).toHaveBeenCalledWith(mockPlace);
  });

  it('Part 2: DiscoverPage pre-fills and synchronizes search from URL query parameter', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/discover?q=Jaipur']}>
          <TripProvider>
            <DiscoverPage />
          </TripProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    const searchInput = screen.getByPlaceholderText('Search by city name, state, or key terrain...') as HTMLInputElement;
    expect(searchInput.value).toBe('Jaipur');
  });
});
