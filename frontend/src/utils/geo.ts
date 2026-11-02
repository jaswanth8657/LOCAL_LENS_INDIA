import { ItineraryStop } from '../types';

/**
 * Geographic calculation utilities for LOCAL LENS INDIA.
 * Calculates approximate straight-line Haversine distance between two coordinates in kilometers.
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (
    typeof lat1 !== 'number' ||
    typeof lon1 !== 'number' ||
    typeof lat2 !== 'number' ||
    typeof lon2 !== 'number' ||
    isNaN(lat1) ||
    isNaN(lon1) ||
    isNaN(lat2) ||
    isNaN(lon2)
  ) {
    return 0;
  }

  const R = 6371; // Earth's mean radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export type GeographicSpread = 'Compact' | 'Moderate' | 'Dispersed';

export interface DayDistanceAnalysis {
  totalKm: number;
  hasMissingCoords: boolean;
  missingCount: number;
  spread: GeographicSpread;
}

/**
 * Calculates straight-line day-level total distance and geographic spread classification.
 * - Compact: total distance below 5 km (< 5 km)
 * - Moderate: total distance from 5 km through 15 km, inclusive (5 - 15 km)
 * - Dispersed: total distance above 15 km (> 15 km)
 *
 * NOTE: These are approximate straight-line Haversine measurements, not road travel distances.
 */
export function calculateDayTotalDistanceKm(stops: ItineraryStop[]): DayDistanceAnalysis {
  if (!stops || stops.length < 2) {
    return {
      totalKm: 0,
      hasMissingCoords: false,
      missingCount: 0,
      spread: 'Compact',
    };
  }

  let totalKm = 0;
  let missingCount = 0;

  for (let i = 0; i < stops.length - 1; i++) {
    const curr = stops[i];
    const next = stops[i + 1];

    const hasCurr = typeof curr.latitude === 'number' && typeof curr.longitude === 'number' && !isNaN(curr.latitude) && !isNaN(curr.longitude);
    const hasNext = typeof next.latitude === 'number' && typeof next.longitude === 'number' && !isNaN(next.latitude) && !isNaN(next.longitude);

    if (hasCurr && hasNext) {
      totalKm += calculateHaversineDistanceKm(curr.latitude!, curr.longitude!, next.latitude!, next.longitude!);
    } else {
      missingCount++;
    }
  }

  totalKm = Math.round(totalKm * 10) / 10;
  const spread = classifyGeographicSpread(totalKm);

  return {
    totalKm,
    hasMissingCoords: missingCount > 0,
    missingCount,
    spread,
  };
}

export function classifyGeographicSpread(totalKm: number): GeographicSpread {
  if (totalKm < 5) return 'Compact';
  if (totalKm <= 15) return 'Moderate';
  return 'Dispersed';
}

export interface ZigZagAnalysis {
  hasSuggestion: boolean;
  currentKm: number;
  optimizedKm: number;
  savingsKm: number;
  savingsPct: number;
  suggestedStops?: ItineraryStop[];
  reason?: string;
}

/**
 * Evaluates whether current stop sequence exhibits a zig-zag inefficiency
 * and proposes an optimized reordered sequence if savings >= 20% and >= 2.0 km.
 */
export function detectZigZagSequence(stops: ItineraryStop[]): ZigZagAnalysis {
  if (!stops || stops.length < 3) {
    return {
      hasSuggestion: false,
      currentKm: 0,
      optimizedKm: 0,
      savingsKm: 0,
      savingsPct: 0,
    };
  }

  // Filter stops that have valid coordinates
  const validStops = stops.filter(
    (s) => typeof s.latitude === 'number' && typeof s.longitude === 'number' && !isNaN(s.latitude) && !isNaN(s.longitude)
  );

  // If fewer than 3 stops have coordinates, optimization is not deterministic
  if (validStops.length < 3 || validStops.length !== stops.length) {
    return {
      hasSuggestion: false,
      currentKm: 0,
      optimizedKm: 0,
      savingsKm: 0,
      savingsPct: 0,
    };
  }

  // Calculate current distance
  let currentKm = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    currentKm += calculateHaversineDistanceKm(
      stops[i].latitude!,
      stops[i].longitude!,
      stops[i + 1].latitude!,
      stops[i + 1].longitude!
    );
  }
  currentKm = Math.round(currentKm * 10) / 10;

  // For <= 8 stops, we can do full permutation or 2-opt heuristic to find the shortest Hamiltonian path
  let bestOrder = [...stops];
  let bestDistance = currentKm;

  // Simple and fast heuristic: Nearest Neighbor starting from first stop, or 2-opt exchanges
  // 1. Try starting with stop[0] and picking nearest unvisited stop
  const unvisited = [...stops.slice(1)];
  const nnOrder: ItineraryStop[] = [stops[0]];

  while (unvisited.length > 0) {
    const last = nnOrder[nnOrder.length - 1];
    let nearestIdx = 0;
    let nearestDist = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const d = calculateHaversineDistanceKm(
        last.latitude!,
        last.longitude!,
        unvisited[i].latitude!,
        unvisited[i].longitude!
      );
      if (d < nearestDist) {
        nearestDist = d;
        nearestIdx = i;
      }
    }

    nnOrder.push(unvisited.splice(nearestIdx, 1)[0]);
  }

  let nnDist = 0;
  for (let i = 0; i < nnOrder.length - 1; i++) {
    nnDist += calculateHaversineDistanceKm(
      nnOrder[i].latitude!,
      nnOrder[i].longitude!,
      nnOrder[i + 1].latitude!,
      nnOrder[i + 1].longitude!
    );
  }
  nnDist = Math.round(nnDist * 10) / 10;

  if (nnDist < bestDistance) {
    bestDistance = nnDist;
    bestOrder = nnOrder;
  }

  // 2. Perform 2-opt passes
  let improved = true;
  let currentBest = [...bestOrder];
  while (improved) {
    improved = false;
    for (let i = 0; i < currentBest.length - 1; i++) {
      for (let k = i + 1; k < currentBest.length; k++) {
        const newRoute = [
          ...currentBest.slice(0, i),
          ...currentBest.slice(i, k + 1).reverse(),
          ...currentBest.slice(k + 1),
        ];
        let d = 0;
        for (let j = 0; j < newRoute.length - 1; j++) {
          d += calculateHaversineDistanceKm(
            newRoute[j].latitude!,
            newRoute[j].longitude!,
            newRoute[j + 1].latitude!,
            newRoute[j + 1].longitude!
          );
        }
        d = Math.round(d * 10) / 10;
        if (d < bestDistance) {
          bestDistance = d;
          bestOrder = newRoute;
          currentBest = newRoute;
          improved = true;
        }
      }
    }
  }

  const savingsKm = Math.round((currentKm - bestDistance) * 10) / 10;
  const savingsPct = currentKm > 0 ? Math.round((savingsKm / currentKm) * 100) : 0;

  // Threshold: at least 20% savings AND at least 2.0 km reduction
  if (savingsKm >= 2.0 && savingsPct >= 20) {
    // Re-assign stopOrder and timeSlot to match new sequential order
    const suggestedStops = bestOrder.map((stop, idx) => ({
      ...stop,
      stopOrder: idx + 1,
      timeSlot: stops[idx].timeSlot, // preserve the time slots of original slots
      time: stops[idx].time,
    }));

    return {
      hasSuggestion: true,
      currentKm,
      optimizedKm: bestDistance,
      savingsKm,
      savingsPct,
      suggestedStops,
      reason: `Eliminates back-and-forth transit between separated clusters, reducing straight-line travel by ${savingsKm} km (~${savingsPct}%).`,
    };
  }

  return {
    hasSuggestion: false,
    currentKm,
    optimizedKm: currentKm,
    savingsKm: 0,
    savingsPct: 0,
  };
}


