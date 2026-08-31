// lib/geoUtils.ts

export function getDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function validateCoordinates(
  physical: { lat: number; lng: number } | null,
  pinned: { lat: number; lng: number } | null,
  maxTetherMeters = 100
): { valid: boolean; error?: string } {
  if (!pinned || !pinned.lat || !pinned.lng) {
    return { valid: false, error: "Coordinates are missing." };
  }

  if (pinned.lat === 0 && pinned.lng === 0) {
    return { valid: false, error: "Invalid default coordinates (0, 0) detected." };
  }

  if (pinned.lat < -90 || pinned.lat > 90 || pinned.lng < -180 || pinned.lng > 180) {
    return { valid: false, error: "Coordinates are outside of physical bounds." };
  }

  if (physical) {
    const dist = getDistanceMeters(physical.lat, physical.lng, pinned.lat, pinned.lng);
    if (dist > maxTetherMeters) {
      return {
        valid: false,
        error: `Pin is ${Math.round(dist)}m away. Maximum allowed adjustment distance is ${maxTetherMeters}m.`,
      };
    }
  }

  return { valid: true };
}