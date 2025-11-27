import puppeteer from 'puppeteer';
import { execSync } from 'child_process';

const DEALER_CONFIGS = [
  {
    name: 'Olympic Hyundai Vancouver',
    url: 'https://www.olympichyundaivancouver.com/vehicles/used/?st=price,desc&view=grid&sc=used',
    domain: 'olympichyundaivancouver.com',
    dealershipId: 1,
    location: 'Vancouver'
  },
  {
    name: 'Boundary Hyundai',
    url: 'https://www.boundaryhyundai.com/vehicles/used/?st=price,desc&view=grid&sc=used',
    domain: 'boundaryhyundai.com',
    dealershipId: 2,
    location: 'Burnaby'
  },
  {
    name: 'Kia Vancouver',
    url: 'https://www.kiavancouver.com/vehicles/used/?st=year,desc&view=grid&sc=used',
    domain: 'kiavancouver.com',
    dealershipId: 3,
    location: 'Vancouver'
  }
];

export interface DealerVehicleListing {
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  odometer: number | null;
  price: number | null;
  vdpUrl: string;
  dealershipId: number;
  dealershipName: string;
}

function parsePrice(priceText: string): number | null {
  const priceMatch = priceText.match(/\$?\s*([0-9,]+)/);
  if (priceMatch) {
    const price = parseInt(priceMatch[1].replace(/,/g, ''));
    if (price >= 1000 && price <= 500000) {
      return price;
    }
  }
  return null;
}

function parseOdometer(odoText: string): number | null {
  const odoMatch = odoText.match(/([0-9,]+)\s*(km|kilometers?)/i);
  if (odoMatch) {
    return parseInt(odoMatch[1].replace(/,/g, ''));
  }
  return null;
}

function parseYear(text: string): number | null {
  const yearMatch = text.match(/\b(20\d{2})\b/);
  if (yearMatch) {
    return parseInt(yearMatch[1]);
  }
  return null;
}

async function scrapeVehicleDetailPage(browser: any, vdpUrl: string, retries = 2): Promise<{ vin: string | null, price: number | null, odometer: number | null }> {
  let page = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      page = await browser.newPage();
      await page.goto(vdpUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
      
      const data = await page.evaluate(() => {
        const pageText = document.body.textContent || '';
        
        // Extract VIN
        let vin: string | null = null;
        const vinMatch = pageText.match(/VIN[:\s]*([A-HJ-NPR-Z0-9]{17})/i);
        if (vinMatch) {
          vin = vinMatch[1].toUpperCase();
        }
        
        // Extract price - look for largest dollar amount in valid range
        let price: number | null = null;
        const priceRegex = /\$\s*([0-9,]+)/g;
        let priceMatch;
        while ((priceMatch = priceRegex.exec(pageText)) !== null) {
          const val = parseInt(priceMatch[1].replace(/,/g, ''));
          if (val >= 5000 && val <= 500000 && (!price || val > price)) {
            price = val;
          }
        }
        
        // Extract odometer
        let odometer: number | null = null;
        const odoMatch = pageText.match(/([0-9,]+)\s*(km|kilometers?)/i);
        if (odoMatch) {
          const val = parseInt(odoMatch[1].replace(/,/g, ''));
          if (val > 0 && val < 500000) {
            odometer = val;
          }
        }
        
        return { vin, price, odometer };
      });
      
      if (page) await page.close().catch(() => {});
      return data;
    } catch (error) {
      if (page) {
        try {
          await page.close();
        } catch (closeError) {
          // Ignore close errors
        }
      }
      
      if (attempt < retries) {
        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }
      
      // Final attempt failed, return nulls
      return { vin: null, price: null, odometer: null };
    }
  }
  
  return { vin: null, price: null, odometer: null };
}

async function scrapeDealerListings(dealerConfig: typeof DEALER_CONFIGS[0]): Promise<DealerVehicleListing[]> {
  console.log(`\n[${dealerConfig.name}] Scraping dealer listing page...`);
  
  let chromiumPath = '';
  try {
    chromiumPath = execSync('which chromium').toString().trim();
  } catch {
    chromiumPath = '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium';
  }

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: chromiumPath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  const page = await browser.newPage();
  
  try {
    await page.goto(dealerConfig.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    console.log(`  Waiting for vehicle listings to load...`);
    
    // Wait for vehicle links to appear
    await page.waitForSelector('a[href*="/vehicles/2"]', { timeout: 15000 });
    
    // Give page a moment to fully render
    await page.waitForFunction(
      () => document.querySelectorAll('a[href*="/vehicles/2"]').length > 0,
      { timeout: 10000 }
    );

    console.log(`  Extracting VDP URLs...`);
    
    const vdpUrls = await page.evaluate((baseUrl) => {
      const results: any[] = [];
      const processedUrls = new Set<string>();
      
      // Find all vehicle detail page links
      const links = Array.from(document.querySelectorAll('a[href*="/vehicles/2"]'));
      
      links.forEach(link => {
        const href = link.getAttribute('href');
        if (!href) return;
        
        // Filter for actual VDP URLs: /vehicles/{year}/{make}/{model}/{city}/{province}/{ID}/
        const match = href.match(/\/vehicles\/(\d{4})\/([a-z-]+)\/([a-z0-9-]+)\/([a-z-]+)\/([a-z]+)\/(\d+)\//i);
        if (!match) return;
        
        const fullUrl = href.startsWith('http') ? href : `https://${baseUrl}${href}`;
        
        if (processedUrls.has(fullUrl)) return;
        processedUrls.add(fullUrl);
        
        // Extract year, make, model from URL
        const year = parseInt(match[1]);
        const make = match[2].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        const model = match[3].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        
        results.push({ vdpUrl: fullUrl, year, make, model });
      });
      
      return results;
    }, dealerConfig.domain);

    console.log(`  ✓ Found ${vdpUrls.length} VDP URLs, now extracting VIN/price/odometer...`);
    
    await page.close();
    
    // Visit each VDP to extract VIN, price, odometer
    const vehicles: DealerVehicleListing[] = [];
    
    for (let i = 0; i < Math.min(vdpUrls.length, 20); i++) { // Limit to 20 for reasonable scrape time
      const urlData = vdpUrls[i];
      console.log(`  [${i + 1}/${Math.min(vdpUrls.length, 20)}] Scraping ${urlData.year} ${urlData.make} ${urlData.model}...`);
      
      const detailData = await scrapeVehicleDetailPage(browser, urlData.vdpUrl);
      
      vehicles.push({
        vin: detailData.vin,
        year: urlData.year,
        make: urlData.make,
        model: urlData.model,
        odometer: detailData.odometer,
        price: detailData.price,
        vdpUrl: urlData.vdpUrl,
        dealershipId: dealerConfig.dealershipId,
        dealershipName: dealerConfig.name,
      });
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`  ✓ Successfully scraped ${vehicles.length} vehicles from ${dealerConfig.name}`);
    
    await browser.close();
    return vehicles;
    
  } catch (error) {
    console.error(`  ✗ Error scraping ${dealerConfig.name}:`, error);
    await browser.close();
    return [];
  }
}

export async function scrapeAllDealerListings(): Promise<DealerVehicleListing[]> {
  console.log('\n=== SCRAPING DEALER LISTING PAGES ===');
  
  const allListings: DealerVehicleListing[] = [];
  
  for (const config of DEALER_CONFIGS) {
    try {
      const listings = await scrapeDealerListings(config);
      allListings.push(...listings);
    } catch (error) {
      console.error(`Failed to scrape ${config.name}:`, error);
    }
  }
  
  console.log(`\n✓ Total dealer listings scraped: ${allListings.length}\n`);
  
  return allListings;
}
