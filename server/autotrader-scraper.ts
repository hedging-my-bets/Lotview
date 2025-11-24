import puppeteer, { Browser, Page } from 'puppeteer';
import { storage } from './storage';
import type { InsertMarketListing } from '@shared/schema';

export interface AutoTraderSearchParams {
  make: string;
  model: string;
  yearMin?: number;
  yearMax?: number;
  postalCode?: string;
  radiusKm?: number;
  maxResults?: number;
}

export interface AutoTraderListing {
  externalId: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  price: number;
  mileage?: number;
  location: string;
  sellerName: string;
  listingType: 'dealer' | 'private';
  imageUrl?: string;
  listingUrl: string;
  postedDate?: Date;
}

export class AutoTraderScraper {
  private browser: Browser | null = null;

  async initialize() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ]
      });
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Build AutoTrader.ca search URL with parameters
   */
  private buildSearchUrl(params: AutoTraderSearchParams): string {
    const { make, model, yearMin, yearMax, postalCode, radiusKm } = params;
    
    // Base URL structure: https://www.autotrader.ca/cars/{make}/{model}/
    const baseUrl = `https://www.autotrader.ca/cars/${make.toLowerCase()}/${model.toLowerCase()}/`;
    
    // Build query parameters
    const queryParams = new URLSearchParams();
    queryParams.append('rcp', '100'); // Results per page
    queryParams.append('rcs', '0'); // Start index
    queryParams.append('srt', '35'); // Sort by date (newest first)
    queryParams.append('sts', 'New-Used'); // New and used
    
    if (postalCode) {
      queryParams.append('loc', postalCode.replace(/\s/g, ''));
    }
    
    if (radiusKm) {
      queryParams.append('prx', radiusKm.toString());
    }
    
    if (yearMin) {
      queryParams.append('yRng', `${yearMin},`);
    }
    
    if (yearMax) {
      if (yearMin) {
        queryParams.set('yRng', `${yearMin},${yearMax}`);
      } else {
        queryParams.append('yRng', `,${yearMax}`);
      }
    }
    
    return `${baseUrl}?${queryParams.toString()}`;
  }

  /**
   * Scrape AutoTrader.ca for vehicle listings
   */
  async scrapeListings(params: AutoTraderSearchParams): Promise<AutoTraderListing[]> {
    await this.initialize();
    
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const page: Page = await this.browser.newPage();
    const searchUrl = this.buildSearchUrl(params);
    const listings: AutoTraderListing[] = [];
    
    try {
      console.log(`[AutoTrader] Scraping: ${searchUrl}`);
      
      // Set user agent to avoid bot detection
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Navigate to search results
      await page.goto(searchUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      // Wait for listings to load
      await page.waitForSelector('.result-item, .no-results', { timeout: 10000 }).catch(() => {
        console.log('[AutoTrader] No results found or page structure changed');
      });
      
      // Extract listing data
      const scrapedData = await page.evaluate(() => {
        const results: any[] = [];
        const cards = document.querySelectorAll('.result-item');
        
        cards.forEach((card) => {
          try {
            // Extract data from each listing card
            const titleElement = card.querySelector('.title-with-make') || card.querySelector('.title');
            const title = titleElement?.textContent?.trim() || '';
            
            const priceElement = card.querySelector('.price-amount');
            const priceText = priceElement?.textContent?.trim().replace(/[^0-9]/g, '') || '0';
            const price = parseInt(priceText);
            
            const mileageElement = card.querySelector('.kms');
            const mileageText = mileageElement?.textContent?.trim().replace(/[^0-9]/g, '') || '';
            const mileage = mileageText ? parseInt(mileageText) : undefined;
            
            const locationElement = card.querySelector('.proximity, .location');
            const location = locationElement?.textContent?.trim() || '';
            
            const linkElement = card.querySelector('a');
            const link = linkElement?.getAttribute('href') || '';
            const fullUrl = link.startsWith('http') ? link : `https://www.autotrader.ca${link}`;
            
            // Extract listing ID from URL
            const idMatch = link.match(/\/(\d+)$/);
            const externalId = idMatch ? idMatch[1] : '';
            
            // Extract seller type and name
            const sellerBadge = card.querySelector('.dealer-badge, .private-badge');
            const listingType = sellerBadge?.textContent?.toLowerCase().includes('private') ? 'private' : 'dealer';
            
            const sellerElement = card.querySelector('.dealer-name, .seller-name');
            const sellerName = sellerElement?.textContent?.trim() || (listingType === 'private' ? 'Private Seller' : 'Dealer');
            
            // Extract image
            const imageElement = card.querySelector('img');
            const imageUrl = imageElement?.getAttribute('src') || imageElement?.getAttribute('data-src') || '';
            
            // Parse year from title
            const yearMatch = title.match(/(\d{4})/);
            const year = yearMatch ? parseInt(yearMatch[1]) : 0;
            
            if (externalId && price > 0 && year > 0) {
              results.push({
                externalId,
                title,
                year,
                price,
                mileage,
                location,
                sellerName,
                listingType,
                imageUrl,
                listingUrl: fullUrl
              });
            }
          } catch (err) {
            console.error('Error parsing listing card:', err);
          }
        });
        
        return results;
      });
      
      // Process and clean the scraped data
      for (const data of scrapedData) {
        const { title, year, price, mileage, location, sellerName, listingType, imageUrl, listingUrl, externalId } = data;
        
        // Parse make/model/trim from title
        const titleParts = title.split(' ');
        const parsedYear = year;
        const parsedMake = titleParts[1] || params.make;
        const parsedModel = titleParts[2] || params.model;
        const parsedTrim = titleParts.slice(3).join(' ') || undefined;
        
        listings.push({
          externalId,
          year: parsedYear,
          make: parsedMake,
          model: parsedModel,
          trim: parsedTrim,
          price,
          mileage,
          location,
          sellerName,
          listingType: listingType as 'dealer' | 'private',
          imageUrl,
          listingUrl,
          postedDate: new Date() // AutoTrader doesn't show exact post date, use current date as approximation
        });
      }
      
      console.log(`[AutoTrader] Found ${listings.length} listings`);
      
    } catch (error) {
      console.error('[AutoTrader] Scraping error:', error);
      throw error;
    } finally {
      await page.close();
    }
    
    // Limit results
    const maxResults = params.maxResults || 50;
    return listings.slice(0, maxResults);
  }

  /**
   * Save scraped listings to database
   */
  async saveListings(listings: AutoTraderListing[]): Promise<number> {
    let savedCount = 0;
    
    for (const listing of listings) {
      try {
        const marketListing: InsertMarketListing = {
          externalId: listing.externalId,
          source: 'autotrader',
          listingType: listing.listingType,
          year: listing.year,
          make: listing.make,
          model: listing.model,
          trim: listing.trim || null,
          price: listing.price,
          mileage: listing.mileage || null,
          location: listing.location,
          postalCode: null,
          latitude: null,
          longitude: null,
          sellerName: listing.sellerName,
          imageUrl: listing.imageUrl || null,
          listingUrl: listing.listingUrl,
          postedDate: listing.postedDate || null,
          isActive: true
        };
        
        // Check if listing already exists
        const existing = await storage.getMarketListings({
          make: listing.make,
          model: listing.model
        });
        
        const alreadyExists = existing.some(e => e.externalId === listing.externalId);
        
        if (!alreadyExists) {
          await storage.createMarketListing(marketListing);
          savedCount++;
        }
      } catch (error) {
        console.error(`[AutoTrader] Error saving listing ${listing.externalId}:`, error);
      }
    }
    
    console.log(`[AutoTrader] Saved ${savedCount} new listings to database`);
    return savedCount;
  }

  /**
   * Search and save listings in one operation
   */
  async searchAndSave(params: AutoTraderSearchParams): Promise<number> {
    const listings = await this.scrapeListings(params);
    const savedCount = await this.saveListings(listings);
    return savedCount;
  }
}

// Export singleton instance
export const autoTraderScraper = new AutoTraderScraper();
