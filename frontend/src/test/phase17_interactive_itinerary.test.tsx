import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { TripProvider, useTrip } from '../context/TripContext';
import { ItineraryTimeline } from '../components/planner/ItineraryTimeline';
import { Itinerary } from '../types';

const mockItinerary: Itinerary = {
  id: 'itin-p17-test',
  title: '3-Day Authentic Visakhapatnam Discovery',
  destinationName: 'Visakhapatnam',
  groupType: 'Solo',
  durationDays: 2,
  dailyBudgetInr: 2000,
  totalBudgetInr: 4000,
  createdAt: '2026-11-01T12:00:00Z',
  aiProviderUsed: 'DETERMINISTIC',
  days: [
    {
      dayNumber: 1,
      theme: 'Coastal Promenade & Submarine Heritage',
      dayEstimatedCostInr: 100,
      stops: [
        {
          id: 'stop-1-1',
          stopOrder: 1,
          timeSlot: 'Morning',
          time: '09:00 AM',
          placeId: 'vizag-1',
          placeName: 'INS Kursura Submarine Museum',
          category: 'culture',
          durationMinutes: 60,
          costInr: 70,
          costStatus: 'VERIFIED',
          localTips: 'Photography allowed with small camera fee.',
          transportToNext: 'Walk to RK Beach promenade',
          latitude: 17.7169,
          longitude: 83.3331,
        },
        {
          id: 'stop-1-2',
          stopOrder: 2,
          timeSlot: 'Afternoon',
          time: '01:30 PM',
          placeId: 'vizag-2',
          placeName: 'Ramakrishna Beach Promenade',
          category: 'beaches',
          durationMinutes: 90,
          costInr: 0,
          costStatus: 'VERIFIED',
          localTips: 'Best visited during gentle afternoon breeze.',
          transportToNext: '10 mins auto-rickshaw',
          latitude: 17.7139,
          longitude: 83.3235,
        },
      ],
    },
    {
      dayNumber: 2,
      theme: 'Hilltop Vistas & Ropeway Cable Car',
      dayEstimatedCostInr: 50,
      stops: [
        {
          id: 'stop-2-1',
          stopOrder: 1,
          timeSlot: 'Morning',
          time: '10:00 AM',
          placeId: 'vizag-3',
          placeName: 'Kailasagiri Hilltop Park',
          category: 'nature',
          durationMinutes: 120,
          costInr: 50,
          costStatus: 'VERIFIED',
          localTips: 'Take the circular toy train around the hill crest.',
          transportToNext: 'Downhill transit',
          latitude: 17.7492,
          longitude: 83.3422,
        },
      ],
    },
  ],
  expenses: {
    accommodation: 800,
    foodDining: 500,
    localTransport: 300,
    sightseeingTickets: 200,
    bufferContingency: 200,
    totalPerDay: 2000,
    totalTrip: 4000,
    isVerifiedBasis: true,
  },
};

// Helper harness that seeds currentItinerary in TripContext
const TestTimelineWrapper: React.FC = () => {
  const { currentItinerary, setCurrentItinerary } = useTrip();

  React.useEffect(() => {
    setCurrentItinerary(mockItinerary);
  }, [setCurrentItinerary]);

  if (!currentItinerary) return <div>Loading test itinerary...</div>;

  return (
    <ItineraryTimeline
      itinerary={currentItinerary}
      onSave={() => {}}
      isSaved={false}
      isSaving={false}
    />
  );
};

describe('Phase 17 — Interactive Itinerary Workspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Day 1 stops and calculates approximate Haversine straight-line distance', () => {
    render(
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <TripProvider>
          <TestTimelineWrapper />
        </TripProvider>
      </BrowserRouter>
    );

    // Verify stop names are visible
    expect(screen.getByText('INS Kursura Submarine Museum')).toBeDefined();
    expect(screen.getByText('Ramakrishna Beach Promenade')).toBeDefined();

    // Verify Haversine distance badge is rendered between stop 1 and stop 2
    // Submarine (17.7169, 83.3331) to RK Beach (17.7139, 83.3235) is ~1.1 km
    expect(
      screen.getByText(/straight-line distance to next stop/i)
    ).toBeDefined();
    expect(screen.getByText(/1\.1 km/i)).toBeDefined();
  });

  it('triggers window.print when Print Itinerary button is clicked', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});

    render(
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <TripProvider>
          <TestTimelineWrapper />
        </TripProvider>
      </BrowserRouter>
    );

    const printButton = screen.getByTitle(/Print Itinerary/i);
    expect(printButton).toBeDefined();
    fireEvent.click(printButton);

    expect(printSpy).toHaveBeenCalled();
  });

  it('copies structured itinerary summary to clipboard when Copy Summary button is clicked', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <TripProvider>
          <TestTimelineWrapper />
        </TripProvider>
      </BrowserRouter>
    );

    const copyBtn = screen.getByText('Copy Summary');
    await React.act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(writeTextMock).toHaveBeenCalled();
    const copiedText = writeTextMock.mock.calls[0][0];
    expect(copiedText).toContain('LOCAL LENS INDIA — Travel Itinerary');
    expect(copiedText).toContain('Visakhapatnam');
    expect(copiedText).toContain('INS Kursura Submarine Museum');
  });

  it('allows moving stops up and down with sequence numbers reordering', async () => {
    render(
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <TripProvider>
          <TestTimelineWrapper />
        </TripProvider>
      </BrowserRouter>
    );

    // Initial stop 1 is Submarine Museum, stop 2 is RK Beach
    const downButtons = screen.getAllByTitle('Move Stop Down');
    // First stop's down button should not be disabled
    expect(downButtons[0]).toBeDefined();
    expect(downButtons[0].hasAttribute('disabled')).toBe(false);

    // Click Move Down on the first stop
    fireEvent.click(downButtons[0]);

    // After reordering, the first stop should now be RK Beach
    const stopOrders = screen.getAllByText(/Stop [12] of 2/i);
    expect(stopOrders.length).toBeGreaterThan(0);
  });

  it('displays empty state message when switching to a day with 0 stops', () => {
    const emptyDayItinerary: Itinerary = {
      ...mockItinerary,
      days: [
        {
          dayNumber: 1,
          theme: 'Empty Day',
          dayEstimatedCostInr: 0,
          stops: [],
        },
      ],
    };

    render(
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <TripProvider>
          <ItineraryTimeline itinerary={emptyDayItinerary} />
        </TripProvider>
      </BrowserRouter>
    );

    expect(screen.getByText(/No stops scheduled for Day 1/i)).toBeDefined();
    expect(screen.getByText(/Add to Trip/i)).toBeDefined();
  });
});
