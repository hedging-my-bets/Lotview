/**
 * Geocoding Service for Canadian Postal Codes
 * Uses Geocoder.ca API for postal code to latitude/longitude conversion
 */

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  city?: string;
  province?: string;
  postalCode?: string;
  query?: string;
}

export interface DistanceCalculationResult {
  distanceKm: number;
  withinRadius: boolean;
}

export class GeocodingService {
  private cache: Map<string, GeocodeResult> = new Map();
  private inFlight: Map<string, Promise<GeocodeResult | null>> = new Map();
  private maxCacheSize = 500;
  private maxQueryLength = 120;

  private buildCacheKey(prefix: 'postal' | 'location', value: string): string {
    return `${prefix}:${value}`;
  }

  private buildGeocoderUrl(query: string): string {
    const username = process.env.GEOCODER_CA_USERNAME;
    const password = process.env.GEOCODER_CA_PASSWORD;
    const auth = username && password
      ? `&auth=${encodeURIComponent(`${username}:${password}`)}`
      : '';
    return `https://geocoder.ca/?locate=${encodeURIComponent(query)}&geoit=xml${auth}`;
  }

  private async fetchGeocode(query: string, cacheKey: string): Promise<GeocodeResult | null> {
    if (this.inFlight.has(cacheKey)) {
      return this.inFlight.get(cacheKey)!;
    }

    const request = (async () => {
      try {
        const url = this.buildGeocoderUrl(query);
        const response = await fetch(url);
        const xmlText = await response.text();

        const latMatch = xmlText.match(/<latt>([-\d.]+)<\/latt>/);
        const lonMatch = xmlText.match(/<longt>([-\d.]+)<\/longt>/);
        const cityMatch = xmlText.match(/<city>(.*?)<\/city>/);
        const provMatch = xmlText.match(/<prov>(.*?)<\/prov>/);

        if (!latMatch || !lonMatch) {
          console.warn(`[Geocoding] Could not geocode query: ${query}`);
          return null;
        }

        const result: GeocodeResult = {
          latitude: parseFloat(latMatch[1]),
          longitude: parseFloat(lonMatch[1]),
          city: cityMatch ? cityMatch[1] : undefined,
          province: provMatch ? provMatch[1] : undefined,
          query
        };

        this.cache.set(cacheKey, result);
        if (this.cache.size > this.maxCacheSize) {
          const firstKey = this.cache.keys().next().value;
          if (firstKey) this.cache.delete(firstKey);
        }

        return result;
      } catch (error) {
        console.error(`[Geocoding] Error geocoding query ${query}:`, error);
        return null;
      } finally {
        this.inFlight.delete(cacheKey);
      }
    })();

    this.inFlight.set(cacheKey, request);
    return request;
  }

  /**
   * Geocode a Canadian postal code to lat/lon using Geocoder.ca
   * Free tier available for non-commercial use, otherwise $1 per 200 lookups
   */
  async geocodePostalCode(postalCode: string): Promise<GeocodeResult | null> {
    // Normalize postal code (remove spaces, uppercase)
    const normalized = postalCode.replace(/\s/g, '').toUpperCase();
    const cacheKey = this.buildCacheKey('postal', normalized);
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }
    
    try {
      const result = await this.fetchGeocode(normalized, cacheKey);
      if (result) {
        result.postalCode = normalized;
      }
      return result;
    } catch (error) {
      console.error(`[Geocoding] Error geocoding postal code ${postalCode}:`, error);
      return null;
    }
  }

  /**
   * Geocode a city/province/location string to lat/lon using Geocoder.ca
   */
  async geocodeLocation(location: string): Promise<GeocodeResult | null> {
    if (!location) return null;
    const trimmed = location.trim().replace(/\s+/g, ' ');
    if (!trimmed || trimmed.length > this.maxQueryLength) return null;

    const cacheKey = this.buildCacheKey('location', trimmed.toLowerCase());
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    return this.fetchGeocode(trimmed, cacheKey);
  }

  /**
   * Calculate distance between two lat/lon coordinates using Haversine formula
   * Returns distance in kilometers
   */
  calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
      Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return Math.round(distance * 10) / 10; // Round to 1 decimal place
  }

  /**
   * Check if a location (lat/lon) is within a given radius (in km) of a postal code
   */
  async isWithinRadius(
    targetLat: number,
    targetLon: number,
    postalCode: string,
    radiusKm: number
  ): Promise<DistanceCalculationResult> {
    const geocoded = await this.geocodePostalCode(postalCode);
    
    if (!geocoded) {
      return {
        distanceKm: 0,
        withinRadius: false
      };
    }
    
    const distance = this.calculateDistance(
      geocoded.latitude,
      geocoded.longitude,
      targetLat,
      targetLon
    );
    
    return {
      distanceKm: distance,
      withinRadius: distance <= radiusKm
    };
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Clear the geocoding cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache size for monitoring
   */
  getCacheSize(): number {
    return this.cache.size;
  }
}

// Export singleton instance
export const geocodingService = new GeocodingService();
