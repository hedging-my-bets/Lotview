import type { InsertMarketListing, DealershipApiKeys } from '@shared/schema';
import { storage } from './storage';

export interface MarketCheckSearchParams {
  make: string;
  model: string;
  yearMin?: number;
  yearMax?: number;
  postalCode?: string;
  radiusKm?: number;
  maxResults?: number;
  dealershipId?: number;
}

export interface MarketCheckListing {
  id: string;
  vin?: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  price: number;
  miles?: number;
  dealer_name?: string;
  seller_type: 'dealer' | 'private';
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  dom?: number; // Days on market
  last_seen_at?: string;
  vdp_url?: string;
  photo_url?: string;
}

export interface MarketCheckResponse {
  num_found: number;
  listings: MarketCheckListing[];
}

export class MarketCheckService {
  private apiKey: string;
  private baseUrl = 'https://api.marketcheck.com/v2';

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('MarketCheck API key is required');
    }
    this.apiKey = apiKey;
  }

  /**
   * Search for vehicle listings (dealer + private party)
   */
  async searchListings(params: MarketCheckSearchParams): Promise<MarketCheckListing[]> {
    const {
      make,
      model,
      yearMin,
      yearMax,
      postalCode,
      radiusKm,
      maxResults = 100
    } = params;

    try {
      // Build query parameters
      const queryParams = new URLSearchParams({
        api_key: this.apiKey,
        make: make.toUpperCase(),
        model: model.toUpperCase(),
        rows: Math.min(maxResults, 100).toString(),
        start: '0'
      });

      // Add year range
      if (yearMin && yearMax) {
        queryParams.append('year', `${yearMin}-${yearMax}`);
      } else if (yearMin) {
        queryParams.append('year', `${yearMin}-`);
      } else if (yearMax) {
        queryParams.append('year', `-${yearMax}`);
      }

      // Add location/radius
      if (postalCode) {
        queryParams.append('zip', postalCode.replace(/\s/g, ''));
      }
      if (radiusKm) {
        // Convert km to miles for MarketCheck API
        const radiusMiles = Math.round(radiusKm * 0.621371);
        queryParams.append('radius', radiusMiles.toString());
      }

      // Search Canadian listings
      queryParams.append('country', 'CA');

      const url = `${this.baseUrl}/search/car/active?${queryParams.toString()}`;
      
      console.log(`[MarketCheck] Searching: ${make} ${model} ${yearMin}-${yearMax}`);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[MarketCheck] API error (${response.status}):`, errorText);
        throw new Error(`MarketCheck API error: ${response.status}`);
      }

      const data: MarketCheckResponse = await response.json();
      
      console.log(`[MarketCheck] Found ${data.num_found} listings`);
      
      return data.listings || [];
    } catch (error) {
      console.error('[MarketCheck] Search error:', error);
      throw error;
    }
  }

  /**
   * Convert MarketCheck listing to our database format
   */
  convertToMarketListing(listing: MarketCheckListing, dealershipId: number): InsertMarketListing | null {
    // Validate required fields
    if (!listing.make || !listing.model) {
      console.warn(`[MarketCheck] Skipping listing ${listing.id} - missing make or model`);
      return null;
    }

    // Convert miles to kilometers
    const mileage = listing.miles ? Math.round(listing.miles * 1.60934) : null;
    
    // Build location string
    let location = '';
    if (listing.city && listing.state) {
      location = `${listing.city}, ${listing.state}`;
    } else if (listing.city) {
      location = listing.city;
    } else if (listing.state) {
      location = listing.state;
    }

    return {
      dealershipId,
      externalId: listing.id,
      source: 'marketcheck',
      listingType: listing.seller_type,
      year: listing.year,
      make: listing.make.toUpperCase(),
      model: listing.model.toUpperCase(),
      trim: listing.trim || null,
      price: listing.price,
      mileage,
      location: location || 'Canada',
      postalCode: null,
      latitude: listing.latitude ? listing.latitude.toString() : null,
      longitude: listing.longitude ? listing.longitude.toString() : null,
      sellerName: listing.dealer_name || (listing.seller_type === 'private' ? 'Private Seller' : 'Dealer'),
      imageUrl: listing.photo_url || null,
      listingUrl: listing.vdp_url || `https://marketcheck.com/listing/${listing.id}`,
      postedDate: listing.last_seen_at ? new Date(listing.last_seen_at) : null,
      isActive: true
    };
  }

  /**
   * Search and convert to our format
   */
  async searchAndConvert(params: MarketCheckSearchParams): Promise<InsertMarketListing[]> {
    const dealershipId = params.dealershipId || 1; // Default to dealership 1 for backwards compat
    const listings = await this.searchListings(params);
    return listings
      .filter(l => l.price > 0) // Filter out listings without prices
      .map(l => this.convertToMarketListing(l, dealershipId))
      .filter((l): l is InsertMarketListing => l !== null); // Filter out null results
  }
}

// Cache for service instances per dealership
const serviceCache = new Map<number, MarketCheckService>();

/**
 * Get MarketCheck service for a specific dealership
 * Fetches API key from database, caches instance for performance
 */
export async function getMarketCheckServiceForDealership(dealershipId: number): Promise<MarketCheckService | null> {
  // Check cache first
  if (serviceCache.has(dealershipId)) {
    return serviceCache.get(dealershipId)!;
  }
  
  try {
    const apiKeys = await storage.getDealershipApiKeys(dealershipId);
    
    if (apiKeys?.marketcheckKey) {
      const service = new MarketCheckService(apiKeys.marketcheckKey);
      serviceCache.set(dealershipId, service);
      console.log(`[MarketCheck] Service initialized for dealership ${dealershipId}`);
      return service;
    } else {
      console.warn(`[MarketCheck] API key not configured for dealership ${dealershipId}`);
      return null;
    }
  } catch (error) {
    console.error(`[MarketCheck] Error loading API key for dealership ${dealershipId}:`, error);
    return null;
  }
}

/**
 * Clear cached service instance (use when API key is updated)
 */
export function clearMarketCheckCache(dealershipId?: number) {
  if (dealershipId) {
    serviceCache.delete(dealershipId);
  } else {
    serviceCache.clear();
  }
}

// Legacy singleton for backwards compatibility (uses env var or default dealership)
let marketCheckService: MarketCheckService | null = null;

export function getMarketCheckService(): MarketCheckService | null {
  if (!marketCheckService) {
    const apiKey = process.env.MARKETCHECK_API_KEY;
    if (apiKey) {
      marketCheckService = new MarketCheckService(apiKey);
      console.log('[MarketCheck] Service initialized from env');
    } else {
      console.warn('[MarketCheck] API key not configured (MARKETCHECK_API_KEY) - use getMarketCheckServiceForDealership() instead');
    }
  }
  return marketCheckService;
}
