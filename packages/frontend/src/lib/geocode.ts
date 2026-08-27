const CACHE_KEY = "geocode_cache";

interface LatLng {
  lat: number;
  lng: number;
}

function getCache(): Record<string, LatLng> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

function setCache(cache: Record<string, LatLng>) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

let lastRequestTime = 0;

export async function geocodeAddress(query: string): Promise<LatLng | null> {
  if (!query.trim()) return null;

  // Check cache first
  const cache = getCache();
  if (cache[query]) return cache[query];

  // Rate limit: 1 request per second (Nominatim policy)
  const now = Date.now();
  const wait = Math.max(0, 1000 - (now - lastRequestTime));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestTime = Date.now();

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=nl&limit=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "y-app/1.0" },
    });
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.length) return null;

    const result: LatLng = {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
    };

    // Save to cache
    const updatedCache = getCache();
    updatedCache[query] = result;
    setCache(updatedCache);

    return result;
  } catch (e) {
    console.warn("Geocoding failed for:", query, e);
    return null;
  }
}
