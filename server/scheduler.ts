import cron from 'node-cron';
import { scrapeAllDealerships } from './scraper';
import { storage } from './storage';
import { facebookService } from './facebook-service';

let schedulerInitialized = false;

export function startInventoryScheduler() {
  if (schedulerInitialized) {
    console.log('Inventory scheduler already running');
    return;
  }

  // Run scraper every 24 hours at midnight
  cron.schedule('0 0 * * *', async () => {
    console.log('🕐 Running scheduled inventory sync...');
    try {
      const count = await scrapeAllDealerships();
      console.log(`✓ Scheduled sync complete: ${count} vehicles updated`);
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

// Manual trigger function for testing
export async function triggerManualSync() {
  console.log('🔄 Manual inventory sync triggered...');
  try {
    const count = await scrapeAllDealerships();
    console.log(`✓ Manual sync complete: ${count} vehicles updated`);
    return { success: true, count };
  } catch (error) {
    console.error('✗ Manual sync failed:', error);
    return { success: false, error: String(error) };
  }
}
