import { storage } from './storage';
import { getMarketCheckService, getMarketCheckServiceForDealership } from './marketcheck-service';
import { getApifyService, getApifyServiceForDealership } from './apify-service';
import { getBrowserlessUnifiedService, getBrowserlessUnifiedServiceForDealership } from './browserless-unified';
import { autoTraderScraper } from './autotrader-scraper';
import { kijijiScraper } from './kijiji-scraper';
import { craigslistScraper } from './craigslist-scraper';
import { cargurusScraper } from './cargurus-scraper-service';
import { geocodingService } from './geocoding-service';
import { deduplicateListings } from './market-deduplication';
import type { InsertMarketListing, InsertPriceHistory, MarketListing } from '@shared/schema';

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
  browserlessCount: number;
  cargurusCount: number;
  apifyCount: number;
  scraperCount: number;
  kijijiCount: number;
  craigslistCount: number;
  duplicatesRemoved: number;
  mergedRecords: number;
  success: boolean;
  errors: string[];
  sources: string[];
}

/**
 * Market Data Aggregation Service
 * 
 * Orchestrates data collection from multiple sources in priority order:
 * 1. MarketCheck API (highest quality, most reliable)
 * 2. CarGurus scraper (rich data - specs, history badges, deal ratings)
 * 3. Apify AutoTrader.ca actor (managed scraping)
 * 4. Direct Puppeteer scrapers (fallback)
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
      browserlessCount: 0,
      cargurusCount: 0,
      apifyCount: 0,
      scraperCount: 0,
      kijijiCount: 0,
      craigslistCount: 0,
      duplicatesRemoved: 0,
      mergedRecords: 0,
      success: true,
      errors: [],
      sources: []
    };

    const allListings: InsertMarketListing[] = [];
    const dealershipId = params.dealershipId || 1;
    const geocodeLimit = Math.max(0, parseInt(process.env.GEOCODER_CA_LOOKUP_LIMIT || '25', 10));
    let geocodeLookups = 0;

    const isGenericLocation = (location: string): boolean => {
      const normalized = location.trim().toLowerCase();
      if (!normalized || normalized.length < 3) return true;
      if (normalized === 'canada' || normalized === 'unknown' || normalized === 'unknown location') return true;
      if (normalized === 'british columbia' || normalized === 'ontario' || normalized === 'alberta') return true;
      return false;
    };

    const buildGeocodeQuery = (location: string): string => {
      if (/canada|usa|united states/i.test(location)) {
        return location;
      }
      return `${location}, Canada`;
    };

    const hydrateListingLocation = async (listing: InsertMarketListing): Promise<void> => {
      if (listing.latitude || listing.longitude) return;
      if (!listing.location || isGenericLocation(listing.location)) return;
      if (geocodeLookups >= geocodeLimit) return;

      const query = buildGeocodeQuery(listing.location);
      geocodeLookups += 1;
      const geocoded = await geocodingService.geocodeLocation(query);
      if (geocoded) {
        listing.latitude = geocoded.latitude.toString();
        listing.longitude = geocoded.longitude.toString();
      }
    };

    console.log(`[MarketAggregation] Starting data collection for ${params.make} ${params.model}${params.dealershipId ? ` (dealership ${params.dealershipId})` : ''}`);

    // 1. Try MarketCheck API (highest priority - rank 1)
    const marketCheckService = params.dealershipId 
      ? await getMarketCheckServiceForDealership(params.dealershipId)
      : getMarketCheckService();
      
    if (marketCheckService) {
      try {
        console.log('[MarketAggregation] Fetching from MarketCheck API...');
        const marketCheckListings = await marketCheckService.searchAndConvert(params);
        
        for (const listing of marketCheckListings) {
          listing.dataSourceRank = 1;
          allListings.push(listing);
          result.marketCheckCount++;
        }
        
        console.log(`[MarketAggregation] MarketCheck: ${result.marketCheckCount} listings`);
        if (result.marketCheckCount > 0) result.sources.push('marketcheck');
      } catch (error) {
        console.error('[MarketAggregation] MarketCheck error:', error);
        result.errors.push(`MarketCheck: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      console.log('[MarketAggregation] MarketCheck API not configured (optional)');
    }

    // 2. Try Browserless unified scraper (priority rank 2 - CarGurus + AutoTrader)
    const browserlessService = params.dealershipId
      ? await getBrowserlessUnifiedServiceForDealership(params.dealershipId)
      : getBrowserlessUnifiedService();

    try {
      console.log('[MarketAggregation] Fetching from Browserless (CarGurus + AutoTrader)...');
      const browserlessResult = await browserlessService.scrapeMarketComparables({
        make: params.make,
        model: params.model,
        yearMin: params.yearMin,
        yearMax: params.yearMax,
        postalCode: params.postalCode || 'V6B2W2',
        radiusKm: params.radiusKm || 100,
        maxResults: params.maxResults || 50,
      });

      if (browserlessResult.success && browserlessResult.listings.length > 0) {
        for (const listing of browserlessResult.listings) {
          if (!listing.year || !listing.make || !listing.model) continue;
          
          const source = listing.cargurusUrl ? 'cargurus_browserless' : 'autotrader_browserless';
          const listingUrl = listing.cargurusUrl || listing.dealerVdpUrl || '';
          const externalId = listing.vin 
            ? `browserless_${listing.vin}`
            : `browserless_${source}_${listing.year}_${listing.make.toLowerCase().replace(/\s+/g, '_')}_${listing.model.toLowerCase().replace(/\s+/g, '_')}_${listing.price || 0}`;
          
          const marketListing: InsertMarketListing = {
            dealershipId,
            externalId,
            source,
            listingType: listing.sellerType || 'dealer',
            year: listing.year,
            make: listing.make,
            model: listing.model,
            trim: listing.trim || null,
            price: listing.price ?? 0,
            mileage: listing.odometer ?? null,
            location: listing.location || 'British Columbia',
            postalCode: null,
            latitude: null,
            longitude: null,
            sellerName: listing.dealership || 'Unknown Dealer',
            imageUrl: listing.images?.[0] ?? null,
            listingUrl: listingUrl,
            postedDate: null,
            isActive: true,
            dataSourceRank: 2,
            exteriorColor: listing.exteriorColor || null,
            interiorColor: listing.interiorColor || null,
          };
          allListings.push(marketListing);
          result.browserlessCount++;
        }
        console.log(`[MarketAggregation] Browserless: ${result.browserlessCount} listings`);
        if (result.browserlessCount > 0) result.sources.push('browserless');
      }
    } catch (error) {
      console.error('[MarketAggregation] Browserless error:', error);
      result.errors.push(`Browserless: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // 3. Try CarGurus scraper as fallback (priority rank 3 - rich data)
    if (result.browserlessCount === 0) {
      try {
        console.log('[MarketAggregation] Fetching from CarGurus fallback...');
        const cargurusListings = await cargurusScraper.searchAndConvert({
          ...params,
          dealershipId,
          maxResults: Math.floor((params.maxResults || 50) / 2)
        });

        for (const listing of cargurusListings) {
          allListings.push(listing);
          result.cargurusCount++;
        }

        console.log(`[MarketAggregation] CarGurus: ${result.cargurusCount} listings`);
        if (result.cargurusCount > 0) result.sources.push('cargurus');
      } catch (error) {
        console.error('[MarketAggregation] CarGurus error:', error);
        result.errors.push(`CarGurus: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // 4. Try Apify AutoTrader.ca actor (priority rank 4)
    const apifyService = params.dealershipId 
      ? await getApifyServiceForDealership(params.dealershipId)
      : getApifyService();
      
    if (apifyService) {
      try {
        console.log('[MarketAggregation] Fetching from Apify AutoTrader.ca...');
        const apifyListings = await apifyService.scrapeAndConvert(params);
        
        for (const listing of apifyListings) {
          listing.dataSourceRank = 3;
          allListings.push(listing);
          result.apifyCount++;
        }
        
        console.log(`[MarketAggregation] Apify: ${result.apifyCount} listings`);
        if (result.apifyCount > 0) result.sources.push('apify');
      } catch (error) {
        console.error('[MarketAggregation] Apify error:', error);
        result.errors.push(`Apify: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      console.log('[MarketAggregation] Apify service not configured (optional)');
    }

    // 4. Try direct Puppeteer scraper (fallback - rank 4)
    // Trigger fallback when: no listings at all, OR fewer than 20 premium listings
    const premiumListingsCount = result.marketCheckCount + result.cargurusCount + result.apifyCount;
    if (allListings.length === 0 || premiumListingsCount < 20) {
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
            isActive: true,
            dataSourceRank: 4
          };
          
          allListings.push(listing);
          result.scraperCount++;
        }
        
        console.log(`[MarketAggregation] Scraper: ${result.scraperCount} listings`);
        if (result.scraperCount > 0) result.sources.push('autotrader');
      } catch (error) {
        console.error('[MarketAggregation] Scraper error:', error);
        result.errors.push(`Scraper: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      console.log('[MarketAggregation] Skipping scraper (sufficient premium data)');
    }

    // 5. Try Kijiji Autos scraper (rank 5)
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
      
      for (const listing of kijijiListings) {
        listing.dealershipId = dealershipId;
        listing.dataSourceRank = 5;
        allListings.push(listing);
        result.kijijiCount++;
      }
      
      console.log(`[MarketAggregation] Kijiji: ${result.kijijiCount} listings`);
      if (result.kijijiCount > 0) result.sources.push('kijiji');
    } catch (error) {
      console.error('[MarketAggregation] Kijiji error:', error);
      result.errors.push(`Kijiji: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // 6. Try Craigslist scraper (rank 6)
    try {
      console.log('[MarketAggregation] Fetching from Craigslist...');
      const craigslistListings = await craigslistScraper.searchAndConvert({
        make: params.make,
        model: params.model,
        yearMin: params.yearMin,
        yearMax: params.yearMax,
        maxResults: Math.floor((params.maxResults || 50) / 3)
      });
      
      for (const listing of craigslistListings) {
        listing.dealershipId = dealershipId;
        listing.dataSourceRank = 6;
        allListings.push(listing);
        result.craigslistCount++;
      }
      
      console.log(`[MarketAggregation] Craigslist: ${result.craigslistCount} listings`);
      if (result.craigslistCount > 0) result.sources.push('craigslist');
    } catch (error) {
      console.error('[MarketAggregation] Craigslist error:', error);
      result.errors.push(`Craigslist: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Deduplicate all collected listings
    console.log(`[MarketAggregation] Deduplicating ${allListings.length} listings...`);
    const deduped = deduplicateListings(allListings);
    result.duplicatesRemoved = deduped.duplicatesRemoved;
    result.mergedRecords = deduped.mergedRecords;
    
    console.log(`[MarketAggregation] After dedup: ${deduped.uniqueListings.length} unique (${deduped.duplicatesRemoved} removed, ${deduped.mergedRecords} merged)`);

    // Backfill missing lat/lon for better distance filtering (best effort, limited lookups)
    if (geocodeLimit > 0) {
      for (const listing of deduped.uniqueListings) {
        if (geocodeLookups >= geocodeLimit) break;
        await hydrateListingLocation(listing);
      }
    }

    // Fetch existing listings to avoid re-inserting
    const listingUrls = deduped.uniqueListings.map(l => l.listingUrl);
    let existingByUrl = new Map<string, MarketListing>();
    try {
      const existingListings = await storage.getMarketListingsByUrls(dealershipId, listingUrls);
      existingByUrl = new Map(existingListings.map(l => [l.listingUrl, l]));
    } catch (error) {
      console.error('[MarketAggregation] Error fetching existing listings:', error);
    }
    
    // Save new listings and refresh existing ones (price changes, last seen, lifecycle)
    let savedCount = 0;
    const priceHistoryRecords: InsertPriceHistory[] = [];
    const now = new Date();

    const buildPriceHistoryRecord = (listing: InsertMarketListing): InsertPriceHistory => ({
      dealershipId,
      marketListingId: null,
      externalId: listing.externalId,
      source: listing.source,
      year: listing.year,
      make: listing.make,
      model: listing.model,
      trim: listing.trim || null,
      price: listing.price,
      mileage: listing.mileage || null,
      location: listing.location,
      sellerName: listing.sellerName || null
    });

    const applyIfChanged = <T>(current: T | null | undefined, next: T | null | undefined) => {
      if (next === undefined || next === null) return undefined;
      return current !== next ? next : undefined;
    };

    for (const listing of deduped.uniqueListings) {
      const existing = existingByUrl.get(listing.listingUrl);
      if (!existing) {
        try {
          await storage.createMarketListing(listing);
          if (listing.price > 0) {
            priceHistoryRecords.push(buildPriceHistoryRecord(listing));
          }
          savedCount++;
        } catch (error) {
          if (error instanceof Error && (error.message.includes('unique') || error.message.includes('duplicate key'))) {
            console.log(`[MarketAggregation] Listing already exists (race condition): ${listing.listingUrl}`);
          } else {
            console.error(`[MarketAggregation] Error saving listing:`, error);
          }
        }
        continue;
      }

      const updates: Partial<MarketListing> = {
        scrapedAt: now,
        isActive: true,
        removedAt: null
      };

      const nextPrice = applyIfChanged(existing.price, listing.price);
      if (typeof nextPrice === 'number' && nextPrice > 0) {
        updates.price = nextPrice;
        priceHistoryRecords.push(buildPriceHistoryRecord({ ...listing, price: nextPrice }));
      }

      const nextMileage = applyIfChanged(existing.mileage, listing.mileage ?? null);
      if (typeof nextMileage === 'number') updates.mileage = nextMileage;

      const nextTrim = applyIfChanged(existing.trim, listing.trim ?? null);
      if (typeof nextTrim === 'string') updates.trim = nextTrim;

      const nextVin = applyIfChanged(existing.vin, listing.vin ?? null);
      if (typeof nextVin === 'string') updates.vin = nextVin;

      const nextInterior = applyIfChanged(existing.interiorColor, listing.interiorColor ?? null);
      if (typeof nextInterior === 'string') updates.interiorColor = nextInterior;

      const nextExterior = applyIfChanged(existing.exteriorColor, listing.exteriorColor ?? null);
      if (typeof nextExterior === 'string') updates.exteriorColor = nextExterior;

      const nextLatitude = applyIfChanged(existing.latitude, listing.latitude ?? null);
      if (typeof nextLatitude === 'string') updates.latitude = nextLatitude;

      const nextLongitude = applyIfChanged(existing.longitude, listing.longitude ?? null);
      if (typeof nextLongitude === 'string') updates.longitude = nextLongitude;

      const nextDealer = applyIfChanged(existing.sellerName, listing.sellerName ?? null);
      if (typeof nextDealer === 'string') updates.sellerName = nextDealer;

      const nextLocation = applyIfChanged(existing.location, listing.location ?? null);
      if (typeof nextLocation === 'string') updates.location = nextLocation;

      const nextPostedDate = applyIfChanged(existing.postedDate, listing.postedDate ?? null);
      if (nextPostedDate instanceof Date || nextPostedDate === null) updates.postedDate = nextPostedDate as Date | null;

      const nextSourceConfidence = applyIfChanged(existing.sourceConfidence, listing.sourceConfidence ?? null);
      if (typeof nextSourceConfidence === 'number') updates.sourceConfidence = nextSourceConfidence;

      const nextSpecs = applyIfChanged(existing.specsJson, listing.specsJson ?? null);
      if (typeof nextSpecs === 'string') updates.specsJson = nextSpecs;

      const nextFeatures = applyIfChanged(existing.featuresJson, listing.featuresJson ?? null);
      if (typeof nextFeatures === 'string') updates.featuresJson = nextFeatures;

      const nextHistory = applyIfChanged(existing.historyBadges, listing.historyBadges ?? null);
      if (typeof nextHistory === 'string') updates.historyBadges = nextHistory;

      const nextRating = applyIfChanged(existing.dealerRating, listing.dealerRating ?? null);
      if (typeof nextRating === 'string') updates.dealerRating = nextRating;

      const nextDaysOnLot = applyIfChanged(existing.daysOnLot, listing.daysOnLot ?? null);
      if (typeof nextDaysOnLot === 'number') updates.daysOnLot = nextDaysOnLot;

      if (Object.keys(updates).length > 0) {
        try {
          await storage.updateMarketListing(existing.id, dealershipId, updates);
        } catch (error) {
          console.error(`[MarketAggregation] Error updating listing:`, error);
        }
      }
    }

    if (priceHistoryRecords.length > 0) {
      try {
        await storage.createPriceHistoryBatch(priceHistoryRecords);
      } catch (error) {
        console.error('[MarketAggregation] Error recording price history:', error);
      }
    }

    const staleDays = Math.max(7, parseInt(process.env.MARKET_LISTING_STALE_DAYS || '45', 10));
    try {
      const staleCount = await storage.deactivateStaleMarketListings(
        dealershipId,
        { make: params.make, model: params.model, yearMin: params.yearMin, yearMax: params.yearMax },
        staleDays
      );
      if (staleCount > 0) {
        console.log(`[MarketAggregation] Marked ${staleCount} stale listings inactive (${staleDays}d cutoff)`);
      }
    } catch (error) {
      console.error('[MarketAggregation] Error deactivating stale listings:', error);
    }

    result.totalListings = savedCount;
    result.success = result.totalListings > 0 || result.errors.length === 0;

    console.log(`[MarketAggregation] Complete: ${result.totalListings} new listings saved`);
    console.log(`[MarketAggregation] Breakdown: MarketCheck=${result.marketCheckCount}, CarGurus=${result.cargurusCount}, Apify=${result.apifyCount}, Scraper=${result.scraperCount}, Kijiji=${result.kijijiCount}, Craigslist=${result.craigslistCount}`);
    
    if (result.errors.length > 0) {
      console.log(`[MarketAggregation] Errors: ${result.errors.join(', ')}`);
    }

    return result;
  }
}

// Export singleton instance
export const marketAggregationService = new MarketAggregationService();
