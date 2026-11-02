import { ItineraryStop } from '../types';

export type PlaceEnvironment = 'OUTDOOR' | 'INDOOR' | 'SHELTERED' | 'UNKNOWN';

/**
 * Classifies an attraction or stop into OUTDOOR, INDOOR, SHELTERED, or UNKNOWN
 * based on explicit data.
 *
 * Rules:
 * - Does NOT infer air-conditioning, roofing, or enclosed architecture from place name alone.
 * - Does NOT assume courtyards, temples, monasteries, palaces, or bazaars are sheltered.
 * - Only classifies as INDOOR or SHELTERED when available data explicitly indicates indoor/sheltered status.
 * - Classifies clearly open-air attractions as OUTDOOR when available data supports it.
 * - Broad categories (culture, heritage, history, food, shopping) fall back to UNKNOWN.
 */
export function classifyPlaceEnvironment(
  category?: string,
  subcategory?: string,
  placeName?: string,
  description?: string
): PlaceEnvironment {
  const text = `${category || ''} ${subcategory || ''} ${placeName || ''} ${description || ''}`.toLowerCase();

  // 1. Explicit OUTDOOR indicators (checked first if explicitly open-air/courtyard)
  if (
    text.includes('open-air') ||
    text.includes('open air') ||
    text.includes('open courtyard') ||
    text.includes('courtyard') ||
    text.includes('street market') ||
    text.includes('beach') ||
    text.includes('waterfall') ||
    text.includes('lake') ||
    text.includes('ghat') ||
    text.includes('promenade') ||
    text.includes('viewpoint') ||
    text.includes('wildlife') ||
    text.includes('sanctuary') ||
    text.includes('national park') ||
    text.includes('garden') ||
    text.includes('park') ||
    text.includes('trek') ||
    text.includes('trail') ||
    text.includes('valley') ||
    text.includes('peak') ||
    text.includes('hill') ||
    category === 'nature' ||
    category === 'beaches' ||
    category === 'adventure'
  ) {
    // Ensure an indoor museum inside a park or garden is still recognized as indoor
    const hasExplicitIndoorOverride =
      text.includes('museum') ||
      text.includes('planetarium') ||
      text.includes('aquarium') ||
      text.includes('interior gallery') ||
      text.includes('air-conditioned') ||
      text.includes('indoor');

    if (!hasExplicitIndoorOverride) {
      return 'OUTDOOR';
    }
  }

  // 2. Explicit INDOOR indicators (strictly verified indoor / climate-controlled structures)
  if (
    text.includes('museum') ||
    text.includes('planetarium') ||
    text.includes('aquarium') ||
    text.includes('art gallery') ||
    text.includes('interior gallery') ||
    text.includes('indoor gallery') ||
    text.includes('auditorium') ||
    text.includes('cinema') ||
    text.includes('theatre') ||
    text.includes('theater') ||
    text.includes('indoor mall') ||
    text.includes('shopping mall') ||
    text.includes('air-conditioned') ||
    text.includes('indoor') ||
    subcategory?.toLowerCase() === 'museum' ||
    subcategory?.toLowerCase() === 'gallery' ||
    subcategory?.toLowerCase() === 'planetarium' ||
    subcategory?.toLowerCase() === 'aquarium'
  ) {
    return 'INDOOR';
  }

  // 3. Explicit SHELTERED indicators (must have explicit covered / shaded architectural cues)
  if (
    text.includes('covered market') ||
    text.includes('covered bazaar') ||
    text.includes('enclosed market') ||
    text.includes('covered pavilion') ||
    text.includes('shaded pavilion') ||
    text.includes('covered walkway') ||
    text.includes('shaded arcade') ||
    text.includes('arcade') ||
    text.includes('veranda')
  ) {
    return 'SHELTERED';
  }

  // 4. Everything else remains UNKNOWN
  // Temples, palaces, monasteries, open markets, and generic heritage/culture/shopping/food
  // are NOT assumed to be indoor or sheltered without explicit evidence.
  return 'UNKNOWN';
}

export interface HeatAwareSlotProposal {
  slot: 'Morning' | 'Afternoon' | 'Evening' | 'Night';
  time: string;
  recommendedEnv: 'OUTDOOR' | 'INDOOR' | 'SHELTERED' | 'ANY';
  description: string;
}

export const TROPICAL_SOLAR_SLOTS: HeatAwareSlotProposal[] = [
  {
    slot: 'Morning',
    time: '08:30 AM',
    recommendedEnv: 'OUTDOOR',
    description: 'Cooler morning solar angle (07:30 - 10:30) — ideal for beaches, viewpoints & open-air heritage.',
  },
  {
    slot: 'Afternoon',
    time: '01:30 PM',
    recommendedEnv: 'INDOOR',
    description: 'Peak tropical solar irradiance (12:00 - 15:30) — best suited for air-conditioned museums, galleries & indoor sites.',
  },
  {
    slot: 'Evening',
    time: '05:00 PM',
    recommendedEnv: 'OUTDOOR',
    description: 'Subdued evening temperatures & golden hour (16:30 - 19:00) — optimal for ghats, promenades & gardens.',
  },
  {
    slot: 'Night',
    time: '07:30 PM',
    recommendedEnv: 'ANY',
    description: 'Nightfall & dusk (19:30+) — ideal for night bazaars, culinary walks & cultural performances.',
  },
];

export interface HeatOptimizationResult {
  hasSuggestions: boolean;
  optimizedStops: ItineraryStop[];
  changesCount: number;
  explanations: string[];
}

/**
 * Optimizes a day's stops using the Smart Heat-Aware Tropical Scheduling Heuristic:
 * Moves outdoor attractions to morning (08:30) or evening (17:00),
 * and places indoor/sheltered attractions in the midday heat window (12:00-15:30).
 */
export function optimizeHeatAwareSchedule(stops: ItineraryStop[]): HeatOptimizationResult {
  if (!stops || stops.length < 2) {
    return {
      hasSuggestions: false,
      optimizedStops: stops || [],
      changesCount: 0,
      explanations: [],
    };
  }

  const enriched = stops.map((stop) => ({
    ...stop,
    env: classifyPlaceEnvironment(stop.category, undefined, stop.placeName),
  }));

  // Identify misaligned stops:
  // e.g. Midday/Afternoon stop is OUTDOOR, while Morning or Evening stop is INDOOR/SHELTERED
  const afternoonStops = enriched.filter((s) => s.timeSlot === 'Afternoon');
  const morningOrEveningStops = enriched.filter((s) => s.timeSlot === 'Morning' || s.timeSlot === 'Evening');

  const middayOutdoor = afternoonStops.find((s) => s.env === 'OUTDOOR');
  const nonMiddayIndoor = morningOrEveningStops.find((s) => s.env === 'INDOOR' || s.env === 'SHELTERED');

  if (!middayOutdoor || !nonMiddayIndoor) {
    return {
      hasSuggestions: false,
      optimizedStops: stops,
      changesCount: 0,
      explanations: ['Current schedule already conforms well to tropical heat guidelines.'],
    };
  }

  // Create reordered candidate
  // Priority order for slots:
  // Slot 1 (Morning): OUTDOOR first, then UNKNOWN, then SHELTERED, then INDOOR
  // Slot 2 (Afternoon/Midday): INDOOR first, then SHELTERED. Only fall back to UNKNOWN/OUTDOOR if none available
  // Slot 3 (Evening): OUTDOOR first, then UNKNOWN, then SHELTERED, then INDOOR
  // Slot 4+ (Night/Later): Remaining
  const outdoorStops = enriched.filter((s) => s.env === 'OUTDOOR');
  const indoorStops = enriched.filter((s) => s.env === 'INDOOR');
  const shelteredStops = enriched.filter((s) => s.env === 'SHELTERED');
  const unknownStops = enriched.filter((s) => s.env === 'UNKNOWN');

  const newSequence: typeof enriched = [];

  // Assign Morning: take an outdoor if available, else unknown, else sheltered, else indoor
  if (outdoorStops.length > 0) {
    newSequence.push(outdoorStops.shift()!);
  } else if (unknownStops.length > 0) {
    newSequence.push(unknownStops.shift()!);
  } else if (shelteredStops.length > 0) {
    newSequence.push(shelteredStops.shift()!);
  } else if (indoorStops.length > 0) {
    newSequence.push(indoorStops.shift()!);
  }

  // Assign Midday / Afternoon: strictly prioritize verified INDOOR, then SHELTERED
  if (indoorStops.length > 0) {
    newSequence.push(indoorStops.shift()!);
  } else if (shelteredStops.length > 0) {
    newSequence.push(shelteredStops.shift()!);
  } else if (unknownStops.length > 0) {
    newSequence.push(unknownStops.shift()!);
  } else if (outdoorStops.length > 0) {
    newSequence.push(outdoorStops.shift()!);
  }

  // Assign Evening: take outdoor if available, else unknown, else sheltered, else indoor
  if (outdoorStops.length > 0) {
    newSequence.push(outdoorStops.shift()!);
  } else if (unknownStops.length > 0) {
    newSequence.push(unknownStops.shift()!);
  } else if (shelteredStops.length > 0) {
    newSequence.push(shelteredStops.shift()!);
  } else if (indoorStops.length > 0) {
    newSequence.push(indoorStops.shift()!);
  }

  // Remaining stops
  const remaining = [...indoorStops, ...shelteredStops, ...unknownStops, ...outdoorStops];
  newSequence.push(...remaining);

  // Check how many positions changed
  let changesCount = 0;
  const explanations: string[] = [];

  const timeSlots: Array<'Morning' | 'Afternoon' | 'Evening' | 'Night'> = ['Morning', 'Afternoon', 'Evening', 'Night'];
  const times = ['08:30 AM', '01:30 PM', '05:00 PM', '07:30 PM'];

  const optimizedStops: ItineraryStop[] = newSequence.map((stop, idx) => {
    const originalIdx = stops.findIndex((s) => s.id === stop.id);
    if (originalIdx !== idx) {
      changesCount++;
    }

    const assignedSlot = timeSlots[Math.min(idx, timeSlots.length - 1)];
    const assignedTime = times[Math.min(idx, times.length - 1)];

    if (stop.env === 'INDOOR' && assignedSlot === 'Afternoon') {
      explanations.push(`Scheduled "${stop.placeName}" (Indoor) during peak midday heat (01:30 PM) for climate-sheltered comfort.`);
    } else if (stop.env === 'SHELTERED' && assignedSlot === 'Afternoon') {
      explanations.push(`Scheduled "${stop.placeName}" (Sheltered) during peak midday heat (01:30 PM) for covered shade.`);
    } else if (stop.env === 'OUTDOOR' && (assignedSlot === 'Morning' || assignedSlot === 'Evening')) {
      explanations.push(`Moved "${stop.placeName}" (Outdoor) to ${assignedSlot} (${assignedTime}) during cooler solar hours.`);
    }

    return {
      id: stop.id,
      stopOrder: idx + 1,
      timeSlot: assignedSlot,
      time: assignedTime,
      placeId: stop.placeId,
      placeName: stop.placeName,
      category: stop.category,
      durationMinutes: stop.durationMinutes,
      costInr: stop.costInr,
      costStatus: stop.costStatus,
      localTips: stop.localTips,
      transportToNext: stop.transportToNext,
      latitude: stop.latitude,
      longitude: stop.longitude,
    };
  });

  return {
    hasSuggestions: changesCount > 0,
    optimizedStops,
    changesCount,
    explanations,
  };
}

