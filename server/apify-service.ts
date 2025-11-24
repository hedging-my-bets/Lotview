import type { InsertMarketListing } from '@shared/schema';

export interface ApifySearchParams {
  make: string;
  model: string;
  yearMin?: number;
  yearMax?: number;
  postalCode?: string;
  radiusKm?: number;
  maxResults?: number;
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
  private autoTraderActorId = 'fayoussef/autotrader-canada'; // Official Apify AutoTrader.ca actor

  constructor(apiToken: string) {
    if (!apiToken) {
      throw new Error('Apify API token is required');
    }
    this.apiToken = apiToken;
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
  convertToMarketListing(listing: ApifyAutoTraderListing): InsertMarketListing {
    // Determine listing type
    const listingType: 'dealer' | 'private' = 
      listing.listingType?.toLowerCase().includes('private') ? 'private' : 'dealer';

    return {
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
    const listings = await this.scrapeAutoTrader(params);
    return listings
      .filter(l => l.price > 1000) // Filter out invalid prices
      .map(l => this.convertToMarketListing(l));
  }
}

// Export singleton instance (will be initialized with API token from env)
let apifyService: ApifyService | null = null;

export function getApifyService(): ApifyService | null {
  if (!apifyService) {
    const apiToken = process.env.APIFY_API_TOKEN;
    if (apiToken) {
      apifyService = new ApifyService(apiToken);
      console.log('[Apify] Service initialized');
    } else {
      console.warn('[Apify] API token not configured (APIFY_API_TOKEN)');
    }
  }
  return apifyService;
}
