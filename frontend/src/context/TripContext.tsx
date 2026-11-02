import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserPreferences, Destination, Itinerary, ItineraryStop, Place } from '../types';
import { CURATED_DESTINATIONS } from '../data/curatedDestinations';
import { fetchSavedItinerariesFromAPI, saveItineraryToAPI, updateItineraryInAPI, deleteSavedItineraryFromAPI } from '../api/client';

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
  reorderStop: (dayNumber: number, stopIndex: number, direction: 'up' | 'down') => void;
  reorderDayStops: (dayNumber: number, stops: ItineraryStop[]) => void;
  moveStopToDay: (sourceDayNumber: number, stopId: string, targetDayNumber: number) => void;
  deleteStop: (dayNumber: number, stopId: string) => void;
  addPlaceToDay: (place: Place, targetDayNumber: number) => boolean;
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
      const isExisting = savedTrips.some((t) => t.id === itinerary.id);
      const persisted = isExisting
        ? await updateItineraryInAPI(itinerary)
        : await saveItineraryToAPI(itinerary);
      setSavedTrips((prev) => {
        const existing = prev.filter((t) => t.id !== persisted.id && t.id !== itinerary.id);
        return [persisted, ...existing];
      });
      setCurrentItinerary(persisted);
      return persisted;
    } catch (err) {
      console.warn('Backend save/update failed, saving to local storage fallback:', err);
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

  const reorderStop = (dayNumber: number, stopIndex: number, direction: 'up' | 'down') => {
    if (!currentItinerary) return;
    const targetDay = currentItinerary.days.find((d) => d.dayNumber === dayNumber);
    if (!targetDay) return;

    const newIndex = direction === 'up' ? stopIndex - 1 : stopIndex + 1;
    if (newIndex < 0 || newIndex >= targetDay.stops.length) return;

    const newStops = [...targetDay.stops];
    const [moved] = newStops.splice(stopIndex, 1);
    newStops.splice(newIndex, 0, moved);

    const reorderedStops = newStops.map((s, idx) => ({
      ...s,
      stopOrder: idx + 1,
    }));

    const updatedDays = currentItinerary.days.map((d) => {
      if (d.dayNumber !== dayNumber) return d;
      return { ...d, stops: reorderedStops };
    });

    setCurrentItinerary({ ...currentItinerary, days: updatedDays });
  };


  const reorderDayStops = (dayNumber: number, stops: ItineraryStop[]) => {
    if (!currentItinerary) return;
    const reindexedStops = stops.map((s, idx) => ({
      ...s,
      stopOrder: idx + 1,
    }));
    const updatedDays = currentItinerary.days.map((d) => {
      if (d.dayNumber !== dayNumber) return d;
      return { ...d, stops: reindexedStops };
    });
    setCurrentItinerary({ ...currentItinerary, days: updatedDays });
  };
  const moveStopToDay = (sourceDayNumber: number, stopId: string, targetDayNumber: number) => {
    if (!currentItinerary || sourceDayNumber === targetDayNumber) return;

    const sourceDay = currentItinerary.days.find((d) => d.dayNumber === sourceDayNumber);
    const targetDay = currentItinerary.days.find((d) => d.dayNumber === targetDayNumber);
    if (!sourceDay || !targetDay) return;

    const stopToMove = sourceDay.stops.find((s) => s.id === stopId);
    if (!stopToMove) return;

    const remainingSourceStops = sourceDay.stops
      .filter((s) => s.id !== stopId)
      .map((s, idx) => ({ ...s, stopOrder: idx + 1 }));

    const newTargetStops = [
      ...targetDay.stops,
      { ...stopToMove, stopOrder: targetDay.stops.length + 1 },
    ];

    const sourceCost = remainingSourceStops.reduce((sum, s) => sum + (s.costInr || 0), 0);
    const targetCost = newTargetStops.reduce((sum, s) => sum + (s.costInr || 0), 0);

    const updatedDays = currentItinerary.days.map((d) => {
      if (d.dayNumber === sourceDayNumber) {
        return { ...d, stops: remainingSourceStops, dayEstimatedCostInr: sourceCost };
      }
      if (d.dayNumber === targetDayNumber) {
        return { ...d, stops: newTargetStops, dayEstimatedCostInr: targetCost };
      }
      return d;
    });

    setCurrentItinerary({ ...currentItinerary, days: updatedDays });
  };

  const deleteStop = (dayNumber: number, stopId: string) => {
    if (!currentItinerary) return;

    const targetDay = currentItinerary.days.find((d) => d.dayNumber === dayNumber);
    if (!targetDay) return;

    const stopToDelete = targetDay.stops.find((s) => s.id === stopId);
    const costToRemove = stopToDelete?.costInr || 0;

    const remainingStops = targetDay.stops
      .filter((s) => s.id !== stopId)
      .map((s, idx) => ({ ...s, stopOrder: idx + 1 }));

    const updatedDays = currentItinerary.days.map((d) => {
      if (d.dayNumber !== dayNumber) return d;
      return {
        ...d,
        stops: remainingStops,
        dayEstimatedCostInr: Math.max(0, d.dayEstimatedCostInr - costToRemove),
      };
    });

    setCurrentItinerary({
      ...currentItinerary,
      days: updatedDays,
      totalBudgetInr: Math.max(0, currentItinerary.totalBudgetInr - costToRemove),
    });
  };

  const addPlaceToDay = (place: Place, targetDayNumber: number): boolean => {
    if (!addedPlaces.some((p) => p.id === place.id)) {
      setAddedPlaces((prev) => [...prev, place]);
    }

    if (!currentItinerary) return false;

    const targetDay = currentItinerary.days.find((d) => d.dayNumber === targetDayNumber);
    if (!targetDay) return false;

    const newStop: ItineraryStop = {
      id: `custom-${place.id}-${Date.now()}`,
      stopOrder: targetDay.stops.length + 1,
      timeSlot: 'Afternoon',
      time: '02:30 PM',
      placeId: place.id,
      placeName: place.name,
      category: (place.category as any) || 'culture',
      durationMinutes: 90,
      costInr: place.ticketPriceInr ?? 0,
      costStatus: place.ticketPriceInr !== undefined && place.ticketPriceInr !== null ? 'VERIFIED' : 'UNAVAILABLE',
      localTips: place.description || 'Custom selected attraction added from recommendations.',
      transportToNext: 'Short local transit',
      latitude: place.latitude,
      longitude: place.longitude,
    };

    const costToAdd = place.ticketPriceInr || 0;
    const updatedDays = currentItinerary.days.map((d) => {
      if (d.dayNumber !== targetDayNumber) return d;
      return {
        ...d,
        stops: [...d.stops, newStop],
        dayEstimatedCostInr: d.dayEstimatedCostInr + costToAdd,
      };
    });

    setCurrentItinerary({
      ...currentItinerary,
      days: updatedDays,
      totalBudgetInr: currentItinerary.totalBudgetInr + costToAdd,
    });

    return true;
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
        reorderStop,
        reorderDayStops,
        moveStopToDay,
        deleteStop,
        addPlaceToDay,
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

