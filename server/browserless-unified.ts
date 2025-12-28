import puppeteer, { Browser, Page } from 'puppeteer';
import { execSync } from 'child_process';
import { storage } from './storage';

export interface BrowserlessConfig {
  apiKey: string;
  endpoint?: string;
}

export interface VehicleListing {
  year: number;
  make: string;
  model: string;
  trim?: string;
  type?: string;
  price: number | null;
  odometer: number | null;
  images: string[];
  badges: string[];
  location: string;
  dealership: string;
  dealershipId: number;
  description?: string;
  vin?: string;
  stockNumber?: string;
  carfaxUrl?: string;
  dealRating?: string;
  cargurusPrice?: number;
  cargurusUrl?: string;
  dealerVdpUrl?: string;
  exteriorColor?: string;
  interiorColor?: string;
  engine?: string;
  transmission?: string;
  drivetrain?: string;
  fuelType?: string;
  features?: string[];
  sellerType?: 'dealer' | 'private';
}

export interface ScrapeResult {
  success: boolean;
  vehicles: VehicleListing[];
  error?: string;
  method: 'browserless' | 'local_puppeteer';
  duration?: number;
}

export interface MarketAnalysisResult {
  success: boolean;
  listings: VehicleListing[];
  source: 'cargurus' | 'autotrader' | 'combined';
  error?: string;
}

const DEFAULT_ENDPOINT = 'wss://chrome.browserless.io';
const MAX_RETRIES = 3;
const RETRY_DELAYS = [3000, 8000, 15000];

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class BrowserlessUnifiedService {
  private apiKey: string;
  private endpoint: string;
  private useBrowserless: boolean;
  private localBrowser: Browser | null = null;

  constructor(config?: BrowserlessConfig) {
    this.apiKey = config?.apiKey || process.env.BROWSERLESS_API_KEY || '';
    this.endpoint = config?.endpoint || DEFAULT_ENDPOINT;
    this.useBrowserless = !!this.apiKey;
    
    if (this.useBrowserless) {
      console.log('[BrowserlessUnified] Using Browserless.io cloud scraping (primary)');
    } else {
      console.log('[BrowserlessUnified] No API key configured - using local Puppeteer only');
    }
  }

  private getConnectionUrl(): string {
    return `${this.endpoint}?token=${this.apiKey}`;
  }

  private async getLocalChromiumPath(): Promise<string> {
    try {
      return execSync('which chromium 2>/dev/null || which chromium-browser 2>/dev/null', { encoding: 'utf8' }).trim();
    } catch {
      try {
        return execSync('find /nix/store -name chromium -type f -path "*/bin/chromium" 2>/dev/null | head -1', { encoding: 'utf8' }).trim();
      } catch {
        throw new Error('Chromium not found');
      }
    }
  }

  private async connectBrowser(): Promise<{ browser: Browser; isCloud: boolean }> {
    if (this.useBrowserless) {
      try {
        console.log('[BrowserlessUnified] Connecting to Browserless.io...');
        const browser = await puppeteer.connect({
          browserWSEndpoint: this.getConnectionUrl(),
        });
        return { browser, isCloud: true };
      } catch (error) {
        console.warn('[BrowserlessUnified] Browserless connection failed, falling back to local:', error);
      }
    }

    if (!this.localBrowser) {
      const executablePath = await this.getLocalChromiumPath();
      console.log(`[BrowserlessUnified] Using local Chromium: ${executablePath}`);
      this.localBrowser = await puppeteer.launch({
        headless: true,
        executablePath,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      });
    }
    return { browser: this.localBrowser, isCloud: false };
  }

  async testConnection(): Promise<{ success: boolean; message: string; method: string }> {
    try {
      const { browser, isCloud } = await this.connectBrowser();
      const page = await browser.newPage();
      await page.goto('https://example.com', { waitUntil: 'domcontentloaded', timeout: 15000 });
      const title = await page.title();
      await page.close();
      if (isCloud) await browser.disconnect();
      
      return {
        success: true,
        message: `Connected successfully. Test page title: ${title}`,
        method: isCloud ? 'browserless' : 'local_puppeteer',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
        method: 'failed',
      };
    }
  }

  async close(): Promise<void> {
    if (this.localBrowser) {
      await this.localBrowser.close();
      this.localBrowser = null;
    }
  }

  private async configurePage(page: Page): Promise<void> {
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    });
  }

  async scrapeDealerInventory(
    inventoryUrl: string,
    options: {
      dealershipId: number;
      dealershipName: string;
      location?: string;
      scrapeVdp?: boolean;
      maxVehicles?: number;
      timeout?: number;
    }
  ): Promise<ScrapeResult> {
    const startTime = Date.now();
    const { dealershipId, dealershipName, location = 'BC', scrapeVdp = true, maxVehicles = 200, timeout = 120000 } = options;
    
    let browser: Browser | null = null;
    let isCloud = false;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`[BrowserlessUnified] Retry attempt ${attempt + 1}/${MAX_RETRIES} after ${RETRY_DELAYS[attempt - 1]}ms`);
          await sleep(RETRY_DELAYS[attempt - 1]);
        }

        const connection = await this.connectBrowser();
        browser = connection.browser;
        isCloud = connection.isCloud;

        const page = await browser.newPage();
        await this.configurePage(page);

        console.log(`[BrowserlessUnified] Navigating to ${inventoryUrl}...`);
        await page.goto(inventoryUrl, { waitUntil: 'networkidle2', timeout });

        await page.waitForSelector('a[href*="/vehicles/"], .vehicle-card, .listing-item', { timeout: 30000 }).catch(() => {
          console.log('[BrowserlessUnified] Standard selectors not found, trying to extract anyway...');
        });

        await this.scrollToLoadAll(page, maxVehicles);

        const vehicleUrls = await this.extractVehicleUrls(page);
        console.log(`[BrowserlessUnified] Found ${vehicleUrls.length} vehicle URLs`);

        const vehicles: VehicleListing[] = [];

        if (scrapeVdp && vehicleUrls.length > 0) {
          for (const url of vehicleUrls.slice(0, maxVehicles)) {
            try {
              const vehicle = await this.scrapeVdpPage(page, url, { dealershipId, dealershipName, location });
              if (vehicle) vehicles.push(vehicle);
              await sleep(500 + Math.random() * 500);
            } catch (vdpError) {
              console.warn(`[BrowserlessUnified] VDP scrape failed for ${url}:`, vdpError);
            }
          }
        } else {
          const listingVehicles = await this.extractFromListingPage(page, { dealershipId, dealershipName, location });
          vehicles.push(...listingVehicles);
        }

        await page.close();
        if (isCloud) await browser.disconnect();

        return {
          success: true,
          vehicles,
          method: isCloud ? 'browserless' : 'local_puppeteer',
          duration: Date.now() - startTime,
        };

      } catch (error) {
        console.error(`[BrowserlessUnified] Attempt ${attempt + 1} failed:`, error);
        if (browser && isCloud) {
          try { await browser.disconnect(); } catch {}
        }
        
        if (attempt === MAX_RETRIES - 1) {
          return {
            success: false,
            vehicles: [],
            error: error instanceof Error ? error.message : String(error),
            method: isCloud ? 'browserless' : 'local_puppeteer',
            duration: Date.now() - startTime,
          };
        }
      }
    }

    return { success: false, vehicles: [], error: 'Max retries exceeded', method: 'browserless' };
  }

  private async scrollToLoadAll(page: Page, maxVehicles: number): Promise<void> {
    console.log('[BrowserlessUnified] Scrolling to load lazy content...');
    let previousCount = 0;
    let currentCount = 0;
    let scrollAttempts = 0;
    const maxScrollAttempts = 20;

    do {
      previousCount = currentCount;
      currentCount = await page.evaluate(() => {
        return document.querySelectorAll('a[href*="/vehicles/"], .vehicle-card, .listing-item').length;
      });

      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await sleep(1500);
      scrollAttempts++;

      if (currentCount >= maxVehicles) break;
    } while (currentCount > previousCount && scrollAttempts < maxScrollAttempts);

    console.log(`[BrowserlessUnified] Found ${currentCount} items after ${scrollAttempts} scrolls`);
  }

  private async extractVehicleUrls(page: Page): Promise<string[]> {
    return page.evaluate(() => {
      const urls: string[] = [];
      const links = document.querySelectorAll('a[href*="/vehicles/"]');
      const seen = new Set<string>();

      links.forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.match(/\/vehicles\/\d{4}\/[a-z-]+\/[a-z0-9-]+\//i)) {
          const fullUrl = href.startsWith('http') ? href : `${window.location.origin}${href}`;
          if (!seen.has(fullUrl)) {
            seen.add(fullUrl);
            urls.push(fullUrl);
          }
        }
      });

      return urls;
    });
  }

  private async extractFromListingPage(
    page: Page,
    context: { dealershipId: number; dealershipName: string; location: string }
  ): Promise<VehicleListing[]> {
    const { dealershipId, dealershipName, location } = context;

    return page.evaluate((ctx) => {
      const vehicles: any[] = [];
      const links = Array.from(document.querySelectorAll('a[href*="/vehicles/"]'));
      const processedUrls = new Set<string>();

      links.forEach(link => {
        const href = link.getAttribute('href');
        if (!href || processedUrls.has(href)) return;

        const match = href.match(/\/vehicles\/(\d{4})\/([a-z-]+)\/([a-z0-9-]+)\//i);
        if (!match) return;

        processedUrls.add(href);
        const [, yearStr, makeSlug, modelSlug] = match;
        const card = link.closest('.vehicle-card, .vehicle-item, .product-item, article, .item, .listing') || link;
        const cardText = card.textContent || '';

        const year = parseInt(yearStr);
        const make = makeSlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        const model = modelSlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

        let price: number | null = null;
        const priceElem = card.querySelector('.price, .dealer-price, [class*="price"]');
        if (priceElem) {
          const priceMatch = priceElem.textContent?.match(/\$([0-9,]+)/);
          if (priceMatch) price = parseInt(priceMatch[1].replace(/,/g, ''));
        }

        let odometer: number | null = null;
        const odometerMatch = cardText.match(/(\d+[,\d]*)\s*km/i);
        if (odometerMatch) odometer = parseInt(odometerMatch[1].replace(/,/g, ''));

        const imgElements = card.querySelectorAll('img');
        const images: string[] = [];
        imgElements.forEach((img: Element) => {
          const src = (img as HTMLImageElement).src || img.getAttribute('data-src');
          if (src && src.startsWith('http') && !src.includes('placeholder') && !src.includes('no-image')) {
            images.push(src);
          }
        });

        let stockNumber: string | undefined;
        const stockMatch = cardText.match(/stock[#:\s]*([A-Z0-9-]+)/i);
        if (stockMatch) stockNumber = stockMatch[1];

        let vin: string | undefined;
        const vinMatch = cardText.match(/\b([A-HJ-NPR-Z0-9]{17})\b/);
        if (vinMatch) vin = vinMatch[1];

        const detailUrl = href.startsWith('http') ? href : `${window.location.origin}${href}`;

        vehicles.push({
          year,
          make,
          model,
          price,
          odometer,
          images,
          badges: [],
          location: ctx.location,
          dealership: ctx.dealershipName,
          dealershipId: ctx.dealershipId,
          dealerVdpUrl: detailUrl,
          stockNumber,
          vin,
        });
      });

      return vehicles;
    }, context);
  }

  private async scrapeVdpPage(
    page: Page,
    vdpUrl: string,
    context: { dealershipId: number; dealershipName: string; location: string }
  ): Promise<VehicleListing | null> {
    const { dealershipId, dealershipName, location } = context;

    try {
      await page.goto(vdpUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await sleep(1000);

      const vehicle = await page.evaluate((ctx) => {
        const getText = (selector: string): string => {
          const el = document.querySelector(selector);
          return el?.textContent?.trim() || '';
        };

        const pageText = document.body.innerText || '';
        const pageTitle = document.querySelector('h1, .vehicle-title, .listing-title')?.textContent?.trim() || '';

        const urlMatch = window.location.pathname.match(/\/vehicles\/(\d{4})\/([a-z-]+)\/([a-z0-9-]+)\//i);
        if (!urlMatch) return null;

        const [, yearStr, makeSlug, modelSlug] = urlMatch;
        const year = parseInt(yearStr);
        const make = makeSlug.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        const model = modelSlug.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

        let trim = '';
        const trimPatterns = [
          /(?:trim|edition|package)[:\s]+([A-Za-z0-9\s]+)/i,
          new RegExp(`${model}\\s+([A-Z][A-Za-z0-9\\s]+?)(?:\\s|,|$)`),
        ];
        for (const pattern of trimPatterns) {
          const match = pageTitle.match(pattern) || pageText.match(pattern);
          if (match) {
            trim = match[1].trim();
            break;
          }
        }

        let price: number | null = null;
        const pricePatterns = [
          /\$\s*([\d,]+)/,
          /price[:\s]+\$?\s*([\d,]+)/i,
          /dealer\s*price[:\s]+\$?\s*([\d,]+)/i,
        ];
        for (const pattern of pricePatterns) {
          const match = pageText.match(pattern);
          if (match) {
            const p = parseInt(match[1].replace(/,/g, ''));
            if (p > 1000 && p < 500000) {
              price = p;
              break;
            }
          }
        }

        let odometer: number | null = null;
        const odometerMatch = pageText.match(/(\d{1,3}(?:,\d{3})*)\s*km/i);
        if (odometerMatch) {
          odometer = parseInt(odometerMatch[1].replace(/,/g, ''));
        }

        const images: string[] = [];
        const imgSelectors = [
          '.gallery img', '.carousel img', '.slider img', '.vehicle-images img',
          '.photo-gallery img', '[class*="image"] img', '.main-image img',
        ];
        for (const selector of imgSelectors) {
          document.querySelectorAll(selector).forEach((img: Element) => {
            const src = (img as HTMLImageElement).src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
            if (src && src.startsWith('http') && !src.includes('placeholder') && !src.includes('thumbnail')) {
              const highRes = src.replace(/\d{2,3}x\d{2,3}/, '1200x800').replace('thumbnail', 'full');
              if (!images.includes(highRes)) images.push(highRes);
            }
          });
        }
        if (images.length === 0) {
          document.querySelectorAll('img').forEach((img: Element) => {
            const src = (img as HTMLImageElement).src;
            if (src && src.includes('vehicle') && src.startsWith('http') && !src.includes('logo')) {
              images.push(src);
            }
          });
        }

        let vin: string | undefined;
        const vinMatch = pageText.match(/\b([A-HJ-NPR-Z0-9]{17})\b/);
        if (vinMatch) vin = vinMatch[1];

        let stockNumber: string | undefined;
        const stockMatch = pageText.match(/stock[#:\s]*([A-Z0-9-]+)/i);
        if (stockMatch) stockNumber = stockMatch[1];

        let carfaxUrl: string | undefined;
        const carfaxLink = document.querySelector('a[href*="carfax"], a[href*="CARFAX"]') as HTMLAnchorElement;
        if (carfaxLink) carfaxUrl = carfaxLink.href;

        const badges: string[] = [];
        const badgeText = pageText.toLowerCase();
        if (/one owner|1 owner|single owner/.test(badgeText)) badges.push('One Owner');
        if (/no accidents?|accident[\s-]?free|clean history/.test(badgeText)) badges.push('No Accidents');
        if (/certified|cpo|certified pre-owned/.test(badgeText)) badges.push('Certified Pre-Owned');

        let exteriorColor: string | undefined;
        const extMatch = pageText.match(/exterior(?:\s*color)?[:\s]+([A-Za-z\s]+?)(?:\n|,|$)/i);
        if (extMatch) exteriorColor = extMatch[1].trim();

        let interiorColor: string | undefined;
        const intMatch = pageText.match(/interior(?:\s*color)?[:\s]+([A-Za-z\s]+?)(?:\n|,|$)/i);
        if (intMatch) interiorColor = intMatch[1].trim();

        let engine: string | undefined;
        const engMatch = pageText.match(/engine[:\s]+([A-Za-z0-9\s.]+?)(?:\n|,|$)/i);
        if (engMatch) engine = engMatch[1].trim();

        let transmission: string | undefined;
        if (/automatic|auto trans/i.test(pageText)) transmission = 'Automatic';
        else if (/manual|stick shift/i.test(pageText)) transmission = 'Manual';
        else if (/cvt/i.test(pageText)) transmission = 'CVT';

        let drivetrain: string | undefined;
        if (/\bAWD\b|all[\s-]?wheel/i.test(pageText)) drivetrain = 'AWD';
        else if (/\b4WD\b|four[\s-]?wheel|4x4/i.test(pageText)) drivetrain = '4WD';
        else if (/\bFWD\b|front[\s-]?wheel/i.test(pageText)) drivetrain = 'FWD';
        else if (/\bRWD\b|rear[\s-]?wheel/i.test(pageText)) drivetrain = 'RWD';

        let fuelType: string | undefined;
        if (/electric|ev\b|battery/i.test(pageText)) fuelType = 'Electric';
        else if (/hybrid|phev/i.test(pageText)) fuelType = 'Hybrid';
        else if (/diesel/i.test(pageText)) fuelType = 'Diesel';
        else if (/gasoline|gas|petrol/i.test(pageText)) fuelType = 'Gasoline';

        let type = 'SUV';
        if (/sedan/i.test(pageText)) type = 'Sedan';
        else if (/truck|pickup|crew cab/i.test(pageText)) type = 'Truck';
        else if (/hatchback/i.test(pageText)) type = 'Hatchback';
        else if (/coupe/i.test(pageText)) type = 'Coupe';
        else if (/wagon/i.test(pageText)) type = 'Wagon';
        else if (/minivan|van/i.test(pageText)) type = 'Minivan';

        const features: string[] = [];
        const featurePatterns = [
          /heated seats/i, /sunroof|moonroof/i, /leather/i, /navigation|nav\b/i,
          /backup camera|rear camera/i, /bluetooth/i, /apple carplay|carplay/i,
          /android auto/i, /remote start/i, /lane assist/i, /blind spot/i,
        ];
        for (const pattern of featurePatterns) {
          if (pattern.test(pageText)) {
            const featureName = pattern.source.replace(/\\b|\\s/g, ' ').replace(/\|/g, '/').replace(/[\/\\]/g, '').trim();
            features.push(featureName);
          }
        }

        return {
          year,
          make,
          model,
          trim: trim || undefined,
          type,
          price,
          odometer,
          images: images.slice(0, 20),
          badges,
          location: ctx.location,
          dealership: ctx.dealershipName,
          dealershipId: ctx.dealershipId,
          dealerVdpUrl: window.location.href,
          vin,
          stockNumber,
          carfaxUrl,
          exteriorColor,
          interiorColor,
          engine,
          transmission,
          drivetrain,
          fuelType,
          features,
        };
      }, context);

      return vehicle;
    } catch (error) {
      console.warn(`[BrowserlessUnified] VDP scrape error for ${vdpUrl}:`, error);
      return null;
    }
  }

  async scrapeCarGurus(
    searchParams: { make: string; model: string; yearMin?: number; yearMax?: number; postalCode?: string; radiusKm?: number; maxResults?: number }
  ): Promise<MarketAnalysisResult> {
    const { make, model, yearMin, yearMax, postalCode = 'V6B2W2', radiusKm = 100, maxResults = 50 } = searchParams;

    let browser: Browser | null = null;
    let isCloud = false;

    try {
      const connection = await this.connectBrowser();
      browser = connection.browser;
      isCloud = connection.isCloud;

      const page = await browser.newPage();
      await this.configurePage(page);

      const normalizedMake = make.toLowerCase().replace(/\s+/g, '-');
      const normalizedModel = model.toLowerCase().replace(/\s+/g, '-');

      let searchUrl = `https://www.cargurus.ca/Cars/inventorylisting/viewDetailsFilterViewInventoryListing.action?zip=${postalCode}&showNegotiable=true&sortDir=ASC&sourceContext=carGurusHomePage_false_0&distance=${radiusKm}&entitySelectingHelper.selectedEntity=d${normalizedMake[0]}${normalizedMake.slice(1)}${normalizedModel[0].toUpperCase()}${normalizedModel.slice(1)}`;

      if (yearMin) searchUrl += `&startYear=${yearMin}`;
      if (yearMax) searchUrl += `&endYear=${yearMax}`;

      console.log(`[BrowserlessUnified] CarGurus search: ${searchUrl}`);
      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });

      await this.scrollToLoadAll(page, maxResults);

      const listings = await page.evaluate((ctx) => {
        const vehicles: any[] = [];
        const cards = document.querySelectorAll('[data-cg-ft="car-blade"], .listing-row, .result-card');

        cards.forEach((card, index) => {
          if (index >= ctx.maxResults) return;

          const titleEl = card.querySelector('h4, .listing-title, .car-blade-title');
          const title = titleEl?.textContent?.trim() || '';

          const priceEl = card.querySelector('[class*="price"], .listing-price');
          let price: number | null = null;
          if (priceEl) {
            const priceMatch = priceEl.textContent?.match(/\$([0-9,]+)/);
            if (priceMatch) price = parseInt(priceMatch[1].replace(/,/g, ''));
          }

          const mileageEl = card.querySelector('[class*="mileage"], [class*="odometer"]');
          let odometer: number | null = null;
          if (mileageEl) {
            const kmMatch = mileageEl.textContent?.match(/(\d+[,\d]*)\s*km/i);
            if (kmMatch) odometer = parseInt(kmMatch[1].replace(/,/g, ''));
          }

          const locationEl = card.querySelector('[class*="location"], .seller-location');
          const location = locationEl?.textContent?.trim() || '';

          const dealRatingEl = card.querySelector('[class*="deal-rating"], .deal-badge');
          const dealRating = dealRatingEl?.textContent?.trim() || '';

          const imgEl = card.querySelector('img') as HTMLImageElement;
          const image = imgEl?.src || '';

          const linkEl = card.querySelector('a[href*="/listing/"]') as HTMLAnchorElement;
          const listingUrl = linkEl?.href || '';

          const titleMatch = title.match(/(\d{4})\s+([A-Za-z]+)\s+(.+)/);
          if (titleMatch) {
            vehicles.push({
              year: parseInt(titleMatch[1]),
              make: titleMatch[2],
              model: titleMatch[3].split(/\s+/).slice(0, 2).join(' '),
              trim: titleMatch[3].split(/\s+/).slice(2).join(' ') || undefined,
              price,
              odometer,
              images: image ? [image] : [],
              badges: [],
              location,
              dealership: 'CarGurus Listing',
              dealershipId: 0,
              dealRating,
              cargurusUrl: listingUrl,
              sellerType: 'dealer' as const,
            });
          }
        });

        return vehicles;
      }, { maxResults });

      await page.close();
      if (isCloud) await browser.disconnect();

      console.log(`[BrowserlessUnified] CarGurus found ${listings.length} listings`);

      return {
        success: true,
        listings,
        source: 'cargurus',
      };

    } catch (error) {
      console.error('[BrowserlessUnified] CarGurus scrape error:', error);
      if (browser && isCloud) {
        try { await browser.disconnect(); } catch {}
      }
      return {
        success: false,
        listings: [],
        source: 'cargurus',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async scrapeAutoTrader(
    searchParams: { make: string; model: string; yearMin?: number; yearMax?: number; postalCode?: string; radiusKm?: number; maxResults?: number }
  ): Promise<MarketAnalysisResult> {
    const { make, model, yearMin, yearMax, postalCode = 'V6B2W2', radiusKm = 100, maxResults = 50 } = searchParams;

    let browser: Browser | null = null;
    let isCloud = false;

    try {
      const connection = await this.connectBrowser();
      browser = connection.browser;
      isCloud = connection.isCloud;

      const page = await browser.newPage();
      await this.configurePage(page);

      const normalizedMake = make.toLowerCase().replace(/\s+/g, '-');
      const normalizedModel = model.toLowerCase().replace(/\s+/g, '-');

      let searchUrl = `https://www.autotrader.ca/cars/${normalizedMake}/${normalizedModel}/?rcp=100&rcs=0&loc=${postalCode.replace(/\s/g, '')}&prx=${radiusKm}&prv=British%20Columbia&sts=Used`;
      
      if (yearMin) searchUrl += `&yRng=${yearMin}%2C${yearMax || new Date().getFullYear()}`;

      console.log(`[BrowserlessUnified] AutoTrader search: ${searchUrl}`);
      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });

      await sleep(2000);

      const listings = await page.evaluate((ctx) => {
        const vehicles: any[] = [];
        const cards = document.querySelectorAll('.listing-details, .result-item, [class*="listing-card"]');

        cards.forEach((card, index) => {
          if (index >= ctx.maxResults) return;

          const titleEl = card.querySelector('h2, h3, .title, [class*="title"]');
          const title = titleEl?.textContent?.trim() || '';

          const priceEl = card.querySelector('[class*="price"], .price-amount');
          let price: number | null = null;
          if (priceEl) {
            const priceMatch = priceEl.textContent?.match(/\$([0-9,]+)/);
            if (priceMatch) price = parseInt(priceMatch[1].replace(/,/g, ''));
          }

          const mileageEl = card.querySelector('[class*="mileage"], [class*="odometer"], [class*="km"]');
          let odometer: number | null = null;
          const cardText = card.textContent || '';
          const kmMatch = cardText.match(/(\d+[,\d]*)\s*km/i);
          if (kmMatch) odometer = parseInt(kmMatch[1].replace(/,/g, ''));

          const locationEl = card.querySelector('[class*="location"], [class*="dealer-location"]');
          const location = locationEl?.textContent?.trim() || '';

          const dealerEl = card.querySelector('[class*="dealer-name"], .seller-name');
          const dealer = dealerEl?.textContent?.trim() || 'AutoTrader Listing';

          const imgEl = card.querySelector('img') as HTMLImageElement;
          const image = imgEl?.src || imgEl?.getAttribute('data-src') || '';

          const linkEl = card.querySelector('a[href*="/a/"]') as HTMLAnchorElement;
          const listingUrl = linkEl?.href || '';

          const titleMatch = title.match(/(\d{4})\s+([A-Za-z]+)\s+(.+)/);
          if (titleMatch) {
            vehicles.push({
              year: parseInt(titleMatch[1]),
              make: titleMatch[2],
              model: titleMatch[3].split(/\s+/).slice(0, 2).join(' '),
              trim: titleMatch[3].split(/\s+/).slice(2).join(' ') || undefined,
              price,
              odometer,
              images: image ? [image] : [],
              badges: [],
              location,
              dealership: dealer,
              dealershipId: 0,
              dealerVdpUrl: listingUrl,
              sellerType: 'dealer' as const,
            });
          }
        });

        return vehicles;
      }, { maxResults });

      await page.close();
      if (isCloud) await browser.disconnect();

      console.log(`[BrowserlessUnified] AutoTrader found ${listings.length} listings`);

      return {
        success: true,
        listings,
        source: 'autotrader',
      };

    } catch (error) {
      console.error('[BrowserlessUnified] AutoTrader scrape error:', error);
      if (browser && isCloud) {
        try { await browser.disconnect(); } catch {}
      }
      return {
        success: false,
        listings: [],
        source: 'autotrader',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async scrapeMarketComparables(
    searchParams: { make: string; model: string; yearMin?: number; yearMax?: number; postalCode?: string; radiusKm?: number; maxResults?: number }
  ): Promise<MarketAnalysisResult> {
    const [cargurusResult, autotraderResult] = await Promise.all([
      this.scrapeCarGurus(searchParams),
      this.scrapeAutoTrader(searchParams),
    ]);

    const combinedListings = [
      ...cargurusResult.listings.map(l => ({ ...l, source: 'cargurus' as const })),
      ...autotraderResult.listings.map(l => ({ ...l, source: 'autotrader' as const })),
    ];

    combinedListings.sort((a, b) => (a.price || 0) - (b.price || 0));

    return {
      success: cargurusResult.success || autotraderResult.success,
      listings: combinedListings,
      source: 'combined',
      error: !cargurusResult.success && !autotraderResult.success
        ? `CarGurus: ${cargurusResult.error}, AutoTrader: ${autotraderResult.error}`
        : undefined,
    };
  }
}

let globalService: BrowserlessUnifiedService | null = null;

export function getBrowserlessUnifiedService(): BrowserlessUnifiedService {
  if (!globalService) {
    globalService = new BrowserlessUnifiedService();
  }
  return globalService;
}

export async function getBrowserlessUnifiedServiceForDealership(dealershipId: number): Promise<BrowserlessUnifiedService> {
  try {
    const apiKeys = await storage.getDealershipApiKeys(dealershipId);
    if (apiKeys?.browserlessApiKey) {
      return new BrowserlessUnifiedService({ apiKey: apiKeys.browserlessApiKey });
    }
  } catch (error) {
    console.warn(`[BrowserlessUnified] Error getting API key for dealership ${dealershipId}:`, error);
  }
  return getBrowserlessUnifiedService();
}
