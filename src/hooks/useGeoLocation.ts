import { useState, useEffect, useCallback } from 'react';

interface GeoLocation {
  lat: number;
  lon: number;
  city: string;
  country: string;
  countryCode: string;
}

interface ServerLocation {
  id: number;
  city: string;
  countryCode: string;
  lat: number;
  lng: number;
}

// Haversine formula - calculates distance between two coordinates in miles
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Free IP geolocation - no API key needed, IP not stored
async function getLocationFromIP(): Promise<GeoLocation | null> {
  try {
    // Try ipapi.co first (free, 45 requests/min)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const res = await fetch('https://ipapi.co/json/', {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(timeoutId);
    
    if (!res.ok) return null;
    const data = await res.json();
    
    if (data.latitude && data.longitude) {
      return {
        lat: data.latitude,
        lon: data.longitude,
        city: data.city,
        country: data.country_name,
        countryCode: data.country_code,
      };
    }
    return null;
  } catch {
    // Fallback: try ip-api.com
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch('http://ip-api.com/json/?fields=lat,lon,city,country,countryCode', {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) return null;
      const data = await res.json();
      if (data.lat && data.lon) {
        return {
          lat: data.lat,
          lon: data.lon,
          city: data.city,
          country: data.country,
          countryCode: data.countryCode,
        };
      }
      return null;
    } catch {
      return null;
    }
  }
}

export function useClosestServer(servers: ServerLocation[]) {
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [closestServer, setClosestServer] = useState<ServerLocation | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const detect = useCallback(async () => {
    setLoading(true);
    const loc = await getLocationFromIP();
    setLocation(loc);
    
    if (loc && servers.length > 0) {
      let closest = servers[0];
      let minDist = Infinity;
      
      for (const server of servers) {
        const dist = haversineDistance(loc.lat, loc.lon, server.lat, server.lng);
        if (dist < minDist) {
          minDist = dist;
          closest = server;
        }
      }
      
      setClosestServer(closest);
      setDistance(Math.round(minDist));
    }
    
    setLoading(false);
  }, [servers]);

  useEffect(() => {
    if (servers.length > 0) {
      detect();
    }
  }, [servers, detect]);

  return { location, closestServer, distance, loading, detect };
}

export type { GeoLocation, ServerLocation };
