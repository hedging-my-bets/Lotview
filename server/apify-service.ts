import type { InsertMarketListing, DealershipApiKeys } from '@shared/schema';
import { storage } from './storage';

export interface ApifySearchParams {
  make: string;
  model: string;
  yearMin?: number;
  yearMax?: number;
  postalCode?: string;
  radiusKm?: number;
  maxResults?: number;
  dealershipId?: number;
}

export interface ApifyAutoTraderListing {
  id: string;
  url: string;
  title: string;
  price: number;
  year: number;
  make: string;
  model: string;
  trim?: string;
  mileage?: number;
  location?: string;
  dealer?: string;
  listingType?: string;
  imageUrl?: string;
}

export class ApifyService {
  private apiToken: string;
  private autoTraderActorId: string;

  constructor(apiToken: string, actorId?: string) {
    if (!apiToken) {
      throw new Error('Apify API token is required');
    }
    this.apiToken = apiToken;
    this.autoTraderActorId = actorId || 'fayoussef/autotrader-canada'; // Default to official actor
  }

  /**
   * Trigger AutoTrader.ca scraper run
   */
  async scrapeAutoTrader(params: ApifySearchParams): Promise<ApifyAutoTraderListing[]> {
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
      // Build actor input
      const input = {
        make: make.toLowerCase(),
        model: model.toLowerCase(),
        minYear: yearMin,
        maxYear: yearMax,
        location: postalCode || 'Canada',
        maxResults: Math.min(maxResults, 200)
      };

      console.log(`[Apify] Starting AutoTrader.ca scrape for ${make} ${model}`);

      // Start actor run
      const runResponse = await fetch(
        `https://api.apify.com/v2/acts/${this.autoTraderActorId}/runs?token=${this.apiToken}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(input)
        }
      );

      if (!runResponse.ok) {
        const errorText = await runResponse.text();
        console.error(`[Apify] Run start error (${runResponse.status}):`, errorText);
        throw new Error(`Apify run start error: ${runResponse.status}`);
      }

      const runData = await runResponse.json();
      const runId = runData.data.id;
      const defaultDatasetId = runData.data.defaultDatasetId;

      console.log(`[Apify] Run started: ${runId}, waiting for completion...`);

      // Wait for run to complete (poll status)
      let status = 'RUNNING';
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes max

      while (status === 'RUNNING' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        
        const statusResponse = await fetch(
          `https://api.apify.com/v2/acts/${this.autoTraderActorId}/runs/${runId}?token=${this.apiToken}`
        );
        
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          status = statusData.data.status;
          console.log(`[Apify] Run status: ${status}`);
        }
        
        attempts++;
      }

      if (status !== 'SUCCEEDED') {
        throw new Error(`Apify run did not complete successfully. Status: ${status}`);
      }

      // Fetch dataset results
      const datasetResponse = await fetch(
        `https://api.apify.com/v2/datasets/${defaultDatasetId}/items?token=${this.apiToken}&format=json`
      );

      if (!datasetResponse.ok) {
        throw new Error(`Failed to fetch dataset: ${datasetResponse.status}`);
      }

      const listings: ApifyAutoTraderListing[] = await datasetResponse.json();
      
      console.log(`[Apify] Retrieved ${listings.length} listings from dataset`);
      
      return listings;
    } catch (error) {
      console.error('[Apify] Scrape error:', error);
      throw error;
    }
  }

  /**
   * Convert Apify listing to our database format
   */
  convertToMarketListing(listing: ApifyAutoTraderListing, dealershipId: number): InsertMarketListing {
    // Determine listing type
    const listingType: 'dealer' | 'private' = 
      listing.listingType?.toLowerCase().includes('private') ? 'private' : 'dealer';

    return {
      dealershipId,
      externalId: listing.id,
      source: 'apify_autotrader',
      listingType,
      year: listing.year,
      make: listing.make.toUpperCase(),
      model: listing.model.toUpperCase(),
      trim: listing.trim || null,
      price: listing.price,
      mileage: listing.mileage || null,
      location: listing.location || 'Canada',
      postalCode: null,
      latitude: null,
      longitude: null,
      sellerName: listing.dealer || (listingType === 'private' ? 'Private Seller' : 'Dealer'),
      imageUrl: listing.imageUrl || null,
      listingUrl: listing.url || `https://www.autotrader.ca/listing/${listing.id}`,
      postedDate: new Date(),
      isActive: true
    };
  }

  /**
   * Scrape and convert to our format
   */
  async scrapeAndConvert(params: ApifySearchParams): Promise<InsertMarketListing[]> {
    const dealershipId = params.dealershipId || 1; // Default to dealership 1 for backwards compat
    const listings = await this.scrapeAutoTrader(params);
    return listings
      .filter(l => l.price > 1000) // Filter out invalid prices
      .map(l => this.convertToMarketListing(l, dealershipId));
  }
}

// Cache for service instances per dealership
const serviceCache = new Map<number, ApifyService>();

/**
 * Get Apify service for a specific dealership
 * Fetches API token from database, caches instance for performance
 */
export async function getApifyServiceForDealership(dealershipId: number): Promise<ApifyService | null> {
  // Check cache first
  if (serviceCache.has(dealershipId)) {
    return serviceCache.get(dealershipId)!;
  }
  
  try {
    const apiKeys = await storage.getDealershipApiKeys(dealershipId);
    
    if (apiKeys?.apifyToken) {
      const service = new ApifyService(apiKeys.apifyToken, apiKeys.apifyActorId || undefined);
      serviceCache.set(dealershipId, service);
      console.log(`[Apify] Service initialized for dealership ${dealershipId}${apiKeys.apifyActorId ? ` with actor ${apiKeys.apifyActorId}` : ''}`);
      return service;
    } else {
      console.warn(`[Apify] API token not configured for dealership ${dealershipId}`);
      return null;
    }
  } catch (error) {
    console.error(`[Apify] Error loading API token for dealership ${dealershipId}:`, error);
    return null;
  }
}

/**
 * Clear cached service instance (use when API token is updated)
 */
export function clearApifyCache(dealershipId?: number) {
  if (dealershipId) {
    serviceCache.delete(dealershipId);
  } else {
    serviceCache.clear();
  }
}

// Legacy singleton for backwards compatibility (uses env var)
let apifyService: ApifyService | null = null;

export function getApifyService(): ApifyService | null {
  if (!apifyService) {
    const apiToken = process.env.APIFY_API_TOKEN;
    const actorId = process.env.APIFY_AUTOTRADER_ACTOR_ID;
    
    if (apiToken) {
      apifyService = new ApifyService(apiToken, actorId);
      console.log('[Apify] Service initialized from env', actorId ? `with actor ${actorId}` : 'with default actor');
    } else {
      console.warn('[Apify] API token not configured (APIFY_API_TOKEN) - use getApifyServiceForDealership() instead');
    }
  }
  return apifyService;
}
