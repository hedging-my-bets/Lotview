import { storage } from './storage';
import { getMarketCheckService } from './marketcheck-service';
import { getApifyService } from './apify-service';
import { autoTraderScraper } from './autotrader-scraper';
import type { InsertMarketListing } from '@shared/schema';

export interface MarketAggregationParams {
  make: string;
  model: string;
  yearMin?: number;
  yearMax?: number;
  postalCode?: string;
  radiusKm?: number;
  maxResults?: number;
}

export interface MarketAggregationResult {
  totalListings: number;
  marketCheckCount: number;
  apifyCount: number;
  scraperCount: number;
  duplicatesRemoved: number;
  success: boolean;
  errors: string[];
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
      duplicatesRemoved: 0,
      success: true,
      errors: []
    };

    const allListings: InsertMarketListing[] = [];
    const seenUrls = new Set<string>();

    console.log(`[MarketAggregation] Starting data collection for ${params.make} ${params.model}`);

    // 1. Try MarketCheck API (highest priority)
    const marketCheckService = getMarketCheckService();
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
    const apifyService = getApifyService();
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
        
        for (const scraperListing of scraperListings) {
          const listing: InsertMarketListing = {
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
      } catch (error) {
        console.error('[MarketAggregation] Scraper error:', error);
        result.errors.push(`Scraper: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      console.log('[MarketAggregation] Skipping scraper (sufficient premium data)');
    }

    // Save all unique listings to database
    let savedCount = 0;
    for (const listing of allListings) {
      try {
        // Check if listing already exists by URL
        const existingListings = await storage.getMarketListings({
          make: listing.make,
          model: listing.model
        });
        
        const alreadyExists = existingListings.some(e => e.listingUrl === listing.listingUrl);
        
        if (!alreadyExists) {
          await storage.createMarketListing(listing);
          savedCount++;
        }
      } catch (error) {
        console.error(`[MarketAggregation] Error saving listing:`, error);
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
