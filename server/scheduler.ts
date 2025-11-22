import cron from 'node-cron';
import { scrapeAllDealerships } from './scraper';

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

  schedulerInitialized = true;
  console.log('✓ Inventory scheduler started (runs daily at midnight)');
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
