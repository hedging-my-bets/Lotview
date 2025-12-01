import { storage } from './storage';
import { getMarketCheckService, getMarketCheckServiceForDealership } from './marketcheck-service';
import { getApifyService, getApifyServiceForDealership } from './apify-service';
import { autoTraderScraper } from './autotrader-scraper';
import { kijijiScraper } from './kijiji-scraper';
import { craigslistScraper } from './craigslist-scraper';
import type { InsertMarketListing } from '@shared/schema';

export interface MarketAggregationParams {
  make: string;
  model: string;
  yearMin?: number;
  yearMax?: number;
  postalCode?: string;
  radiusKm?: number;
  maxResults?: number;
  dealershipId?: number;
}

export interface MarketAggregationResult {
  totalListings: number;
  marketCheckCount: number;
  apifyCount: number;
  scraperCount: number;
  kijijiCount: number;
  craigslistCount: number;
  duplicatesRemoved: number;
  success: boolean;
  errors: string[];
  sources: string[];
}

/**
 * Market Data Aggregation Service
 * 
 * Orchestrates data collection from multiple sources in priority order:
 * 1. MarketCheck API (highest quality, most reliable)
 * 2. Apify AutoTrader.ca actor (managed scraping)
 * 3. Direct Puppeteer scraper (fallback)
 * 
 * Handles intelligent deduplication and data quality scoring.
 */
export class MarketAggregationService {
  /**
   * Fetch market data from all available sources
   */
  async aggregateMarketData(params: MarketAggregationParams): Promise<MarketAggregationResult> {
    const result: MarketAggregationResult = {
      totalListings: 0,
      marketCheckCount: 0,
      apifyCount: 0,
      scraperCount: 0,
      kijijiCount: 0,
      craigslistCount: 0,
      duplicatesRemoved: 0,
      success: true,
      errors: [],
      sources: []
    };

    const allListings: InsertMarketListing[] = [];
    const seenUrls = new Set<string>();

    console.log(`[MarketAggregation] Starting data collection for ${params.make} ${params.model}${params.dealershipId ? ` (dealership ${params.dealershipId})` : ''}`);

    // 1. Try MarketCheck API (highest priority)
    // Use dealership-specific API key if available, otherwise fall back to env var
    const marketCheckService = params.dealershipId 
      ? await getMarketCheckServiceForDealership(params.dealershipId)
      : getMarketCheckService();
      
    if (marketCheckService) {
      try {
        console.log('[MarketAggregation] Fetching from MarketCheck API...');
        const marketCheckListings = await marketCheckService.searchAndConvert(params);
        
        for (const listing of marketCheckListings) {
          if (!seenUrls.has(listing.listingUrl)) {
            allListings.push(listing);
            seenUrls.add(listing.listingUrl);
            result.marketCheckCount++;
          } else {
            result.duplicatesRemoved++;
          }
        }
        
        console.log(`[MarketAggregation] MarketCheck: ${result.marketCheckCount} unique listings`);
      } catch (error) {
        console.error('[MarketAggregation] MarketCheck error:', error);
        result.errors.push(`MarketCheck: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      console.log('[MarketAggregation] MarketCheck API not configured');
      result.errors.push('MarketCheck API key not configured');
    }

    // 2. Try Apify AutoTrader.ca actor (second priority)
    // Use dealership-specific API token if available, otherwise fall back to env var
    const apifyService = params.dealershipId 
      ? await getApifyServiceForDealership(params.dealershipId)
      : getApifyService();
      
    if (apifyService) {
      try {
        console.log('[MarketAggregation] Fetching from Apify AutoTrader.ca...');
        const apifyListings = await apifyService.scrapeAndConvert(params);
        
        for (const listing of apifyListings) {
          if (!seenUrls.has(listing.listingUrl)) {
            allListings.push(listing);
            seenUrls.add(listing.listingUrl);
            result.apifyCount++;
          } else {
            result.duplicatesRemoved++;
          }
        }
        
        console.log(`[MarketAggregation] Apify: ${result.apifyCount} unique listings`);
      } catch (error) {
        console.error('[MarketAggregation] Apify error:', error);
        result.errors.push(`Apify: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      console.log('[MarketAggregation] Apify service not configured');
      result.errors.push('Apify API token not configured');
    }

    // 3. Try direct Puppeteer scraper (fallback)
    // Only use if we have few results from premium sources
    const premiumListingsCount = result.marketCheckCount + result.apifyCount;
    if (premiumListingsCount < 20) {
      try {
        console.log('[MarketAggregation] Using fallback Puppeteer scraper...');
        const scraperParams = {
          make: params.make,
          model: params.model,
          yearMin: params.yearMin,
          yearMax: params.yearMax,
          postalCode: params.postalCode,
          radiusKm: params.radiusKm,
          maxResults: params.maxResults || 50
        };
        
        const scraperListings = await autoTraderScraper.scrapeListings(scraperParams);
        const dealershipId = params.dealershipId || 1; // Default to dealership 1 for backwards compat
        
        for (const scraperListing of scraperListings) {
          const listing: InsertMarketListing = {
            dealershipId,
            externalId: scraperListing.externalId,
            source: 'autotrader_scraper',
            listingType: scraperListing.listingType,
            year: scraperListing.year,
            make: scraperListing.make,
            model: scraperListing.model,
            trim: scraperListing.trim || null,
            price: scraperListing.price,
            mileage: scraperListing.mileage || null,
            location: scraperListing.location || 'Canada',
            postalCode: null,
            latitude: null,
            longitude: null,
            sellerName: scraperListing.sellerName,
            imageUrl: scraperListing.imageUrl || null,
            listingUrl: scraperListing.listingUrl,
            postedDate: scraperListing.postedDate || null,
            isActive: true
          };
          
          if (!seenUrls.has(listing.listingUrl)) {
            allListings.push(listing);
            seenUrls.add(listing.listingUrl);
            result.scraperCount++;
          } else {
            result.duplicatesRemoved++;
          }
        }
        
        console.log(`[MarketAggregation] Scraper: ${result.scraperCount} unique listings`);
        if (result.scraperCount > 0) result.sources.push('autotrader');
      } catch (error) {
        console.error('[MarketAggregation] Scraper error:', error);
        result.errors.push(`Scraper: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      console.log('[MarketAggregation] Skipping scraper (sufficient premium data)');
    }

    // 4. Try Kijiji Autos scraper
    try {
      console.log('[MarketAggregation] Fetching from Kijiji Autos...');
      const kijijiListings = await kijijiScraper.searchAndConvert({
        make: params.make,
        model: params.model,
        yearMin: params.yearMin,
        yearMax: params.yearMax,
        postalCode: params.postalCode,
        radiusKm: params.radiusKm,
        maxResults: Math.floor((params.maxResults || 50) / 2)
      });
      
      const dealershipId = params.dealershipId || 1;
      for (const listing of kijijiListings) {
        listing.dealershipId = dealershipId;
        if (!seenUrls.has(listing.listingUrl)) {
          allListings.push(listing);
          seenUrls.add(listing.listingUrl);
          result.kijijiCount++;
        } else {
          result.duplicatesRemoved++;
        }
      }
      
      console.log(`[MarketAggregation] Kijiji: ${result.kijijiCount} unique listings`);
      if (result.kijijiCount > 0) result.sources.push('kijiji');
    } catch (error) {
      console.error('[MarketAggregation] Kijiji error:', error);
      result.errors.push(`Kijiji: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // 5. Try Craigslist scraper
    try {
      console.log('[MarketAggregation] Fetching from Craigslist...');
      const craigslistListings = await craigslistScraper.searchAndConvert({
        make: params.make,
        model: params.model,
        yearMin: params.yearMin,
        yearMax: params.yearMax,
        maxResults: Math.floor((params.maxResults || 50) / 3)
      });
      
      const dealershipId = params.dealershipId || 1;
      for (const listing of craigslistListings) {
        listing.dealershipId = dealershipId;
        if (!seenUrls.has(listing.listingUrl)) {
          allListings.push(listing);
          seenUrls.add(listing.listingUrl);
          result.craigslistCount++;
        } else {
          result.duplicatesRemoved++;
        }
      }
      
      console.log(`[MarketAggregation] Craigslist: ${result.craigslistCount} unique listings`);
      if (result.craigslistCount > 0) result.sources.push('craigslist');
    } catch (error) {
      console.error('[MarketAggregation] Craigslist error:', error);
      result.errors.push(`Craigslist: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Add premium source markers
    if (result.marketCheckCount > 0) result.sources.push('marketcheck');
    if (result.apifyCount > 0) result.sources.push('apify');

    // Save all unique listings to database (batch check existing URLs)
    let savedCount = 0;
    const listingUrls = allListings.map(l => l.listingUrl);
    const dealershipId = params.dealershipId || 1; // Default to dealership 1 for backwards compat
    
    // Fetch all existing listings by URLs (cross-make/model deduplication)
    let existingUrls = new Set<string>();
    try {
      const existingListings = await storage.getMarketListingsByUrls(dealershipId, listingUrls);
      existingUrls = new Set(existingListings.map(l => l.listingUrl));
    } catch (error) {
      console.error('[MarketAggregation] Error fetching existing listings:', error);
    }
    
    // Save only new listings
    for (const listing of allListings) {
      if (!existingUrls.has(listing.listingUrl)) {
        try {
          await storage.createMarketListing(listing);
          savedCount++;
        } catch (error) {
          // Handle unique constraint violations gracefully (race conditions)
          if (error instanceof Error && (error.message.includes('unique') || error.message.includes('duplicate key'))) {
            console.log(`[MarketAggregation] Listing already exists (race condition): ${listing.listingUrl}`);
          } else {
            console.error(`[MarketAggregation] Error saving listing:`, error);
          }
        }
      }
    }

    result.totalListings = savedCount;
    result.success = result.totalListings > 0 || result.errors.length === 0;

    console.log(`[MarketAggregation] Complete: ${result.totalListings} new listings saved`);
    console.log(`[MarketAggregation] Breakdown: MarketCheck=${result.marketCheckCount}, Apify=${result.apifyCount}, Scraper=${result.scraperCount}`);
    
    if (result.errors.length > 0) {
      console.log(`[MarketAggregation] Errors: ${result.errors.join(', ')}`);
    }

    return result;
  }
}

// Export singleton instance
export const marketAggregationService = new MarketAggregationService();
