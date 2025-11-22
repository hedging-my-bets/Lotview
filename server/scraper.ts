import puppeteer from 'puppeteer';
import { execSync } from 'child_process';
import { sql } from 'drizzle-orm';
import { db } from './db';
import { vehicles } from '@shared/schema';

interface ScrapedVehicle {
  year: number;
  make: string;
  model: string;
  trim: string;
  type: string;
  price: number;
  odometer: number;
  images: string[];
  badges: string[];
  location: string;
  dealership: string;
  description: string;
  vin?: string;
  stockNumber?: string;
}

const INVENTORY_URL = 'https://www.olympicautogroup.ca/vehicles/used/?st=year,desc&view=grid&sc=used&fn=Boundary%20Hyundai,Olympic%20Hyundai%20Vancouver,Kia%20Vancouver';

const BADGE_KEYWORDS = {
  oneOwner: ['one owner', '1 owner', 'single owner'],
  noAccidents: ['no accidents', 'accident free', 'clean history', 'accident-free'],
  cleanTitle: ['clean title', 'clear title'],
  certifiedPreOwned: ['certified', 'cpo', 'certified pre-owned'],
  lowKm: ['low km', 'low kilometers', 'low mileage', 'low km\'s'],
  managerSpecial: ['manager special', 'manager\'s special'],
  newArrival: ['new arrival', 'just arrived'],
  fuelEfficient: ['fuel efficient', 'great fuel economy'],
  fullyLoaded: ['fully loaded', 'loaded'],
};

function detectBadges(text: string): string[] {
  const badges: string[] = [];
  const lowerText = text.toLowerCase();

  if (BADGE_KEYWORDS.oneOwner.some(keyword => lowerText.includes(keyword))) {
    badges.push('One Owner');
  }
  if (BADGE_KEYWORDS.noAccidents.some(keyword => lowerText.includes(keyword))) {
    badges.push('No Accidents');
  }
  if (BADGE_KEYWORDS.cleanTitle.some(keyword => lowerText.includes(keyword))) {
    badges.push('Clean Title');
  }
  if (BADGE_KEYWORDS.certifiedPreOwned.some(keyword => lowerText.includes(keyword))) {
    badges.push('Certified Pre-Owned');
  }
  if (BADGE_KEYWORDS.lowKm.some(keyword => lowerText.includes(keyword))) {
    badges.push('Low Kilometers');
  }
  if (BADGE_KEYWORDS.managerSpecial.some(keyword => lowerText.includes(keyword))) {
    badges.push('Manager Special');
  }
  if (BADGE_KEYWORDS.newArrival.some(keyword => lowerText.includes(keyword))) {
    badges.push('New Arrival');
  }
  if (BADGE_KEYWORDS.fuelEfficient.some(keyword => lowerText.includes(keyword))) {
    badges.push('Fuel Efficient');
  }
  if (BADGE_KEYWORDS.fullyLoaded.some(keyword => lowerText.includes(keyword))) {
    badges.push('Fully Loaded');
  }

  return badges;
}

function determineBodyType(bodyStyle: string): string {
  const lowerBody = bodyStyle.toLowerCase();
  
  if (lowerBody.includes('sedan')) return 'Sedan';
  if (lowerBody.includes('suv')) return 'SUV';
  if (lowerBody.includes('truck') || lowerBody.includes('crew cab')) return 'Truck';
  if (lowerBody.includes('hatchback')) return 'Hatchback';
  if (lowerBody.includes('coupe') || lowerBody.includes('convertible')) return 'Coupe';
  if (lowerBody.includes('wagon')) return 'Wagon';
  if (lowerBody.includes('minivan') || lowerBody.includes('van')) return 'Minivan';
  
  return 'SUV'; // Default
}

async function scrapeInventoryPage(): Promise<ScrapedVehicle[]> {
  console.log('Launching browser...');
  
  // Find chromium executable
  let chromiumPath = '';
  try {
    chromiumPath = execSync('which chromium').toString().trim();
  } catch {
    chromiumPath = '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium';
  }
  
  console.log(`Using Chromium at: ${chromiumPath}`);
  
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: chromiumPath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-software-rasterizer'
    ]
  });
  
  try {
    const page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log('Navigating to inventory page...');
    await page.goto(INVENTORY_URL, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    
    console.log('Waiting for vehicle listings to load...');
    // Wait for vehicle cards to appear
    await page.waitForSelector('a[href*="/vehicles/2"]', { timeout: 30000 });
    
    console.log('Scrolling to load all vehicles...');
    // Scroll down multiple times to trigger lazy loading
    let previousCount = 0;
    let currentCount = 0;
    let scrollAttempts = 0;
    const maxScrollAttempts = 30;
    
    do {
      // Get current count of vehicles
      previousCount = currentCount;
      currentCount = await page.evaluate(() => {
        return document.querySelectorAll('a[href*="/vehicles/2"]').length;
      });
      
      // Scroll to bottom
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      
      // Wait for new content to load
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      scrollAttempts++;
      console.log(`Scroll ${scrollAttempts}: Found ${currentCount} vehicle links...`);
      
    } while (currentCount > previousCount && scrollAttempts < maxScrollAttempts);
    
    console.log(`Finished scrolling. Found ${currentCount} total vehicle links.`);
    
    // Scroll back to top
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('Extracting vehicle data...');
    
    const vehicles = await page.evaluate(() => {
      const vehicleData: any[] = [];
      
      // Find all links that contain vehicle detail pages
      const links = Array.from(document.querySelectorAll('a[href*="/vehicles/2"]'));
      const processedUrls = new Set<string>();
      
      links.forEach(link => {
        const href = link.getAttribute('href');
        if (!href) return;
        
        // Filter for actual vehicle detail pages (year/make/model pattern)
        const match = href.match(/\/vehicles\/(\d{4})\/([a-z-]+)\/([a-z0-9-]+)\//);
        if (!match) return;
        
        // Skip duplicates
        if (processedUrls.has(href)) return;
        processedUrls.add(href);
        
        const [, yearStr, makeSlug, modelSlug] = match;
        
        // Get the containing card/element
        const card = link.closest('.vehicle-card, .vehicle-item, .product-item, article, .item, .listing') || link;
        
        const cardText = card.textContent || '';
        const heading = (card.querySelector('h1, h2, h3, h4, h5, .title, .heading') as HTMLElement)?.textContent || '';
        
        // Extract year, make, model from URL
        const year = parseInt(yearStr);
        const make = makeSlug.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        const model = modelSlug.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        
        // Extract trim from heading
        let trim = 'Base';
        const headingParts = heading.split('|')[0].trim().split(' ');
        if (headingParts.length > 3) {
          trim = headingParts.slice(3).join(' ').trim();
        }
        if (!trim || trim.length === 0) trim = 'Base';
        
        // Determine dealership
        let dealership = 'Olympic Hyundai Vancouver';
        let location = 'Vancouver';
        if (cardText.includes('Boundary Hyundai')) {
          dealership = 'Boundary Hyundai Vancouver';
          location = 'Burnaby';
        } else if (cardText.includes('Kia Vancouver')) {
          dealership = 'Kia Vancouver';
          location = 'Vancouver';
        } else if (cardText.includes('Olympic Hyundai Vancouver')) {
          dealership = 'Olympic Hyundai Vancouver';
          location = 'Vancouver';
        }
        
        // Extract price
        let price = 0;
        const priceElem = card.querySelector('.price, .dealer-price, [class*="price"]');
        if (priceElem) {
          const priceText = priceElem.textContent || '';
          const priceMatch = priceText.match(/\$([0-9,]+)/);
          if (priceMatch) {
            price = parseInt(priceMatch[1].replace(/,/g, ''));
          }
        }
        
        // Extract kilometers
        let odometer = 0;
        const kmMatch = cardText.match(/(\d+[,\d]*)\s*km/i);
        if (kmMatch) {
          odometer = parseInt(kmMatch[1].replace(/,/g, ''));
        }
        
        // Extract body style
        let bodyStyle = 'SUV';
        const bodyStyleMatch = cardText.match(/Body Style:\s*([^\n]+)/i);
        if (bodyStyleMatch) {
          bodyStyle = bodyStyleMatch[1].trim();
        }
        
        // Extract primary image
        const img = card.querySelector('img');
        let primaryImage = 'https://via.placeholder.com/400x300?text=No+Image';
        if (img) {
          primaryImage = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || primaryImage;
        }
        
        // Get the detail page URL
        const detailUrl = href.startsWith('http') ? href : `https://www.olympicautogroup.ca${href}`;
        
        vehicleData.push({
          year,
          make,
          model,
          trim,
          bodyStyle,
          price,
          odometer,
          primaryImage,
          detailUrl,
          location,
          dealership,
          cardText: cardText.substring(0, 500), // For badge detection
          heading
        });
      });
      
      return vehicleData;
    });
    
    console.log(`Extracted ${vehicles.length} vehicles from page`);
    console.log('Fetching detailed information for each vehicle...');
    
    // Process each vehicle and fetch detail page
    const scrapedVehicles: ScrapedVehicle[] = [];
    
    for (let i = 0; i < vehicles.length; i++) {
      const v = vehicles[i];
      console.log(`[${i + 1}/${vehicles.length}] Processing ${v.year} ${v.make} ${v.model}...`);
      
      // Create a new page for each vehicle to avoid detached frame issues
      let detailPage = page;
      if (i > 0) {
        try {
          detailPage = await browser.newPage();
        } catch (e) {
          console.log('  Could not create new page, reusing existing');
        }
      }
      
      try {
        // Navigate to detail page
        await detailPage.goto(v.detailUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // Wait for the gallery and spec data to load (short timeout)
        try {
          await detailPage.waitForSelector('[data-gallery]', { timeout: 2000 });
        } catch (e) {
          // Silently use fallback extraction
        }
        
        // Extract detailed information
        const detailData = await detailPage.evaluate(() => {
          // Extract all images from data-gallery JSON
          const images: string[] = [];
          const galleryEl = document.querySelector('[data-gallery]');
          if (galleryEl) {
            try {
              const galleryData = JSON.parse(galleryEl.getAttribute('data-gallery') || '[]');
              if (Array.isArray(galleryData)) {
                galleryData.forEach((item: any) => {
                  if (item.url || item.src) {
                    const url = item.url || item.src;
                    // Get high-res version
                    const highResUrl = url.replace('-420x315', '-1024x786').replace('-300x225', '-1024x786');
                    if (highResUrl && !images.includes(highResUrl)) {
                      images.push(highResUrl);
                    }
                  }
                });
              }
            } catch (e) {
              console.error('Error parsing gallery JSON:', e);
            }
          }
          
          // Fallback to img tags if no gallery data
          if (images.length === 0) {
            const imgElements = document.querySelectorAll('img');
            imgElements.forEach(img => {
              const src = img.src || img.getAttribute('data-src') || '';
              if (src.includes('photomanager') || src.includes('autotrader') || src.includes('photos')) {
                const highResSrc = src.replace('-420x315', '-1024x786').replace('-300x225', '-1024x786');
                if (highResSrc && !images.includes(highResSrc)) {
                  images.push(highResSrc);
                }
              }
            });
          }
          
          // Extract description from h1
          const h1 = document.querySelector('h1');
          let description = h1?.textContent?.trim() || '';
          
          // Extract VIN from data-field attribute
          let vin = '';
          const vinEl = document.querySelector('[data-field="vin"]');
          if (vinEl) {
            vin = vinEl.textContent?.trim() || vinEl.getAttribute('data-value') || '';
          }
          // Fallback to regex if not found
          if (!vin) {
            const vinMatch = document.body.textContent?.match(/VIN[:\s]+([A-HJ-NPR-Z0-9]{17})/i);
            if (vinMatch) vin = vinMatch[1];
          }
          
          // Extract Stock # from data-field attribute
          let stockNumber = '';
          const stockEl = document.querySelector('[data-field="stock"]') || 
                          document.querySelector('[data-field="stockNumber"]');
          if (stockEl) {
            stockNumber = stockEl.textContent?.trim() || stockEl.getAttribute('data-value') || '';
          }
          // Fallback to regex if not found
          if (!stockNumber) {
            const stockMatch = document.body.textContent?.match(/Stock\s*#?[:\s]+([A-Z0-9]+)/i);
            if (stockMatch) stockNumber = stockMatch[1];
          }
          
          // Extract body style from specs
          let bodyStyle = '';
          const bodyStyleElem = Array.from(document.querySelectorAll('li')).find(li => 
            li.textContent?.includes('Body Style:')
          );
          if (bodyStyleElem) {
            bodyStyle = bodyStyleElem.textContent.replace('Body Style:', '').trim();
          }
          
          return {
            images: images.slice(0, 10), // Limit to 10 images
            description,
            vin,
            stockNumber,
            bodyStyle
          };
        });
        
        const badges = detectBadges(v.cardText + ' ' + v.heading);
        const type = determineBodyType(detailData.bodyStyle || v.bodyStyle);
        const finalDescription = detailData.description || `${v.year} ${v.make} ${v.model} ${v.trim}`.trim();
        
        // Use detail images if available, otherwise fall back to primary image
        const finalImages = detailData.images.length > 0 ? detailData.images : [v.primaryImage];
        
        scrapedVehicles.push({
          year: v.year,
          make: v.make,
          model: v.model,
          trim: v.trim,
          type,
          price: v.price,
          odometer: v.odometer,
          images: finalImages,
          badges,
          location: v.location,
          dealership: v.dealership,
          description: finalDescription,
          vin: detailData.vin || undefined,
          stockNumber: detailData.stockNumber || undefined
        });
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error(`  Error fetching details for ${v.year} ${v.make} ${v.model}:`, error);
        // Fallback to basic data
        const badges = detectBadges(v.cardText + ' ' + v.heading);
        const type = determineBodyType(v.bodyStyle);
        
        scrapedVehicles.push({
          year: v.year,
          make: v.make,
          model: v.model,
          trim: v.trim,
          type,
          price: v.price,
          odometer: v.odometer,
          images: [v.primaryImage],
          badges,
          location: v.location,
          dealership: v.dealership,
          description: `${v.year} ${v.make} ${v.model} ${v.trim}`.trim()
        });
      } finally {
        // Close the detail page if it's not the main page
        if (i > 0 && detailPage !== page) {
          try {
            await detailPage.close();
          } catch (e) {
            // Ignore close errors
          }
        }
      }
    }
    
    return scrapedVehicles;
    
  } finally {
    await browser.close();
    console.log('Browser closed');
  }
}

export async function scrapeAllDealerships(): Promise<number> {
  console.log('Starting Olympic Auto Group inventory scrape...');
  
  try {
    const scrapedVehicles = await scrapeInventoryPage();
    
    if (scrapedVehicles.length > 0) {
      console.log(`Scraped ${scrapedVehicles.length} vehicles. Saving to database...`);
      
      // Clear existing inventory (delete views first to avoid foreign key constraint)
      await db.execute(sql`TRUNCATE TABLE vehicle_views, vehicles RESTART IDENTITY CASCADE`);
      
      // Insert new inventory
      await db.insert(vehicles).values(scrapedVehicles);
      
      console.log(`✓ Successfully scraped and saved ${scrapedVehicles.length} vehicles`);
    } else {
      console.log('⚠ No vehicles scraped');
    }
    
    return scrapedVehicles.length;
  } catch (error) {
    console.error('✗ Scraping failed:', error);
    throw error;
  }
}

export async function testBadgeDetection() {
  const testDescriptions = [
    "One owner vehicle with clean history. No accidents reported.",
    "Certified pre-owned with low kilometers. Accident free!",
    "Clean title, single owner, excellent condition",
    "Manager Special | Low Km's | New Arrival",
    "Great fuel economy on this used vehicle"
  ];

  console.log('\n=== Badge Detection Test ===');
  testDescriptions.forEach((desc, i) => {
    const badges = detectBadges(desc);
    console.log(`\nTest ${i + 1}: "${desc}"`);
    console.log(`Detected badges: ${badges.join(', ') || 'None'}`);
  });
}

