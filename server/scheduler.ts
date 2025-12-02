import cron from 'node-cron';
import { scrapeAllDealerships, scrapeAllDealershipsIncremental } from './scraper';
import { storage } from './storage';
import { facebookService } from './facebook-service';
import { facebookCatalogService } from './facebook-catalog-service';

let schedulerInitialized = false;
let marketAnalysisSchedulerInitialized = false;
let facebookCatalogSchedulerInitialized = false;

export function startInventoryScheduler() {
  if (schedulerInitialized) {
    console.log('Inventory scheduler already running');
    return;
  }

  // Run scraper every 24 hours at midnight - uses incremental save
  cron.schedule('0 0 * * *', async () => {
    console.log('🕐 Running scheduled inventory sync (INCREMENTAL MODE)...');
    try {
      const count = await scrapeAllDealershipsIncremental();
      console.log(`✓ Scheduled sync complete: ${count} vehicles saved`);
    } catch (error) {
      console.error('✗ Scheduled sync failed:', error);
    }
  });

  // Check and refresh Facebook tokens daily at 3 AM
  // Refreshes tokens that expire within the next 7 days
  cron.schedule('0 3 * * *', async () => {
    console.log('🔑 Checking for expiring Facebook tokens...');
    try {
      await refreshExpiringFacebookTokens();
      console.log('✓ Facebook token refresh check complete');
    } catch (error) {
      console.error('✗ Facebook token refresh failed:', error);
    }
  });

  schedulerInitialized = true;
  console.log('✓ Inventory scheduler started (runs daily at midnight)');
  console.log('✓ Facebook token refresh scheduler started (runs daily at 3 AM)');
}

/**
 * Refresh Facebook tokens that are expiring within 7 days.
 * This ensures users don't have to re-authenticate frequently.
 * Handles both user-scoped accounts and dealership-level accounts.
 */
async function refreshExpiringFacebookTokens(): Promise<void> {
  try {
    // Get all dealerships
    const dealerships = await storage.getAllDealerships();
    
    for (const dealership of dealerships) {
      try {
        // Get API keys for this dealership (for Facebook App credentials)
        const apiKeys = await storage.getDealershipApiKeys(dealership.id);
        if (!apiKeys?.facebookAppId || !apiKeys?.facebookAppSecret) {
          console.log(`Skipping dealership ${dealership.id}: No Facebook credentials configured`);
          continue;
        }
        
        const dealershipConfig = { 
          facebookAppId: apiKeys.facebookAppId, 
          facebookAppSecret: apiKeys.facebookAppSecret 
        };
        
        // Process all Facebook accounts for this dealership (both user-scoped and dealership-level)
        const allAccounts = await storage.getAllFacebookAccountsByDealership(dealership.id);
        
        if (allAccounts.length === 0) {
          console.log(`Skipping dealership ${dealership.id}: No Facebook accounts found`);
          continue;
        }
        
        console.log(`Processing ${allAccounts.length} Facebook account(s) for dealership ${dealership.id}`);
        
        for (const account of allAccounts) {
          // Skip accounts without valid tokens
          if (!account.accessToken || !account.tokenExpiresAt) {
            continue;
          }
          
          // Check if token needs refresh (expires within 7 days)
          if (facebookService.tokenNeedsRefresh(account.tokenExpiresAt, 7)) {
            // Create a typed account object for the refresh function
            const accountToRefresh = {
              id: account.id,
              userId: account.userId,
              accessToken: account.accessToken, // Known to be string at this point
              tokenExpiresAt: account.tokenExpiresAt // Known to be Date at this point
            };
            await refreshSingleAccount(accountToRefresh, dealershipConfig, dealership.id);
          }
        }
      } catch (error) {
        console.error(`Error processing dealership ${dealership.id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in refreshExpiringFacebookTokens:', error);
    throw error;
  }
}

/**
 * Helper to refresh a single Facebook account token.
 */
async function refreshSingleAccount(
  account: { id: number; userId: number | null; accessToken: string; tokenExpiresAt: Date },
  dealershipConfig: { facebookAppId: string; facebookAppSecret: string },
  dealershipId: number
): Promise<void> {
  try {
    console.log(`Checking token for account ${account.id} (expires: ${account.tokenExpiresAt}, userId: ${account.userId || 'dealership-level'})`);
    
    // First validate the token is still valid before attempting refresh
    const validation = await facebookService.validateToken(account.accessToken, dealershipConfig);
    
    if (!validation || !validation.isValid) {
      // Token is revoked/invalid - mark account as needing re-authentication
      console.warn(`Token for account ${account.id} is invalid/revoked - marking as inactive`);
      await storage.updateFacebookAccountDirect(account.id, { isActive: false });
      return;
    }
    
    console.log(`Refreshing token for account ${account.id}`);
    const newToken = await facebookService.refreshLongLivedToken(account.accessToken, dealershipConfig);
    
    const newExpiresAt = new Date(Date.now() + newToken.expiresIn * 1000);
    
    await storage.updateFacebookAccountDirect(account.id, {
      accessToken: newToken.accessToken,
      tokenExpiresAt: newExpiresAt
    });
    
    console.log(`✓ Refreshed token for account ${account.id} (new expiry: ${newExpiresAt})`);
  } catch (error) {
    console.error(`Failed to refresh token for account ${account.id}:`, error);
  }
}

// Manual trigger function for testing - uses INCREMENTAL save to prevent data loss
export async function triggerManualSync() {
  console.log('🔄 Manual inventory sync triggered (INCREMENTAL MODE)...');
  try {
    // Use incremental scraper - saves each vehicle immediately to prevent data loss
    const count = await scrapeAllDealershipsIncremental();
    console.log(`✓ Manual sync complete: ${count} vehicles saved`);
    return { success: true, count };
  } catch (error) {
    console.error('✗ Manual sync failed:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Start the market analysis scheduler
 * Runs daily at 3 AM to refresh market data for all dealerships
 */
export function startMarketAnalysisScheduler() {
  if (marketAnalysisSchedulerInitialized) {
    console.log('Market analysis scheduler already running');
    return;
  }

  // Run market analysis at 3 AM daily (Pacific Time - adjusted for server timezone)
  cron.schedule('0 3 * * *', async () => {
    console.log('📊 Running scheduled market analysis...');
    try {
      await refreshAllDealershipMarketData();
      console.log('✓ Scheduled market analysis complete');
    } catch (error) {
      console.error('✗ Scheduled market analysis failed:', error);
    }
  });

  marketAnalysisSchedulerInitialized = true;
  console.log('✓ Market analysis scheduler started (runs daily at 3 AM)');
}

/**
 * Start the Facebook Catalog auto-sync scheduler.
 * This syncs dealership inventory to Facebook Catalogs for automotive ads.
 */
export function startFacebookCatalogScheduler() {
  if (facebookCatalogSchedulerInitialized) {
    console.log('Facebook Catalog scheduler already running');
    return;
  }

  // Sync Facebook Catalogs daily at 4 AM (after inventory sync at midnight)
  cron.schedule('0 4 * * *', async () => {
    console.log('📘 Running scheduled Facebook Catalog sync...');
    try {
      await syncAllFacebookCatalogs();
      console.log('✓ Facebook Catalog sync complete');
    } catch (error) {
      console.error('✗ Facebook Catalog sync failed:', error);
    }
  });

  facebookCatalogSchedulerInitialized = true;
  console.log('✓ Facebook Catalog scheduler started (runs daily at 4 AM)');
}

/**
 * Sync inventory to all Facebook Catalogs with auto-sync enabled.
 */
async function syncAllFacebookCatalogs(): Promise<void> {
  try {
    // Get all active catalog configs with auto-sync enabled
    const configs = await storage.getAllFacebookCatalogConfigs();
    const autoSyncConfigs = configs.filter(c => c.isActive && c.autoSyncEnabled);

    console.log(`[FB Catalog] Found ${autoSyncConfigs.length} catalogs to sync`);

    for (const config of autoSyncConfigs) {
      try {
        console.log(`[FB Catalog] Syncing dealership ${config.dealershipId}...`);
        
        // Get dealership's vehicles
        const { vehicles } = await storage.getVehicles(config.dealershipId, 500, 0);
        
        if (vehicles.length === 0) {
          console.log(`[FB Catalog] No vehicles for dealership ${config.dealershipId}, skipping`);
          await storage.updateCatalogSyncStatus(config.dealershipId, {
            lastSyncAt: new Date(),
            lastSyncStatus: 'success',
            lastSyncMessage: 'No vehicles to sync',
            vehiclesSynced: 0
          });
          continue;
        }

        // Get dealership for URL
        const dealership = await storage.getDealershipById(config.dealershipId);
        const baseUrl = dealership?.subdomain 
          ? `https://${dealership.subdomain}.example.com` 
          : 'https://olympicautogroup.ca';

        // Sync to Facebook Catalog
        const catalogConfig = { catalogId: config.catalogId, accessToken: config.accessToken };
        const result = await facebookCatalogService.syncVehiclesToCatalog(
          catalogConfig,
          vehicles, 
          baseUrl
        );

        // Build status message
        const statusMessage = result.success 
          ? `Created: ${result.created}, Updated: ${result.updated}, Deleted: ${result.deleted}`
          : result.errors.join('; ');

        // Update sync status
        await storage.updateCatalogSyncStatus(config.dealershipId, {
          lastSyncAt: new Date(),
          lastSyncStatus: result.success ? 'success' : 'failed',
          lastSyncMessage: statusMessage,
          vehiclesSynced: result.created + result.updated
        });

        console.log(`[FB Catalog] Dealership ${config.dealershipId}: ${result.success ? 'Success' : 'Failed'} - ${statusMessage}`);
        
      } catch (error) {
        console.error(`[FB Catalog] Error syncing dealership ${config.dealershipId}:`, error);
        
        await storage.updateCatalogSyncStatus(config.dealershipId, {
          lastSyncAt: new Date(),
          lastSyncStatus: 'failed',
          lastSyncMessage: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  } catch (error) {
    console.error('[FB Catalog] Error in syncAllFacebookCatalogs:', error);
    throw error;
  }
}

/**
 * Refresh market data for all active dealerships
 */
async function refreshAllDealershipMarketData(): Promise<void> {
  try {
    const dealerships = await storage.getAllDealerships();
    
    for (const dealership of dealerships) {
      if (!dealership.isActive) continue;
      
      console.log(`[MarketAnalysis] Processing dealership ${dealership.id}: ${dealership.name}`);
      
      try {
        // Get dealership's vehicles
        const { vehicles } = await storage.getVehicles(dealership.id, 500, 0);
        
        if (vehicles.length === 0) {
          console.log(`[MarketAnalysis] No vehicles for dealership ${dealership.id}, skipping`);
          continue;
        }
        
        // Get manager settings for postal code
        const settings = await storage.getManagerSettingsByDealership(dealership.id);
        const postalCode = settings?.postalCode || 'V6H 1G9';
        
        // Get unique make/model combinations
        const uniqueVehicles = new Map<string, { make: string; model: string; yearMin: number; yearMax: number }>();
        
        vehicles.forEach(v => {
          if (v.make && v.model) {
            const key = `${v.make}-${v.model}`;
            const existing = uniqueVehicles.get(key);
            if (existing) {
              existing.yearMin = Math.min(existing.yearMin, v.year || existing.yearMin);
              existing.yearMax = Math.max(existing.yearMax, v.year || existing.yearMax);
            } else {
              uniqueVehicles.set(key, {
                make: v.make,
                model: v.model,
                yearMin: v.year || new Date().getFullYear() - 3,
                yearMax: v.year || new Date().getFullYear()
              });
            }
          }
        });
        
        // Import market aggregation service
        const { marketAggregationService } = await import('./market-aggregation-service');
        
        // Aggregate market data for each unique vehicle
        let totalNewListings = 0;
        const vehicleEntries = Array.from(uniqueVehicles.entries());
        
        for (const [key, vehicleInfo] of vehicleEntries) {
          try {
            const result = await marketAggregationService.aggregateMarketData({
              make: vehicleInfo.make,
              model: vehicleInfo.model,
              yearMin: vehicleInfo.yearMin,
              yearMax: vehicleInfo.yearMax,
              postalCode,
              radiusKm: 250, // Default to 250km for scheduled refresh
              maxResults: 100,
              dealershipId: dealership.id
            });
            totalNewListings += result.totalListings;
          } catch (e) {
            console.error(`[MarketAnalysis] Error for ${key}:`, e);
          }
        }
        
        console.log(`[MarketAnalysis] Dealership ${dealership.id}: ${uniqueVehicles.size} vehicles analyzed, ${totalNewListings} new listings`);
        
      } catch (error) {
        console.error(`[MarketAnalysis] Error processing dealership ${dealership.id}:`, error);
      }
    }
  } catch (error) {
    console.error('[MarketAnalysis] Error in refreshAllDealershipMarketData:', error);
    throw error;
  }
}
