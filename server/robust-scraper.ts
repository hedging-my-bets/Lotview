import { storage } from './storage';
import { scrapeAllDealershipsIncremental, upsertVehicleByVin, type ScrapedVehicle } from './scraper';
import { getGlobalApifyService, getApifyServiceForDealership } from './apify-service';
import { 
  getBrowserlessServiceForDealership, 
  getGlobalBrowserlessService,
  type BrowserlessScrapeResult 
} from './browserless-service';
import type { InsertScrapeRun, Vehicle } from '@shared/schema';
import { db } from './db';
import { vehicles, scrapeSources } from '@shared/schema';
import { eq, and, inArray, desc } from 'drizzle-orm';

const MAX_RETRIES = 3;
const RETRY_DELAYS = [5000, 15000, 30000]; // 5s, 15s, 30s exponential backoff

interface ScrapeResult {
  success: boolean;
  vehiclesFound: number;
  vehiclesInserted: number;
  vehiclesUpdated: number;
  vehiclesDeleted: number;
  method: 'puppeteer' | 'browserless' | 'apify' | 'cache_preserve';
  error?: string;
  retryCount: number;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function attemptPuppeteerScrape(): Promise<{ success: boolean; total: number; error?: string }> {
  try {
    const total = await scrapeAllDealershipsIncremental();
    return { success: true, total };
  } catch (error) {
    return { 
      success: false, 
      total: 0, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

/**
 * Browserless Cloud Fallback (Secondary - True Puppeteer Replacement)
 * 
 * This fallback uses Browserless.io cloud infrastructure to run the same
 * Puppeteer scraping logic but in their managed cloud environment.
 * This provides a TRUE backup for local Puppeteer failures.
 * 
 * DEGRADED MODE NOTE: The Browserless fallback extracts core vehicle data
 * (year, make, model, price, odometer, images) but may miss some enrichments
 * that the full local scraper provides (VIN from detail pages, full image galleries,
 * Carfax links, trim parsing from headings). This is acceptable as an emergency
 * fallback since it still imports valid inventory data.
 */
async function attemptBrowserlessScrape(dealershipId?: number): Promise<{
  success: boolean;
  vehiclesImported: number;
  error?: string;
}> {
  try {
    const browserlessService = dealershipId
      ? await getBrowserlessServiceForDealership(dealershipId)
      : getGlobalBrowserlessService();

    if (!browserlessService) {
      return { success: false, vehiclesImported: 0, error: 'Browserless service not configured' };
    }

    const connectionTest = await browserlessService.testConnection();
    if (!connectionTest.success) {
      return { success: false, vehiclesImported: 0, error: `Browserless connection failed: ${connectionTest.message}` };
    }

    console.log('[Robust Scraper] Browserless connected. Fetching scrape sources...');

    const sources = dealershipId
      ? await db.select().from(scrapeSources).where(
          and(eq(scrapeSources.dealershipId, dealershipId), eq(scrapeSources.isActive, true))
        )
      : await db.select().from(scrapeSources).where(eq(scrapeSources.isActive, true));

    if (sources.length === 0) {
      return { success: false, vehiclesImported: 0, error: 'No active scrape sources configured' };
    }

    let totalImported = 0;

    for (const source of sources) {
      console.log(`[Robust Scraper] Browserless scraping: ${source.sourceName} (${source.sourceUrl})`);
      
      try {
        const result = await browserlessService.scrapeInventoryUrl(source.sourceUrl);
        
        if (result.success && result.vehicles.length > 0) {
          console.log(`[Robust Scraper] Browserless found ${result.vehicles.length} vehicles from ${source.sourceName}`);
          
          for (const v of result.vehicles) {
            // Extract additional data from cardText if available
            const cardText = v.cardText || '';
            
            // Try to extract trim from the vehicle title/heading
            let trim = 'Base';
            const trimMatch = cardText.match(/(?:^|\s)([A-Z][A-Za-z0-9]+(?:\s+[A-Za-z0-9]+)?)\s*(?:\||$)/);
            if (trimMatch && !['Used', 'New', 'Certified'].includes(trimMatch[1])) {
              trim = trimMatch[1].trim();
            }
            
            // Determine body type from card text
            let bodyType = 'SUV';
            const bodyLower = cardText.toLowerCase();
            if (bodyLower.includes('sedan')) bodyType = 'Sedan';
            else if (bodyLower.includes('truck') || bodyLower.includes('pickup')) bodyType = 'Truck';
            else if (bodyLower.includes('hatchback')) bodyType = 'Hatchback';
            else if (bodyLower.includes('coupe')) bodyType = 'Coupe';
            else if (bodyLower.includes('wagon')) bodyType = 'Wagon';
            else if (bodyLower.includes('minivan') || bodyLower.includes('van')) bodyType = 'Minivan';
            
            // Extract badges from card text
            const badges: string[] = [];
            if (/one owner|1 owner|single owner/i.test(cardText)) badges.push('One Owner');
            if (/no accidents?|accident[\s-]?free|clean history/i.test(cardText)) badges.push('No Accidents');
            if (/certified|cpo/i.test(cardText)) badges.push('Certified Pre-Owned');
            if (/low km|low kilo/i.test(cardText)) badges.push('Low Kilometers');
            if (/new arrival|just arrived/i.test(cardText)) badges.push('New Arrival');
            
            // Try to extract VIN if present
            let vin: string | undefined;
            const vinMatch = cardText.match(/\b([A-HJ-NPR-Z0-9]{17})\b/);
            if (vinMatch) vin = vinMatch[1];
            
            // Generate description
            const description = `${v.year} ${v.make} ${v.model} ${trim}`.trim() + 
              (v.odometer ? ` with ${v.odometer.toLocaleString()} km` : '') +
              ` at ${source.sourceName}`;
            
            // Use all images if available, otherwise fall back to primary image
            const images: string[] = v.images && v.images.length > 0 
              ? v.images 
              : (v.primaryImage ? [v.primaryImage] : []);
            
            const vehicleData: ScrapedVehicle = {
              year: v.year,
              make: v.make,
              model: v.model,
              trim,
              type: bodyType,
              price: v.price,
              odometer: v.odometer,
              images,
              badges,
              location: source.sourceName,
              dealership: source.sourceName,
              dealershipId: source.dealershipId,
              description,
              dealerVdpUrl: v.detailUrl,
              vin,
              stockNumber: v.stockNumber || undefined,
            };
            
            const saved = await upsertVehicleByVin(vehicleData);
            if (saved) totalImported++;
          }
        } else if (!result.success) {
          console.warn(`[Robust Scraper] Browserless failed for ${source.sourceName}: ${result.error}`);
        }
      } catch (sourceError) {
        console.warn(`[Robust Scraper] Error scraping ${source.sourceName}:`, sourceError);
      }
    }

    if (totalImported > 0) {
      return { success: true, vehiclesImported: totalImported };
    }

    return { success: false, vehiclesImported: 0, error: 'Browserless scraped but found no vehicles' };
  } catch (error) {
    return {
      success: false,
      vehiclesImported: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Apify Market Data Refresh (Tertiary Fallback)
 * 
 * ARCHITECTURAL NOTE: The Apify AutoTrader.ca actor searches by make/model/year,
 * NOT by dealership website URL. This means Apify cannot directly substitute for
 * the Puppeteer scraper which scrapes specific dealer inventory pages.
 * 
 * Instead, this fallback:
 * 1. Uses existing inventory from the database
 * 2. Fetches market pricing data from AutoTrader.ca via Apify
 * 3. Updates lastScrapedAt to indicate the data was verified against market
 * 
 * This provides value by confirming existing inventory against market data,
 * but cannot discover NEW vehicles that Puppeteer would have found.
 */
async function attemptApifyMarketDataRefresh(dealershipId?: number): Promise<{ 
  success: boolean; 
  vehiclesUpdated: number; 
  error?: string 
}> {
  try {
    const apifyService = dealershipId 
      ? await getApifyServiceForDealership(dealershipId)
      : getGlobalApifyService();
    
    if (!apifyService) {
      return { success: false, vehiclesUpdated: 0, error: 'Apify service not configured' };
    }

    const connectionTest = await apifyService.testConnection();
    if (!connectionTest.success) {
      return { success: false, vehiclesUpdated: 0, error: `Apify connection failed: ${connectionTest.message}` };
    }

    console.log('[Robust Scraper] Apify connected. Attempting market data refresh for existing inventory...');
    console.log('[Robust Scraper] NOTE: Apify searches AutoTrader.ca by make/model, cannot discover new dealer inventory.');
    
    const existingVehicles = dealershipId 
      ? await db.select().from(vehicles).where(eq(vehicles.dealershipId, dealershipId)).limit(50)
      : await db.select().from(vehicles).limit(50);

    if (existingVehicles.length === 0) {
      return { success: false, vehiclesUpdated: 0, error: 'No existing inventory to refresh' };
    }

    let updatedCount = 0;
    const uniqueMakeModels = new Map<string, Vehicle[]>();
    
    for (const vehicle of existingVehicles) {
      const key = `${vehicle.make}|${vehicle.model}|${vehicle.year}`;
      if (!uniqueMakeModels.has(key)) {
        uniqueMakeModels.set(key, []);
      }
      uniqueMakeModels.get(key)!.push(vehicle);
    }

    for (const [key, vehicleGroup] of uniqueMakeModels) {
      const [make, model, yearStr] = key.split('|');
      const year = parseInt(yearStr);
      
      if (!make || !model || isNaN(year)) continue;

      try {
        const marketData = await apifyService.getMarketPricing({
          make,
          model,
          yearMin: year,
          yearMax: year,
          maxResults: 20
        });

        if (marketData.stats.count > 0) {
          for (const vehicle of vehicleGroup) {
            await db.update(vehicles)
              .set({ 
                lastScrapedAt: new Date(),
              })
              .where(eq(vehicles.id, vehicle.id));
            updatedCount++;
          }
          console.log(`[Robust Scraper] Refreshed ${vehicleGroup.length} ${year} ${make} ${model} vehicles with market data`);
        }
      } catch (err) {
        console.warn(`[Robust Scraper] Failed to get market data for ${year} ${make} ${model}:`, err);
      }
    }

    if (updatedCount > 0) {
      return { success: true, vehiclesUpdated: updatedCount, error: undefined };
    }
    
    return { success: false, vehiclesUpdated: 0, error: 'No vehicles could be refreshed from market data' };
  } catch (error) {
    return { 
      success: false, 
      vehiclesUpdated: 0, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

async function preserveExistingInventory(dealershipId?: number): Promise<{ 
  vehiclesPreserved: number; 
  error?: string 
}> {
  try {
    const existingVehicles = dealershipId 
      ? await db.select().from(vehicles).where(eq(vehicles.dealershipId, dealershipId))
      : await db.select().from(vehicles);

    console.log(`[Robust Scraper] Cache preserve mode: Keeping ${existingVehicles.length} existing vehicles (scrape failed, no deletions)`);
    
    return { vehiclesPreserved: existingVehicles.length };
  } catch (error) {
    return { 
      vehiclesPreserved: 0, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

export async function runRobustScrape(
  triggeredBy: 'scheduler' | 'manual' | 'webhook' = 'scheduler',
  dealershipId?: number
): Promise<ScrapeResult> {
  const startTime = Date.now();
  let retryCount = 0;
  let lastError = '';
  let method: 'puppeteer' | 'browserless' | 'apify' | 'cache_preserve' = 'puppeteer';

  const runData: InsertScrapeRun = {
    dealershipId: dealershipId || null,
    scrapeType: 'incremental',
    scrapeMethod: 'puppeteer',
    status: 'running',
    triggeredBy,
  };

  const run = await storage.createScrapeRun(runData);
  console.log(`[Robust Scraper] Started scrape run #${run.id} (triggered by: ${triggeredBy})`);

  // ===== TIER 1: Local Puppeteer with retries =====
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(`[Robust Scraper] Attempt ${attempt}/${MAX_RETRIES} using Puppeteer...`);
    
    const result = await attemptPuppeteerScrape();
    
    if (result.success) {
      const duration = Date.now() - startTime;
      await storage.updateScrapeRun(run.id, {
        status: 'success',
        scrapeMethod: 'puppeteer',
        vehiclesFound: result.total,
        durationMs: duration,
        retryCount,
        completedAt: new Date(),
      });
      
      console.log(`[Robust Scraper] ✓ Success on attempt ${attempt}: ${result.total} vehicles`);
      
      return {
        success: true,
        vehiclesFound: result.total,
        vehiclesInserted: 0,
        vehiclesUpdated: 0,
        vehiclesDeleted: 0,
        method: 'puppeteer',
        retryCount,
      };
    }

    lastError = result.error || 'Unknown error';
    retryCount++;
    console.error(`[Robust Scraper] Attempt ${attempt} failed: ${lastError}`);

    if (attempt < MAX_RETRIES) {
      const delay = RETRY_DELAYS[attempt - 1] || 30000;
      console.log(`[Robust Scraper] Retrying in ${delay / 1000}s...`);
      await sleep(delay);
    }
  }

  // ===== TIER 2: Browserless Cloud Puppeteer (TRUE FALLBACK) =====
  console.log('[Robust Scraper] All local Puppeteer attempts failed. Trying Browserless cloud fallback...');
  
  const browserlessResult = await attemptBrowserlessScrape(dealershipId);
  
  if (browserlessResult.success) {
    method = 'browserless';
    const duration = Date.now() - startTime;
    await storage.updateScrapeRun(run.id, {
      status: 'success',
      scrapeMethod: 'browserless',
      vehiclesFound: browserlessResult.vehiclesImported,
      vehiclesInserted: browserlessResult.vehiclesImported,
      durationMs: duration,
      retryCount,
      errorMessage: `Local Puppeteer failed: ${lastError}. Browserless cloud recovered ${browserlessResult.vehiclesImported} vehicles.`,
      completedAt: new Date(),
    });
    
    console.log(`[Robust Scraper] ✓ Browserless cloud recovery: ${browserlessResult.vehiclesImported} vehicles imported`);
    
    return {
      success: true,
      vehiclesFound: browserlessResult.vehiclesImported,
      vehiclesInserted: browserlessResult.vehiclesImported,
      vehiclesUpdated: 0,
      vehiclesDeleted: 0,
      method: 'browserless',
      retryCount,
    };
  }

  console.log(`[Robust Scraper] Browserless failed: ${browserlessResult.error}. Trying Apify market data refresh...`);

  // ===== TIER 3: Apify Market Data Refresh (Validation Only) =====
  const apifyResult = await attemptApifyMarketDataRefresh(dealershipId);
  
  if (apifyResult.success) {
    method = 'apify';
    const duration = Date.now() - startTime;
    await storage.updateScrapeRun(run.id, {
      status: 'partial',
      scrapeMethod: 'apify',
      vehiclesUpdated: apifyResult.vehiclesUpdated,
      durationMs: duration,
      retryCount,
      errorMessage: `Puppeteer failed: ${lastError}. Browserless failed: ${browserlessResult.error}. Apify market refresh touched ${apifyResult.vehiclesUpdated} vehicles (no new inventory discovered).`,
      completedAt: new Date(),
    });
    
    console.log(`[Robust Scraper] ⚠ Apify partial recovery: ${apifyResult.vehiclesUpdated} vehicles refreshed (market data only, no new inventory)`);
    
    return {
      success: false,
      vehiclesFound: 0,
      vehiclesInserted: 0,
      vehiclesUpdated: apifyResult.vehiclesUpdated,
      vehiclesDeleted: 0,
      method: 'apify',
      error: `Puppeteer and Browserless failed. Apify market refresh updated ${apifyResult.vehiclesUpdated} existing vehicles.`,
      retryCount,
    };
  }

  // ===== TIER 4: Cache Preserve (Prevent Data Loss) =====
  console.log('[Robust Scraper] All scraping methods failed. Preserving existing inventory (no deletions)...');
  method = 'cache_preserve';
  
  const preserveResult = await preserveExistingInventory(dealershipId);
  const duration = Date.now() - startTime;
  
  const finalStatus = preserveResult.vehiclesPreserved > 0 ? 'partial' : 'failed';
  const errorMsg = `All scrape methods failed. ${preserveResult.vehiclesPreserved > 0 
    ? `Preserved ${preserveResult.vehiclesPreserved} existing vehicles.` 
    : 'No inventory data available.'} Puppeteer: ${lastError}; Browserless: ${browserlessResult.error}; Apify: ${apifyResult.error}`;
  
  await storage.updateScrapeRun(run.id, {
    status: finalStatus,
    scrapeMethod: 'cache_preserve',
    vehiclesFound: preserveResult.vehiclesPreserved,
    errorMessage: errorMsg,
    durationMs: duration,
    retryCount,
    completedAt: new Date(),
  });

  if (preserveResult.vehiclesPreserved > 0) {
    console.log(`[Robust Scraper] ⚠ Cache preserve mode: ${preserveResult.vehiclesPreserved} vehicles retained (partial success)`);
  } else {
    console.error(`[Robust Scraper] ✗ Complete failure: No vehicles found or preserved`);
  }

  return {
    success: false,
    vehiclesFound: preserveResult.vehiclesPreserved,
    vehiclesInserted: 0,
    vehiclesUpdated: 0,
    vehiclesDeleted: 0,
    method: 'cache_preserve',
    error: errorMsg,
    retryCount,
  };
}

export async function getScrapeRunHistory(
  dealershipId?: number,
  limit: number = 20
): Promise<any[]> {
  return storage.getScrapeRuns(dealershipId, limit);
}

export async function getLatestScrapeStatus(dealershipId?: number): Promise<any | null> {
  const runs = await storage.getScrapeRuns(dealershipId, 1);
  return runs.length > 0 ? runs[0] : null;
}
