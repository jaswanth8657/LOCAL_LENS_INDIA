import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserPreferences, Destination, Itinerary, ItineraryStop, Place } from '../types';
import { CURATED_DESTINATIONS } from '../data/curatedDestinations';
import { fetchSavedItinerariesFromAPI, saveItineraryToAPI, deleteSavedItineraryFromAPI } from '../api/client';

interface TripContextType {
  selectedDestination: Destination | null;
  setSelectedDestination: (dest: Destination | null) => void;
  preferences: UserPreferences;
  setPreferences: React.Dispatch<React.SetStateAction<UserPreferences>>;
  currentItinerary: Itinerary | null;
  setCurrentItinerary: (itinerary: Itinerary | null) => void;
  savedTrips: Itinerary[];
  saveTrip: (itinerary: Itinerary) => Promise<Itinerary>;
  removeSavedTrip: (id: string) => Promise<void>;
  updateItineraryStop: (dayNumber: number, stopId: string, updatedStop: Partial<ItineraryStop>) => void;
  addedPlaces: Place[];
  addPlaceToTrip: (place: Place) => boolean;
  removePlaceFromTrip: (placeId: string) => void;
  isPlaceInTrip: (placeId: string) => boolean;
  voiceQuery: string;
  setVoiceQuery: (query: string) => void;
  isVoiceModalOpen: boolean;
  setIsVoiceModalOpen: (open: boolean) => void;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  destination: 'visakhapatnam',
  destinationName: 'Visakhapatnam',
  interests: ['beaches', 'culture', 'food'],
  budgetPerDay: 2000,
  groupType: 'Duo',
  groupSize: 2,
  durationDays: 3,
};

const TripContext = createContext<TripContextType | undefined>(undefined);

export const TripProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedDestination, setSelectedDestination] = useState<Destination | null>(
    CURATED_DESTINATIONS[0]
  );
  
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [currentItinerary, setCurrentItinerary] = useState<Itinerary | null>(null);
  const [savedTrips, setSavedTrips] = useState<Itinerary[]>(() => {
    try {
      const saved = localStorage.getItem('local_lens_saved_trips');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [addedPlaces, setAddedPlaces] = useState<Place[]>(() => {
    try {
      const saved = localStorage.getItem('local_lens_added_places');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [voiceQuery, setVoiceQuery] = useState<string>('');
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState<boolean>(false);

  useEffect(() => {
    try {
      localStorage.setItem('local_lens_added_places', JSON.stringify(addedPlaces));
    } catch (e) {
      console.warn('Failed to persist added places to localStorage:', e);
    }
  }, [addedPlaces]);

  // Sync with backend SQLite database on mount
  useEffect(() => {
    fetchSavedItinerariesFromAPI().then((backendTrips) => {
      if (backendTrips && backendTrips.length > 0) {
        setSavedTrips((prev) => {
          const map = new Map<string, Itinerary>();
          backendTrips.forEach((t) => map.set(t.id, t));
          prev.forEach((t) => {
            if (!map.has(t.id)) map.set(t.id, t);
          });
          return Array.from(map.values());
        });
      }
    });
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('local_lens_saved_trips', JSON.stringify(savedTrips));
    } catch (e) {
      console.warn('Failed to persist saved trips to localStorage:', e);
    }
  }, [savedTrips]);

  const saveTrip = async (itinerary: Itinerary): Promise<Itinerary> => {
    try {
      const persisted = await saveItineraryToAPI(itinerary);
      setSavedTrips((prev) => {
        const existing = prev.filter((t) => t.id !== persisted.id && t.id !== itinerary.id);
        return [persisted, ...existing];
      });
      return persisted;
    } catch (err) {
      console.warn('Backend save failed, saving to local storage fallback:', err);
      setSavedTrips((prev) => {
        const existing = prev.filter((t) => t.id !== itinerary.id);
        return [itinerary, ...existing];
      });
      return itinerary;
    }
  };

  const removeSavedTrip = async (id: string): Promise<void> => {
    try {
      await deleteSavedItineraryFromAPI(id);
    } catch (e) {
      console.warn('Backend delete failed:', e);
    }
    setSavedTrips((prev) => prev.filter((t) => t.id !== id));
  };

  const updateItineraryStop = (dayNumber: number, stopId: string, updatedStop: Partial<ItineraryStop>) => {
    if (!currentItinerary) return;
    const newDays = currentItinerary.days.map((day) => {
      if (day.dayNumber !== dayNumber) return day;
      const newStops = day.stops.map((stop) => {
        if (stop.id !== stopId) return stop;
        return { ...stop, ...updatedStop };
      });
      return { ...day, stops: newStops };
    });
    setCurrentItinerary({ ...currentItinerary, days: newDays });
  };

  const isPlaceInTrip = (placeId: string): boolean => {
    if (addedPlaces.some((p) => p.id === placeId)) return true;
    if (currentItinerary?.days.some((d) => d.stops.some((s) => s.placeId === placeId))) return true;
    return false;
  };

  const addPlaceToTrip = (place: Place): boolean => {
    if (isPlaceInTrip(place.id)) return false;

    setAddedPlaces((prev) => [...prev, place]);

    // If an itinerary is currently open, dynamically inject the stop into the least populated day
    if (currentItinerary && currentItinerary.days.length > 0) {
      const sortedDays = [...currentItinerary.days].sort((a, b) => a.stops.length - b.stops.length);
      const targetDayNum = sortedDays[0].dayNumber;

      const newStop: ItineraryStop = {
        id: `custom-${place.id}-${Date.now()}`,
        stopOrder: (currentItinerary.days.find((d) => d.dayNumber === targetDayNum)?.stops.length || 0) + 1,
        timeSlot: 'Afternoon',
        time: '02:30 PM',
        placeId: place.id,
        placeName: place.name,
        category: (place.category as any) || 'culture',
        durationMinutes: 90,
        costInr: place.ticketPriceInr ?? 0,
        costStatus: place.ticketPriceInr !== undefined && place.ticketPriceInr !== null ? 'VERIFIED' : 'UNAVAILABLE',
        localTips: place.description || 'Custom selected attraction added from recommendations.',
        transportToNext: 'Short local transit'
      };

      const updatedDays = currentItinerary.days.map((d) => {
        if (d.dayNumber !== targetDayNum) return d;
        return {
          ...d,
          stops: [...d.stops, newStop],
          dayEstimatedCostInr: d.dayEstimatedCostInr + (place.ticketPriceInr || 0)
        };
      });

      setCurrentItinerary({
        ...currentItinerary,
        days: updatedDays,
        totalBudgetInr: currentItinerary.totalBudgetInr + (place.ticketPriceInr || 0)
      });
    }

    return true;
  };

  const removePlaceFromTrip = (placeId: string) => {
    setAddedPlaces((prev) => prev.filter((p) => p.id !== placeId));
    if (currentItinerary) {
      const updatedDays = currentItinerary.days.map((d) => ({
        ...d,
        stops: d.stops.filter((s) => s.placeId !== placeId)
      }));
      setCurrentItinerary({ ...currentItinerary, days: updatedDays });
    }
  };

  return (
    <TripContext.Provider
      value={{
        selectedDestination,
        setSelectedDestination,
        preferences,
        setPreferences,
        currentItinerary,
        setCurrentItinerary,
        savedTrips,
        saveTrip,
        removeSavedTrip,
        updateItineraryStop,
        addedPlaces,
        addPlaceToTrip,
        removePlaceFromTrip,
        isPlaceInTrip,
        voiceQuery,
        setVoiceQuery,
        isVoiceModalOpen,
        setIsVoiceModalOpen,
      }}
    >
      {children}
    </TripContext.Provider>
  );
};

export const useTrip = (): TripContextType => {
  const context = useContext(TripContext);
  if (!context) {
    throw new Error('useTrip must be used within a TripProvider');
  }
  return context;
};

