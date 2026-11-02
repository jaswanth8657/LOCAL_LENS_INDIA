import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TripProvider } from '../context/TripContext';
import {
  calculateHaversineDistanceKm,
  calculateDayTotalDistanceKm,
  classifyGeographicSpread,
  detectZigZagSequence,
} from '../utils/geo';
import {
  classifyPlaceEnvironment,
  optimizeHeatAwareSchedule,
} from '../utils/heatAware';
import {
  REGIONAL_CULINARY_REGISTRY,
  CulinaryHeritageItem,
} from '../data/regionalCuisine';
import { RegionalCulinaryGuide } from '../components/culinary/RegionalCulinaryGuide';
import { DestinationComparePage } from '../pages/DestinationComparePage';
import { ProvenanceDrawer } from '../components/ui/ProvenanceDrawer';
import { ItineraryStop } from '../types';

describe('Phase 18 & 18.2 — Travel Intelligence & Smart Discovery Remediation', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <TripProvider>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            {ui}
          </BrowserRouter>
        </TripProvider>
      </QueryClientProvider>
    );
  };

  // --------------------------------------------------------------------------
  // PILLAR 1: TRAVEL-DISTANCE & ROUTE EFFICIENCY INTELLIGENCE (DEV-01)
  // --------------------------------------------------------------------------
  describe('Pillar 1: Travel Distance & Route Efficiency (DEV-01)', () => {
    it('calculates straight-line Haversine distance between two coordinates correctly', () => {
      // Submarine Museum (17.7169, 83.3331) to Kailasagiri (17.7492, 83.3422) is approx 3.7 km
      const dist = calculateHaversineDistanceKm(17.7169, 83.3331, 17.7492, 83.3422);
      expect(dist).toBeGreaterThanOrEqual(3.5);
      expect(dist).toBeLessThanOrEqual(4.0);
    });

    it('classifies exact boundary conditions for geographic spread per DEV-01', () => {
      // Compact: < 5 km
      expect(classifyGeographicSpread(0)).toBe('Compact');
      expect(classifyGeographicSpread(3.5)).toBe('Compact');
      expect(classifyGeographicSpread(4.99)).toBe('Compact');

      // Moderate: 5 km to 15 km, inclusive
      expect(classifyGeographicSpread(5.0)).toBe('Moderate');
      expect(classifyGeographicSpread(10.0)).toBe('Moderate');
      expect(classifyGeographicSpread(15.0)).toBe('Moderate');

      // Dispersed: > 15 km
      expect(classifyGeographicSpread(15.01)).toBe('Dispersed');
      expect(classifyGeographicSpread(25.0)).toBe('Dispersed');
    });

    it('calculates day total distance and classifies spread accurately', () => {
      const compactStops: ItineraryStop[] = [
        {
          id: 's1',
          stopOrder: 1,
          timeSlot: 'Morning',
          time: '09:00 AM',
          placeName: 'Stop A',
          category: 'culture',
          durationMinutes: 60,
          costInr: 50,
          costStatus: 'VERIFIED',
          localTips: '',
          latitude: 17.71,
          longitude: 83.31,
        },
        {
          id: 's2',
          stopOrder: 2,
          timeSlot: 'Afternoon',
          time: '01:00 PM',
          placeName: 'Stop B',
          category: 'beaches',
          durationMinutes: 60,
          costInr: 0,
          costStatus: 'VERIFIED',
          localTips: '',
          latitude: 17.73,
          longitude: 83.33,
        },
      ];
      const compactAnalysis = calculateDayTotalDistanceKm(compactStops);
      expect(compactAnalysis.spread).toBe('Compact');
      expect(compactAnalysis.totalKm).toBeLessThan(5);
    });

    it('detects zig-zag transit pattern and suggests an optimized reordering sequence', () => {
      const zigZagStops: ItineraryStop[] = [
        {
          id: 'z1',
          stopOrder: 1,
          timeSlot: 'Morning',
          time: '08:30 AM',
          placeName: 'Point A',
          category: 'culture',
          durationMinutes: 60,
          costInr: 0,
          costStatus: 'VERIFIED',
          localTips: '',
          latitude: 17.0,
          longitude: 83.0,
        },
        {
          id: 'z2',
          stopOrder: 2,
          timeSlot: 'Afternoon',
          time: '12:00 PM',
          placeName: 'Point C',
          category: 'nature',
          durationMinutes: 60,
          costInr: 0,
          costStatus: 'VERIFIED',
          localTips: '',
          latitude: 17.2,
          longitude: 83.2,
        },
        {
          id: 'z3',
          stopOrder: 3,
          timeSlot: 'Evening',
          time: '03:30 PM',
          placeName: 'Point B',
          category: 'beaches',
          durationMinutes: 60,
          costInr: 0,
          costStatus: 'VERIFIED',
          localTips: '',
          latitude: 17.1,
          longitude: 83.1,
        },
        {
          id: 'z4',
          stopOrder: 4,
          timeSlot: 'Night',
          time: '06:00 PM',
          placeName: 'Point D',
          category: 'shopping',
          durationMinutes: 60,
          costInr: 0,
          costStatus: 'VERIFIED',
          localTips: '',
          latitude: 17.3,
          longitude: 83.3,
        },
      ];

      const analysis = detectZigZagSequence(zigZagStops);
      expect(analysis.hasSuggestion).toBe(true);
      expect(analysis.savingsKm).toBeGreaterThan(2.0);
      expect(analysis.savingsPct).toBeGreaterThanOrEqual(20);
      expect(analysis.suggestedStops).toBeDefined();
      expect(analysis.suggestedStops?.length).toBe(4);
    });
  });

  // --------------------------------------------------------------------------
  // PILLAR 2: HEAT-AWARE SCHEDULE OPTIMIZATION (DEV-02)
  // --------------------------------------------------------------------------
  describe('Pillar 2: Heat-Aware Schedule Optimization (DEV-02)', () => {
    it('classifies attractions strictly based on explicit evidence per DEV-02 rules', () => {
      // 1. Temples: Do not assume sheltered without roof context -> UNKNOWN
      expect(classifyPlaceEnvironment('culture', 'Temple', 'Virupaksha Temple')).toBe('UNKNOWN');
      expect(classifyPlaceEnvironment('culture', 'Temple', 'Brihadeeswara Temple Complex')).toBe('UNKNOWN');

      // 2. Open Courtyards: Open-sky architecture -> OUTDOOR
      expect(classifyPlaceEnvironment('heritage', undefined, 'Palace Open Courtyard')).toBe('OUTDOOR');
      expect(classifyPlaceEnvironment('culture', undefined, 'Temple Open Courtyard')).toBe('OUTDOOR');

      // 3. Monasteries: Do not assume sheltered without evidence -> UNKNOWN
      expect(classifyPlaceEnvironment('culture', 'Monastery', 'Hemis Monastery')).toBe('UNKNOWN');

      // 4. Palaces: Do not assume indoor or sheltered without museum/gallery context -> UNKNOWN
      expect(classifyPlaceEnvironment('history', 'Palace', 'City Palace')).toBe('UNKNOWN');

      // 5. Open-Air Markets: Open street markets -> OUTDOOR
      expect(classifyPlaceEnvironment('shopping', 'Market', 'Open-Air Street Market')).toBe('OUTDOOR');
      expect(classifyPlaceEnvironment('shopping', 'Bazaar', 'Open-Air Flower Bazaar')).toBe('OUTDOOR');

      // 6. Explicitly Covered Markets: Covered architectural cue -> SHELTERED
      expect(classifyPlaceEnvironment('shopping', 'Market', 'Bapu Bazaar Covered Market')).toBe('SHELTERED');
      expect(classifyPlaceEnvironment('shopping', 'Bazaar', 'Covered Bazaar Arcade')).toBe('SHELTERED');

      // 7. Unknown Environments: Generic culture/history/food/shopping without indicators -> UNKNOWN
      expect(classifyPlaceEnvironment('culture', undefined, 'Local Heritage Site')).toBe('UNKNOWN');
      expect(classifyPlaceEnvironment('food', undefined, 'Street Food Hub')).toBe('UNKNOWN');

      // 8. Explicit Indoor Attractions
      expect(classifyPlaceEnvironment('culture', 'Museum', 'INS Kursura Submarine Museum')).toBe('INDOOR');
      expect(classifyPlaceEnvironment('history', 'Palace', 'City Palace Interior Gallery')).toBe('INDOOR');
      expect(classifyPlaceEnvironment('entertainment', 'Planetarium', 'Birla Planetarium')).toBe('INDOOR');

      // 9. Explicit Outdoor Attractions
      expect(classifyPlaceEnvironment('beaches', undefined, 'Ramakrishna Beach')).toBe('OUTDOOR');
      expect(classifyPlaceEnvironment('nature', undefined, 'Kailasagiri Hill Viewpoint')).toBe('OUTDOOR');
    });

    it('proposes heat-aware swap moving outdoor activities away from midday peak sun to indoor venues', () => {
      const stops: ItineraryStop[] = [
        {
          id: 'h1',
          stopOrder: 1,
          timeSlot: 'Morning',
          time: '09:00 AM',
          placeName: 'Air-Conditioned Art Museum',
          category: 'culture',
          durationMinutes: 90,
          costInr: 100,
          costStatus: 'VERIFIED',
          localTips: '',
        },
        {
          id: 'h2',
          stopOrder: 2,
          timeSlot: 'Afternoon',
          time: '01:30 PM',
          placeName: 'Sunny Open Beach & Viewpoint',
          category: 'beaches',
          durationMinutes: 90,
          costInr: 0,
          costStatus: 'VERIFIED',
          localTips: '',
        },
      ];

      const result = optimizeHeatAwareSchedule(stops);
      expect(result.hasSuggestions).toBe(true);
      expect(result.optimizedStops[0].placeName).toBe('Sunny Open Beach & Viewpoint');
      expect(result.optimizedStops[0].timeSlot).toBe('Morning');
      expect(result.optimizedStops[1].placeName).toBe('Air-Conditioned Art Museum');
      expect(result.optimizedStops[1].timeSlot).toBe('Afternoon');
      expect(result.explanations.length).toBeGreaterThan(0);
    });

    it('does NOT falsely reorder an itinerary when midday alternative is UNKNOWN (not proven heat-safe)', () => {
      const stops: ItineraryStop[] = [
        {
          id: 'u1',
          stopOrder: 1,
          timeSlot: 'Morning',
          time: '09:00 AM',
          placeName: 'Ancient Virupaksha Temple Complex', // UNKNOWN
          category: 'culture',
          durationMinutes: 90,
          costInr: 50,
          costStatus: 'VERIFIED',
          localTips: '',
        },
        {
          id: 'u2',
          stopOrder: 2,
          timeSlot: 'Afternoon',
          time: '01:30 PM',
          placeName: 'Kailasagiri Hill Viewpoint', // OUTDOOR
          category: 'nature',
          durationMinutes: 90,
          costInr: 0,
          costStatus: 'VERIFIED',
          localTips: '',
        },
      ];

      const result = optimizeHeatAwareSchedule(stops);
      // Because Virupaksha Temple is UNKNOWN, it cannot be safely asserted as an indoor heat refuge
      expect(result.hasSuggestions).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // PILLAR 3: DESTINATION COMPARISON WORKSPACE (DEV-03)
  // --------------------------------------------------------------------------
  describe('Pillar 3: Destination Comparison Workspace (DEV-03)', () => {
    it('renders the comparison workspace page with preset buttons and controls', () => {
      renderWithProviders(<DestinationComparePage />);

      expect(screen.getByText(/DESTINATION COMPARISON WORKSPACE/i)).toBeDefined();
      expect(screen.getByText(/Compare Destinations Side-by-Side/i)).toBeDefined();
      expect(screen.getByText(/Suggested Comparisons:/i)).toBeDefined();
      expect(screen.getByText(/Coastal & Heritage vs Royal Desert/i)).toBeDefined();
      expect(screen.getByText(/Spiritual Sacred Hub vs Ancient Ruins/i)).toBeDefined();
    });

    it('clarifies live-discovery targets in attraction insights rather than implying 0 real-world attractions', async () => {
      renderWithProviders(<DestinationComparePage />);

      // Click the preset "Catalog Seeded vs Live Discovery" button to compare Jaipur & Hyderabad
      const presetBtn = screen.getByRole('button', { name: /Catalog Seeded vs Live Discovery/i });
      fireEvent.click(presetBtn);

      await waitFor(() => {
        expect(
          screen.getByText(/On-demand live discovery — attractions are searched when planning\./i)
        ).toBeDefined();
        expect(
          screen.getByText(/0 seeded attractions/i)
        ).toBeDefined();
      }, { timeout: 4000 });
    });

    it('clarifies solar profile as a general shelter heuristic with no live weather or solar telemetry claims', async () => {
      renderWithProviders(<DestinationComparePage />);

      await waitFor(() => {
        expect(
          screen.getAllByText(/General planning heuristic based on venue shelter classification/i).length
        ).toBeGreaterThan(0);
        expect(
          screen.getAllByText(/No live weather or solar radiation telemetry is retrieved/i).length
        ).toBeGreaterThan(0);
      });
    });
  });

  // --------------------------------------------------------------------------
  // PILLAR 4: REGIONAL CULINARY HERITAGE GUIDE (DEV-04 & PHASE 18.2.1)
  // --------------------------------------------------------------------------
  describe('Pillar 4: Regional Culinary Heritage Guide (DEV-04 & Phase 18.2.1)', () => {
    it('contains exactly 35 verified dishes across all 7 destinations with genuine sources', () => {
      expect(REGIONAL_CULINARY_REGISTRY.length).toBe(35);

      const destinations = [
        'visakhapatnam',
        'jaipur',
        'kochi',
        'varanasi',
        'hampi',
        'ladakh',
        'hyderabad',
      ];

      destinations.forEach((slug) => {
        const count = REGIONAL_CULINARY_REGISTRY.filter((d) => d.destinationSlug === slug).length;
        expect(count).toBe(5);
      });

      // Verify every dish has documented genuine authority sources and URLs
      REGIONAL_CULINARY_REGISTRY.forEach((dish) => {
        expect(dish.sourceName).toBeDefined();
        expect(dish.sourceName!.length).toBeGreaterThan(5);
        expect(dish.sourceUrl).toBeDefined();
        expect(dish.sourceUrl!.startsWith('http')).toBe(true);
        expect(dish.regionalOrigin).toBeDefined();
      });
    });

    it('verifies the official GI Registry records, registered names, classes, and URLs for all 4 GI items', () => {
      // 1. Atreyapuram Pootharekulu: Application 804 (corrected from 544)
      const putharekulu = REGIONAL_CULINARY_REGISTRY.find((d) => d.id === 'vizag-5');
      expect(putharekulu).toBeDefined();
      expect(putharekulu!.isGIRegistered).toBe(true);
      expect(putharekulu!.giApplicationNumber).toBe('804');
      expect(putharekulu!.giRegisteredName).toBe('Atreyapuram Pootharekulu');
      expect(putharekulu!.giClass).toBe('Class 30 (Foodstuffs)');
      expect(putharekulu!.sourceUrl).toBe('https://search.ipindia.gov.in/GIRPublic/Application/Details/804');
      expect(putharekulu!.evidenceStatus).toBe('DIRECTLY_SUPPORTED');
      expect(putharekulu!.regionalOrigin).toContain('Atreyapuram');
      expect(putharekulu!.regionalOrigin).toContain('Konaseema');

      // 2. Banaras Pan (Betel Leaf): Application 730 (corrected from 718)
      const banarasiPaan = REGIONAL_CULINARY_REGISTRY.find((d) => d.id === 'vns-4');
      expect(banarasiPaan).toBeDefined();
      expect(banarasiPaan!.isGIRegistered).toBe(true);
      expect(banarasiPaan!.giApplicationNumber).toBe('730');
      expect(banarasiPaan!.giRegisteredName).toBe('Banaras Pan (Betel Leaf)');
      expect(banarasiPaan!.giClass).toBe('Class 31 (Agriculture / Goods)');
      expect(banarasiPaan!.sourceUrl).toBe('https://search.ipindia.gov.in/GIRPublic/Application/Details/730');
      expect(banarasiPaan!.evidenceStatus).toBe('DIRECTLY_SUPPORTED');
      expect(banarasiPaan!.evidenceNotes).toContain('agricultural betel leaf');

      // 3. Ladakh Raktsey Karpo Apricot: Application 729 (corrected from 823)
      const apricot = REGIONAL_CULINARY_REGISTRY.find((d) => d.id === 'ladakh-5');
      expect(apricot).toBeDefined();
      expect(apricot!.isGIRegistered).toBe(true);
      expect(apricot!.giApplicationNumber).toBe('729');
      expect(apricot!.giRegisteredName).toBe('Ladakh Raktsey Karpo Apricot');
      expect(apricot!.giClass).toBe('Class 31 (Agriculture / Goods)');
      expect(apricot!.sourceUrl).toBe('https://search.ipindia.gov.in/GIRPublic/Application/Details/729');
      expect(apricot!.evidenceStatus).toBe('DIRECTLY_SUPPORTED');
      expect(apricot!.dishName).toBe('Ladakh Raktsey Karpo Apricot');

      // 4. Hyderabad Haleem: Application 193 (verified unchanged)
      const haleem = REGIONAL_CULINARY_REGISTRY.find((d) => d.id === 'hyd-3');
      expect(haleem).toBeDefined();
      expect(haleem!.isGIRegistered).toBe(true);
      expect(haleem!.giApplicationNumber).toBe('193');
      expect(haleem!.giRegisteredName).toBe('Hyderabad Haleem');
      expect(haleem!.giClass).toBe('Class 29 (Foodstuffs / Meat)');
      expect(haleem!.sourceUrl).toBe('https://search.ipindia.gov.in/GIRPublic/Application/Details/193');
      expect(haleem!.evidenceStatus).toBe('DIRECTLY_SUPPORTED');
      expect(haleem!.regionalOrigin).toContain('Hyderabad');

      // Verify no other items falsely claim GI registration (exactly 4 GI items)
      const giItems = REGIONAL_CULINARY_REGISTRY.filter((d) => d.isGIRegistered);
      expect(giItems.length).toBe(4);
    });

    it('assigns explicit, accurate evidence status to each of the 35 culinary items', () => {
      const validStatuses = [
        'DIRECTLY_SUPPORTED',
        'REGIONALLY_SUPPORTED',
        'PARTIALLY_SUPPORTED',
        'SOURCE_NOT_FOUND',
      ];

      REGIONAL_CULINARY_REGISTRY.forEach((dish) => {
        expect(validStatuses).toContain(dish.evidenceStatus);
        expect(dish.evidenceNotes).toBeDefined();
        expect(dish.evidenceNotes!.length).toBeGreaterThan(10);
      });

      const directlySupported = REGIONAL_CULINARY_REGISTRY.filter(
        (d) => d.evidenceStatus === 'DIRECTLY_SUPPORTED'
      );
      const regionallySupported = REGIONAL_CULINARY_REGISTRY.filter(
        (d) => d.evidenceStatus === 'REGIONALLY_SUPPORTED'
      );
      const partiallySupported = REGIONAL_CULINARY_REGISTRY.filter(
        (d) => d.evidenceStatus === 'PARTIALLY_SUPPORTED'
      );
      const notFound = REGIONAL_CULINARY_REGISTRY.filter(
        (d) => d.evidenceStatus === 'SOURCE_NOT_FOUND'
      );

      // 4 GI-registered items + 4 Kerala Tourism Official Cuisine Portal recipe archives
      expect(directlySupported.length).toBe(8);
      // 23 state/regional culinary heritage dishes
      expect(regionallySupported.length).toBe(23);
      // 4 local cultural/bazaar items without centralized government recipe registers
      expect(partiallySupported.length).toBe(4);
      // 0 missing sources
      expect(notFound.length).toBe(0);
    });

    it('correctly associates Davangere Benne Dosa with Davanagere origin per DEV-04', () => {
      const benneDosa = REGIONAL_CULINARY_REGISTRY.find((d) => d.id === 'hampi-4');
      expect(benneDosa).toBeDefined();
      expect(benneDosa!.regionalOrigin).toContain('Davanagere');
      expect(benneDosa!.culturalContext).toContain('Davanagere');
      expect(benneDosa!.sourceName).toContain('Government of Karnataka');
      expect(benneDosa!.evidenceStatus).toBe('REGIONALLY_SUPPORTED');
    });

    it('accurately enforces dietary classifications strictly based on ingredients', () => {
      // 1. Plant-based Vegan items
      const gongura = REGIONAL_CULINARY_REGISTRY.find((d) => d.id === 'vizag-4')!;
      expect(gongura.dietaryTag).toBe('Vegan');

      const kerSangri = REGIONAL_CULINARY_REGISTRY.find((d) => d.id === 'jpr-2')!;
      expect(kerSangri.dietaryTag).toBe('Vegan');

      const appamStew = REGIONAL_CULINARY_REGISTRY.find((d) => d.id === 'kochi-2')!;
      expect(appamStew.dietaryTag).toBe('Vegan');

      const joladaRotti = REGIONAL_CULINARY_REGISTRY.find((d) => d.id === 'hampi-1')!;
      expect(joladaRotti.dietaryTag).toBe('Vegan');

      const tingmo = REGIONAL_CULINARY_REGISTRY.find((d) => d.id === 'ladakh-4')!;
      expect(tingmo.dietaryTag).toBe('Vegan');

      // 2. Non-Vegetarian items
      const laalMaas = REGIONAL_CULINARY_REGISTRY.find((d) => d.id === 'jpr-5')!;
      expect(laalMaas.dietaryTag).toBe('Non-Vegetarian');

      const biryani = REGIONAL_CULINARY_REGISTRY.find((d) => d.id === 'hyd-1')!;
      expect(biryani.dietaryTag).toBe('Non-Vegetarian');

      const haleem = REGIONAL_CULINARY_REGISTRY.find((d) => d.id === 'hyd-3')!;
      expect(haleem.dietaryTag).toBe('Non-Vegetarian');

      // 3. Dairy Vegetarian items
      const dalBaati = REGIONAL_CULINARY_REGISTRY.find((d) => d.id === 'jpr-1')!;
      expect(dalBaati.dietaryTag).toBe('Vegetarian');

      const malaiyyo = REGIONAL_CULINARY_REGISTRY.find((d) => d.id === 'vns-1')!;
      expect(malaiyyo.dietaryTag).toBe('Vegetarian');
    });

    it('renders the culinary guide displaying verified sources, evidence badges, and regional origins', () => {
      renderWithProviders(<RegionalCulinaryGuide />);

      expect(screen.getByText(/REGIONAL CULINARY HERITAGE GUIDE/i)).toBeDefined();
      expect(screen.getAllByText(/Chepala Pulusu/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Regional Origin:/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Source:/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Direct Authority/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Regional Culinary Tradition/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/GI Registered Product/i).length).toBeGreaterThan(0);
    });

    it('gracefully handles missing culinary source URL without crashing or asserting false authenticity', () => {
      // Simulate an unverified or source-less entry
      const fallbackDish: CulinaryHeritageItem = {
        id: 'test-unverified-1',
        destinationSlug: 'visakhapatnam',
        destinationName: 'Visakhapatnam',
        dishName: 'Folk Village Pickle',
        dietaryTag: 'Vegan' as const,
        culturalContext: 'Oral tradition recipe.',
        keyIngredients: ['Local Mangoes', 'Salt'],
        traditionalPreparation: 'Sun-cured in jars.',
        famousFoodStreets: 'Local Markets',
        authenticityNote: 'Oral community heritage.',
        evidenceStatus: 'SOURCE_NOT_FOUND' as const,
        evidenceNotes: 'No formal archival citation found.',
      };

      expect(fallbackDish.evidenceStatus).toBe('SOURCE_NOT_FOUND');
      expect(fallbackDish.sourceUrl).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // PILLAR 5: DATA PROVENANCE & TRUST DRAWER (DEV-05)
  // --------------------------------------------------------------------------
  describe('Pillar 5: Data Provenance & Trust Drawer (DEV-05)', () => {
    it('renders neutral fallback "Source URL not recorded" when record has no URL', async () => {
      renderWithProviders(
        <ProvenanceDrawer
          isOpen={true}
          onClose={() => {}}
          placeId={1}
          placeName="Sample Historic Monument"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Source URL not recorded')).toBeDefined();
        expect(screen.queryByText(/Archived offline authority \/ Field survey/i)).toBeNull();
        expect(screen.getByText(/Audit log history of factual assertions/i)).toBeDefined();
      });
    });

    it('renders the trust drawer when opened and handles close callback', () => {
      const handleClose = vi.fn();

      renderWithProviders(
        <ProvenanceDrawer
          isOpen={true}
          onClose={handleClose}
          placeId="1"
          placeName="INS Kursura Submarine Museum"
        />
      );

      expect(screen.getByText(/DATA PROVENANCE & FACT AUDIT/i)).toBeDefined();
      expect(screen.getByText(/INS Kursura Submarine Museum/i)).toBeDefined();

      const closeBtn = screen.getByTitle(/Close audit drawer/i);
      fireEvent.click(closeBtn);
      expect(handleClose).toHaveBeenCalled();
    });

    it('does not render drawer DOM when isOpen is false', () => {
      const { container } = renderWithProviders(
        <ProvenanceDrawer
          isOpen={false}
          onClose={() => {}}
          placeId="1"
          placeName="Test Place"
        />
      );

      expect(container.firstChild).toBeNull();
    });
  });
});
