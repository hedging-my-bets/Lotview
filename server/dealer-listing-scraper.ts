import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { execSync } from 'child_process';

// Apply stealth plugin to evade bot detection
puppeteer.use(StealthPlugin());

const DEALER_CONFIGS = [
  {
    name: 'Olympic Hyundai Vancouver',
    url: 'https://www.olympichyundaivancouver.com/vehicles/used/?st=price,desc&view=grid&sc=used',
    domain: 'olympichyundaivancouver.com',
    dealershipId: 1,
    location: 'Vancouver'
  },
  // TEMPORARILY DISABLED FOR TESTING - Enable after Olympic Hyundai works perfectly
  // {
  //   name: 'Boundary Hyundai',
  //   url: 'https://www.boundaryhyundai.com/vehicles/used/?st=price,desc&view=grid&sc=used',
  //   domain: 'boundaryhyundai.com',
  //   dealershipId: 2,
  //   location: 'Burnaby'
  // },
  // {
  //   name: 'Kia Vancouver',
  //   url: 'https://www.kiavancouver.com/vehicles/used/?st=year,desc&view=grid&sc=used',
  //   domain: 'kiavancouver.com',
  //   dealershipId: 3,
  //   location: 'Vancouver'
  // }
];

export interface DealerVehicleListing {
  vin: string | null;
  year: number;
  make: string;
  model: string;
  trim: string;
  odometer: number | null;
  price: number | null;
  images: string[];
  description: string;
  badges: string[];
  type: string; // Body type: SUV, Sedan, Truck, etc.
  stockNumber: string | null;
  vdpUrl: string;
  dealershipId: number;
  dealershipName: string;
  location: string;
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

// Helper function to determine body type from text
function determineBodyType(text: string): string {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('sedan')) return 'Sedan';
  if (lowerText.includes('suv') || lowerText.includes('sport utility')) return 'SUV';
  if (lowerText.includes('truck') || lowerText.includes('pickup')) return 'Truck';
  if (lowerText.includes('hatchback')) return 'Hatchback';
  if (lowerText.includes('coupe') || lowerText.includes('convertible')) return 'Coupe';
  if (lowerText.includes('wagon')) return 'Wagon';
  if (lowerText.includes('minivan') || lowerText.includes('van')) return 'Minivan';
  
  return 'SUV'; // Default
}

// Helper function to detect badges from text
function detectBadges(text: string): string[] {
  const badges: string[] = [];
  const lowerText = text.toLowerCase();
  
  if (/\b(one owner|1 owner|single owner)\b/.test(lowerText)) {
    badges.push('One Owner');
  }
  if (/\b(no accidents?|accident free|clean history|accident-free)\b/.test(lowerText)) {
    badges.push('No Accidents');
  }
  if (/\b(clean title|clear title)\b/.test(lowerText)) {
    badges.push('Clean Title');
  }
  if (/\b(certified|cpo|certified pre-owned)\b/.test(lowerText)) {
    badges.push('Certified Pre-Owned');
  }
  if (/\b(low km|low kilometers|low mileage|low km's)\b/.test(lowerText)) {
    badges.push('Low Kilometers');
  }
  
  return badges;
}

interface VehicleDetailData {
  vin: string | null;
  price: number | null;
  odometer: number | null;
  images: string[];
  trim: string;
  description: string;
  badges: string[];
  type: string;
  stockNumber: string | null;
}

async function scrapeVehicleDetailPage(browser: any, vdpUrl: string, retries = 2): Promise<VehicleDetailData> {
  let page = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      page = await browser.newPage();
      
      // CRITICAL: Relay browser console messages to Node.js logs
      page.on('console', (msg: any) => {
        const type = msg.type();
        const text = msg.text();
        if (type === 'warning' || type === 'warn') {
          console.warn(`[Browser Warning] ${text}`);
        } else if (type === 'error') {
          console.error(`[Browser Error] ${text}`);
        }
      });
      
      await page.goto(vdpUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      
      // Wait a moment for images to load
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const data = await page.evaluate(() => {
        const pageText = document.body.textContent || '';
        
        // HELPER: Check if element is in a payment context
        // CRITICAL: Only check element itself and attributes, NOT parent text (to avoid false positives)
        function isPaymentContext(element) {
          const paymentKeywords = /payment|weekly|bi-?weekly|monthly|calculator|financing|finance|per\s+month|\/mo/i;
          
          // Check element's own text content (the price value itself)
          const elementText = element.textContent || '';
          if (paymentKeywords.test(elementText)) {
            return true;
          }
          
          // Check element's class and ID attributes (use getAttribute to avoid SVG className issues)
          const elementClass = element.getAttribute('class') || '';
          const elementId = element.getAttribute('id') || '';
          if (paymentKeywords.test(elementClass) || paymentKeywords.test(elementId)) {
            return true;
          }
          
          // Check parent's class and ID (but NOT parent text - that includes disclaimers)
          const parent = element.parentElement;
          if (parent) {
            const parentClass = parent.getAttribute('class') || '';
            const parentId = parent.getAttribute('id') || '';
            if (paymentKeywords.test(parentClass) || paymentKeywords.test(parentId)) {
              return true;
            }
          }
          
          return false;
        }
        
        // Extract VIN
        let vin: string | null = null;
        const vinMatch = pageText.match(/VIN[:\s]*([A-HJ-NPR-Z0-9]{17})/i);
        if (vinMatch) {
          vin = vinMatch[1].toUpperCase();
        }
        
        // Extract Stock Number
        let stockNumber: string | null = null;
        const stockMatch = pageText.match(/stock[#\s:]*([A-Z0-9-]+)/i);
        if (stockMatch) {
          stockNumber = stockMatch[1];
        }
        
        // Extract price - target the actual selling price with high confidence
        let price: number | null = null;
        let priceConfidence: 'high' | 'medium' | 'low' = 'low';
        
        // Strategy 1: Target authoritative DOM nodes with dealer-specific selectors
        // NOTE: Avoid overly generic selectors like [id*="price"] that match financing widgets
        const authoritativePriceSelectors = [
          '[data-field="price"]',
          '[data-field="sellingPrice"]',
          '[data-price]',
          '[itemprop="price"]',
          '.vehicle-price',
          '.dealer-price',
          '.selling-price',
          '.final-price',
          '.sale-price',
          '#vehicle-price',
          '#selling-price',
          '#dealer-price'
          // Deliberately excluding generic [id*="price"] and [class*="sale-price"] to avoid matching financing calculators
        ];
        
        for (const selector of authoritativePriceSelectors) {
          const priceEl = document.querySelector(selector);
          if (priceEl) {
            // CRITICAL: Use payment context helper to reject payment widgets
            if (!isPaymentContext(priceEl)) {
              const priceText = priceEl.textContent || priceEl.getAttribute('data-value') || priceEl.getAttribute('data-price') || '';
              const match = priceText.match(/\$?\s*([0-9,]+)/);
              if (match) {
                const val = parseInt(match[1].replace(/,/g, ''));
                // Realistic minimum: $1000 (excludes payment amounts like $399)
                if (val >= 1000 && val <= 500000) {
                  price = val;
                  priceConfidence = 'high';
                  break; // Use first valid CASH price from authoritative selector
                }
                // Note: Values below $1000 are ignored as likely payment amounts
              }
            }
          }
        }
        
        // Strategy 2: Scoped regex with label anchoring (high confidence)
        if (!price) {
          const labeledPricePatterns = [
            /(?:Sale|Selling|Asking|Dealer|Final|Internet)\s*Price[:\s]*\$?\s*([0-9,]+)/i,
            /Price[:\s]*\$?\s*([0-9,]+)(?!\s*(?:weekly|monthly|payment))/i,
            /\$\s*([0-9,]+)\s*(?:CAD|CDN|Canadian)?(?!\s*(?:weekly|monthly|payment|per))/i
          ];
          
          for (const pattern of labeledPricePatterns) {
            const match = pageText.match(pattern);
            if (match) {
              const val = parseInt(match[1].replace(/,/g, ''));
              // Realistic minimum: $1000 (excludes typical payment amounts)
              if (val >= 1000 && val <= 500000) {
                price = val;
                priceConfidence = 'medium';
                break;
              }
              // Note: Values below $1000 are ignored as likely payment amounts
            }
          }
        }
        
        // Strategy 3: Last resort - scan all prices, use median (avoid both payments and MSRP)
        // NOTE: This is unreliable and may be removed in future
        if (!price) {
          const priceRegex = /\$\s*([0-9,]+)(?!\s*(?:weekly|bi-?weekly|monthly|per\s+month|\/mo|payment))/gi;
          let priceMatch;
          const prices: number[] = [];
          
          while ((priceMatch = priceRegex.exec(pageText)) !== null) {
            const val = parseInt(priceMatch[1].replace(/,/g, ''));
            // Minimum $2000 for fallback strategy (more conservative but still captures low-end inventory)
            if (val >= 2000 && val <= 500000) {
              prices.push(val);
            }
          }
          
          // Use MEDIAN price (more robust than min/max)
          if (prices.length >= 2) {
            prices.sort((a, b) => a - b);
            const mid = Math.floor(prices.length / 2);
            price = prices.length % 2 === 0 ? prices[mid - 1] : prices[mid];
            priceConfidence = 'low';
          } else if (prices.length === 1) {
            price = prices[0];
            priceConfidence = 'low';
          }
          // Note: Low confidence prices are still used but should be validated
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
        
        // Extract trim from title/heading
        let trim = 'Base';
        const h1 = document.querySelector('h1');
        if (h1) {
          const titleText = h1.textContent || '';
          // Try to extract trim from title (usually after model name)
          const trimMatch = titleText.match(/(?:\d{4}\s+[A-Za-z-]+\s+[A-Za-z0-9-]+\s+)([A-Za-z0-9\s]+)/i);
          if (trimMatch && trimMatch[1]) {
            trim = trimMatch[1].trim();
          }
        }
        
        // Extract description
        let description = '';
        const descriptionSelectors = [
          '[class*="description"]',
          '[class*="details"]',
          '[class*="comments"]',
          'p[class*="text"]',
          '.vehicle-description',
          '#description'
        ];
        
        for (const selector of descriptionSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent && element.textContent.length > 50) {
            description = element.textContent.trim();
            break;
          }
        }
        
        // If no description found, create a basic one
        if (!description) {
          description = `Used vehicle. Contact dealer for more information.`;
        }
        
        // Extract images
        const images: string[] = [];
        const imageSelectors = [
          'img[src*="/photos/"]',
          'img[src*="/images/"]',
          'img[src*="/inventory/"]',
          'img[src*="/vehicle/"]',
          'img[class*="vehicle"]',
          'img[class*="gallery"]',
          '.vehicle-images img',
          '[class*="photo"] img',
          '[class*="gallery"] img'
        ];
        
        const processedUrls = new Set<string>();
        for (const selector of imageSelectors) {
          const imgs = document.querySelectorAll(selector);
          imgs.forEach((img: any) => {
            let src = img.getAttribute('src') || img.getAttribute('data-src') || '';
            if (src && !src.includes('placeholder') && !src.includes('logo') && !src.includes('icon')) {
              // Convert relative URLs to absolute
              if (src.startsWith('//')) {
                src = 'https:' + src;
              } else if (src.startsWith('/')) {
                src = window.location.origin + src;
              }
              
              if (src.startsWith('http') && !processedUrls.has(src)) {
                processedUrls.add(src);
                images.push(src);
              }
            }
          });
        }
        
        return {
          vin,
          price,
          odometer,
          images,
          trim,
          description,
          stockNumber,
          pageText
        };
      });
      
      // Detect badges and body type from page text
      const badges = detectBadges(data.pageText);
      const type = determineBodyType(data.pageText);
      
      if (page) await page.close().catch(() => {});
      
      return {
        vin: data.vin,
        price: data.price,
        odometer: data.odometer,
        images: data.images,
        trim: data.trim,
        description: data.description,
        badges,
        type,
        stockNumber: data.stockNumber
      };
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
      
      // Final attempt failed, return defaults
      return {
        vin: null,
        price: null,
        odometer: null,
        images: [],
        trim: 'Base',
        description: 'Used vehicle. Contact dealer for more information.',
        badges: [],
        type: 'SUV',
        stockNumber: null
      };
    }
  }
  
  return {
    vin: null,
    price: null,
    odometer: null,
    images: [],
    trim: 'Base',
    description: 'Used vehicle. Contact dealer for more information.',
    badges: [],
    type: 'SUV',
    stockNumber: null
  };
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
      '--disable-blink-features=AutomationControlled'
    ],
  });

  const page = await browser.newPage();
  
  // Set a realistic user agent to avoid bot detection
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  try {
    const response = await page.goto(dealerConfig.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    console.log(`  Waiting for vehicle listings to load...`);
    console.log(`  Response status: ${response?.status()}, url: ${response?.url()}`);
    
    // Check for Cloudflare challenge page
    const pageContent = await page.content();
    if (pageContent.includes('Checking your browser') || pageContent.includes('cloudflare') || pageContent.includes('cf-browser-verification')) {
      console.error('  ⚠ Cloudflare challenge detected - scraper is being blocked');
      throw new Error('Cloudflare challenge page detected');
    }
    
    // Wait for vehicle links to appear
    await page.waitForSelector('a[href*="/vehicles/2"]', { timeout: 15000 });
    
    // Give page a moment to fully render
    await page.waitForFunction(
      () => document.querySelectorAll('a[href*="/vehicles/2"]').length > 0,
      { timeout: 10000 }
    );

    // Infinite scroll to load ALL vehicles
    console.log(`  Scrolling to load all vehicles...`);
    let previousCount = 0;
    let stableCount = 0;
    
    for (let i = 0; i < 30; i++) { // Max 30 scrolls
      // Scroll to bottom
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      
      // Wait for new content to load
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check if new vehicles loaded
      const currentCount = await page.evaluate(() => {
        return document.querySelectorAll('a[href*="/vehicles/2"]').length;
      });
      
      console.log(`    Scroll ${i + 1}: Found ${currentCount} vehicle links`);
      
      if (currentCount === previousCount) {
        stableCount++;
        if (stableCount >= 3) {
          console.log(`    ✓ No new vehicles after 3 scrolls, stopping.`);
          break;
        }
      } else {
        stableCount = 0;
      }
      
      previousCount = currentCount;
    }

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
    
    // Visit each VDP to extract complete vehicle data
    const vehicles: DealerVehicleListing[] = [];
    
    console.log(`  Processing ${vdpUrls.length} vehicles...`);
    
    for (let i = 0; i < vdpUrls.length; i++) {
      const urlData = vdpUrls[i];
      console.log(`  [${i + 1}/${vdpUrls.length}] Scraping ${urlData.year} ${urlData.make} ${urlData.model}...`);
      
      const detailData = await scrapeVehicleDetailPage(browser, urlData.vdpUrl);
      
      vehicles.push({
        vin: detailData.vin,
        year: urlData.year,
        make: urlData.make,
        model: urlData.model,
        trim: detailData.trim,
        odometer: detailData.odometer,
        price: detailData.price,
        images: detailData.images,
        description: detailData.description,
        badges: detailData.badges,
        type: detailData.type,
        stockNumber: detailData.stockNumber,
        vdpUrl: urlData.vdpUrl,
        dealershipId: dealerConfig.dealershipId,
        dealershipName: dealerConfig.name,
        location: dealerConfig.location,
      });
      
      console.log(`    ✓ Extracted: ${detailData.images.length} photos, ${detailData.badges.length} badges, Price: $${detailData.price || 'N/A'}`);
      
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
