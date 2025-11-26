import puppeteer from 'puppeteer';
import { execSync } from 'child_process';

// CarGurus dealer page URLs for the three dealerships (PRIMARY DATA SOURCE)
const DEALER_PAGES = [
  {
    name: 'Olympic Hyundai Vancouver',
    url: 'https://www.cargurus.ca/Cars/m-Olympic-Hyundai-Vancouver-sp459833',
    dealershipId: 1,
    location: 'Vancouver'
  },
  {
    name: 'Boundary Hyundai',
    url: 'https://www.cargurus.ca/Cars/m-Boundary-Hyundai-sp393663',
    dealershipId: 2,
    location: 'Burnaby'
  },
  {
    name: 'Kia Vancouver',
    url: 'https://www.cargurus.ca/Cars/m-Kia-Vancouver-sp357122',
    dealershipId: 3,
    location: 'Vancouver'
  }
];

interface CarGurusVehicle {
  year: number;
  make: string;
  model: string;
  trim: string;
  type: string; // Body type
  price: number;
  odometer: number;
  images: string[];
  badges: string[];
  location: string;
  dealership: string;
  dealershipId: number;
  description: string;
  vin?: string;
  stockNumber?: string;
  carfaxUrl?: string;
  dealRating?: string; // "Great Deal", "Good Deal", etc.
  cargurusPrice?: number;
  cargurusUrl?: string;
}

// Determine body type from description or model name
function determineBodyType(description: string, model: string): string {
  const text = (description + ' ' + model).toLowerCase();
  
  if (text.includes('sedan')) return 'Sedan';
  if (text.includes('suv') || text.includes('sport utility')) return 'SUV';
  if (text.includes('truck') || text.includes('crew cab') || text.includes('pickup')) return 'Truck';
  if (text.includes('hatchback')) return 'Hatchback';
  if (text.includes('coupe') || text.includes('convertible')) return 'Coupe';
  if (text.includes('wagon')) return 'Wagon';
  if (text.includes('minivan') || text.includes('van')) return 'Minivan';
  
  return 'SUV'; // Default
}

// Extract badges from description text
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

async function scrapeCarGurusVehicleDetail(page: any, listingUrl: string, dealershipName: string, dealershipId: number, location: string): Promise<CarGurusVehicle | null> {
  try {
    await page.goto(listingUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Extract complete vehicle data
    const vehicleData = await page.evaluate(() => {
      const data: any = {};
      
      // Extract title (e.g., "2022 Toyota Corolla LE FWD")
      const titleEl = document.querySelector('h1, [class*="heading"]');
      const title = titleEl?.textContent?.trim() || '';
      
      // Parse year, make, model, trim from title
      const titleMatch = title.match(/(\d{4})\s+([A-Za-z-]+)\s+([A-Za-z0-9\s-]+?)(?:\s+([A-Z]{2,}(?:\s+[A-Z]{2,})*))?$/);
      if (titleMatch) {
        data.year = parseInt(titleMatch[1]);
        data.make = titleMatch[2];
        // Split on first space to separate model from trim
        const rest = titleMatch[3].trim();
        const parts = rest.split(/\s+/);
        data.model = parts[0];
        data.trim = parts.slice(1).join(' ') || 'Base';
        if (titleMatch[4]) {
          data.trim = (data.trim + ' ' + titleMatch[4]).trim();
        }
      }
      
      // Extract price
      const priceEl = document.querySelector('[class*="price"]');
      const priceText = priceEl?.textContent || '';
      const priceMatch = priceText.match(/\$([0-9,]+)/);
      if (priceMatch) {
        data.price = parseInt(priceMatch[1].replace(/,/g, ''));
      }
      
      // Extract mileage/odometer
      const mileageEl = document.querySelector('[class*="mileage"], [class*="Mileage"]');
      const mileageText = mileageEl?.textContent || '';
      const mileageMatch = mileageText.match(/([0-9,]+)/);
      if (mileageMatch) {
        data.odometer = parseInt(mileageMatch[1].replace(/,/g, ''));
      }
      
      // Extract VIN
      const vinEl = Array.from(document.querySelectorAll('*')).find(el => 
        el.textContent?.includes('VIN')
      );
      if (vinEl) {
        const vinMatch = vinEl.textContent?.match(/VIN[:\s]+([A-HJ-NPR-Z0-9]{17})/i);
        if (vinMatch) {
          data.vin = vinMatch[1];
        }
      }
      
      // Extract stock number
      const stockEl = Array.from(document.querySelectorAll('*')).find(el => 
        el.textContent?.includes('Stock')
      );
      if (stockEl) {
        const stockMatch = stockEl.textContent?.match(/Stock[#:\s]+([A-Z0-9-]+)/i);
        if (stockMatch) {
          data.stockNumber = stockMatch[1];
        }
      }
      
      // Extract deal rating
      const dealEl = document.querySelector('[class*="Deal"], [class*="deal"]');
      if (dealEl) {
        const dealText = dealEl.textContent || '';
        if (dealText.includes('Great')) data.dealRating = 'Great Deal';
        else if (dealText.includes('Good')) data.dealRating = 'Good Deal';
        else if (dealText.includes('Fair')) data.dealRating = 'Fair Deal';
        else if (dealText.includes('High')) data.dealRating = 'High Price';
        else if (dealText.includes('Overpriced')) data.dealRating = 'Overpriced';
      }
      
      // Extract ALL images from gallery
      const images: string[] = [];
      
      // Strategy 1: Look for image thumbnails
      const thumbnails = document.querySelectorAll('img[src*="cargurus"], img[src*="photo"]');
      thumbnails.forEach((img) => {
        let src = img.getAttribute('src') || '';
        // Convert thumbnail to full size
        src = src.replace('_thumb', '').replace('_small', '').replace('_medium', '');
        if (src && !images.includes(src) && !src.includes('logo') && !src.includes('icon')) {
          images.push(src);
        }
      });
      
      // Strategy 2: Look for image elements in gallery
      const galleryImages = document.querySelectorAll('[class*="gallery"] img, [class*="photo"] img, [class*="image"] img');
      galleryImages.forEach((img) => {
        let src = img.getAttribute('src') || '';
        src = src.replace('_thumb', '').replace('_small', '').replace('_medium', '');
        if (src && !images.includes(src) && !src.includes('logo') && !src.includes('icon')) {
          images.push(src);
        }
      });
      
      // Strategy 3: Main image
      const mainImg = document.querySelector('img[class*="main"], img[class*="hero"]');
      if (mainImg) {
        let src = mainImg.getAttribute('src') || '';
        if (src && !images.includes(src) && !src.includes('logo') && !src.includes('icon')) {
          images.unshift(src); // Add to front
        }
      }
      
      data.images = images;
      
      // Extract description
      const descEl = document.querySelector('[class*="description"], [class*="Description"]');
      data.description = descEl?.textContent?.trim() || '';
      
      // Extract features for description
      const features: string[] = [];
      const featureEls = document.querySelectorAll('[class*="feature"], [class*="Feature"]');
      featureEls.forEach(el => {
        const text = el.textContent?.trim();
        if (text && text.length < 100) features.push(text);
      });
      if (features.length > 0) {
        data.description += '\n\nFeatures: ' + features.join(', ');
      }
      
      return data;
    });
    
    // Validate required fields
    if (!vehicleData.year || !vehicleData.make || !vehicleData.model || !vehicleData.price) {
      console.log(`  ⚠ Skipping incomplete listing: ${listingUrl}`);
      return null;
    }
    
    // Build complete vehicle object
    const vehicle: CarGurusVehicle = {
      year: vehicleData.year,
      make: vehicleData.make,
      model: vehicleData.model,
      trim: vehicleData.trim || 'Base',
      type: determineBodyType(vehicleData.description, vehicleData.model),
      price: vehicleData.price,
      odometer: vehicleData.odometer || 0,
      images: vehicleData.images || [],
      badges: detectBadges(vehicleData.description),
      location,
      dealership: dealershipName,
      dealershipId,
      description: vehicleData.description || `${vehicleData.year} ${vehicleData.make} ${vehicleData.model} ${vehicleData.trim}`,
      vin: vehicleData.vin,
      stockNumber: vehicleData.stockNumber,
      dealRating: vehicleData.dealRating,
      cargurusPrice: vehicleData.price,
      cargurusUrl: listingUrl
    };
    
    return vehicle;
    
  } catch (error) {
    console.error(`  ✗ Error scraping detail page ${listingUrl}:`, error);
    return null;
  }
}

async function scrapeCarGurusDealerPage(
  dealerUrl: string, 
  dealerName: string, 
  dealershipId: number,
  location: string
): Promise<CarGurusVehicle[]> {
  const chromiumPath = execSync('which chromium').toString().trim() || 
                       '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium';
  
  console.log(`Scraping CarGurus for ${dealerName}...`);
  
  const browser = await puppeteer.launch({
    executablePath: chromiumPath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });
  
  const vehicles: CarGurusVehicle[] = [];
  
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    await page.goto(dealerUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait for React app to render the listings
    // CarGurus uses React to dynamically load content - we need to wait for it
    console.log('  Waiting for React to render listings...');
    try {
      // Wait for specific text that only appears when listings are loaded
      await page.waitForFunction(
        () => {
          const bodyText = document.body.textContent || '';
          // Check if the page has loaded listing content (price, km, year patterns)
          return bodyText.includes('$') && 
                 bodyText.includes('km') && 
                 /\d{4}\s+(Toyota|Honda|Hyundai|Kia|Mazda|Nissan|Ford|Chevrolet|Dodge|GMC|RAM|Jeep|Chrysler|Buick|Cadillac|Lincoln|Volkswagen|Audi|BMW|Mercedes|Lexus|Tesla|Subaru|Mitsubishi|Acura|Infiniti)/i.test(bodyText);
        },
        { timeout: 20000 }
      );
      console.log('  ✓ React content loaded');
    } catch (e) {
      console.log(`  ⚠ Timeout waiting for listings to load for ${dealerName}`);
      await browser.close();
      return vehicles;
    }
    
    // Scroll to load all listings
    console.log('  Scrolling to load all listings...');
    let previousHeight = 0;
    for (let i = 0; i < 10; i++) {
      const currentHeight = await page.evaluate(() => document.body.scrollHeight);
      if (currentHeight === previousHeight) break;
      
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await new Promise(resolve => setTimeout(resolve, 1500));
      previousHeight = currentHeight;
    }
    
    // Extract all vehicle data directly from listing cards (no need to visit detail pages!)
    const extractedVehicles = await page.evaluate((dealerName, dealershipId, location) => {
      const results: any[] = [];
      
      // Find all listing cards - they contain most of the data we need
      const listings = document.querySelectorAll('[class*="listing"], article, [data-testid*="listing"]');
      
      listings.forEach(listing => {
        try {
          const text = listing.textContent || '';
          
          // Skip new vehicles - only scrape USED
          if (text.match(/\bnew\b/i) && !text.match(/\bused\b/i)) {
            // Check if this is explicitly a "New" vehicle (not just "new arrival")
            if (text.toLowerCase().includes('new vehicle') || text.toLowerCase().includes('brand new')) {
              return;
            }
          }
          
          // Extract year, make, model from the title
          const titleEl = listing.querySelector('h4, h3, h2, [class*="title"]');
          const title = titleEl?.textContent?.trim() || '';
          
          // Parse title like "2022 Toyota Corolla"
          const titleMatch = title.match(/(\d{4})\s+([A-Za-z-]+)\s+(.+)/);
          if (!titleMatch) return; // Skip if can't parse title
          
          const year = parseInt(titleMatch[1]);
          const make = titleMatch[2];
          const modelAndTrim = titleMatch[3];
          
          // Split model and trim
          const modelParts = modelAndTrim.split(/\s+/);
          const model = modelParts[0];
          const trim = modelParts.slice(1).join(' ') || 'Base';
          
          // Extract price
          const priceEl = listing.querySelector('[class*="price"]');
          const priceText = priceEl?.textContent || '';
          const priceMatch = priceText.match(/\$([0-9,]+)/);
          if (!priceMatch) return; // Skip if no price
          const price = parseInt(priceMatch[1].replace(/,/g, ''));
          
          // Extract mileage/km
          const mileageText = text;
          const mileageMatch = mileageText.match(/([0-9,]+)\s*km/i);
          const odometer = mileageMatch ? parseInt(mileageMatch[1].replace(/,/g, '')) : 0;
          
          // Extract deal rating
          let dealRating: string | undefined;
          if (text.includes('Great Deal')) dealRating = 'Great Deal';
          else if (text.includes('Good Deal')) dealRating = 'Good Deal';
          else if (text.includes('Fair Deal')) dealRating = 'Fair Deal';
          else if (text.includes('High Price')) dealRating = 'High Price';
          else if (text.includes('Overpriced')) dealRating = 'Overpriced';
          
          // Extract VIN and Stock Number
          const vinMatch = text.match(/VIN[:\s]+([A-HJ-NPR-Z0-9]{17})/i);
          const vin = vinMatch ? vinMatch[1] : undefined;
          
          const stockMatch = text.match(/Stock\s*#[:\s]*([A-Z0-9-]+)/i);
          const stockNumber = stockMatch ? stockMatch[1] : undefined;
          
          // Extract ALL images from the listing
          const images: string[] = [];
          const imgElements = listing.querySelectorAll('img');
          imgElements.forEach(img => {
            let src = img.getAttribute('src') || '';
            // Convert to full size image
            src = src.replace('_thumb', '').replace('_small', '').replace('_medium', '');
            // Add width/height parameters for better quality
            if (src && src.includes('homenetiol.com')) {
              // Remove existing params and add high-res params
              src = src.split('?')[0] + '?width=1280&height=960&fit=bounds&format=jpg';
            }
            if (src && !images.includes(src) && !src.includes('logo') && !src.includes('icon') && src.includes('http')) {
              images.push(src);
            }
          });
          
          // Extract listing URL
          const linkEl = listing.querySelector('a[href*="listing="]');
          const href = linkEl?.getAttribute('href') || '';
          const cargurusUrl = href.startsWith('http') ? href : 'https://www.cargurus.ca' + href;
          
          // Build description from available info
          let description = `${year} ${make} ${model} ${trim}`;
          
          // Extract features if available
          const features: string[] = [];
          const featureEls = listing.querySelectorAll('[class*="feature"]');
          featureEls.forEach(el => {
            const featureText = el.textContent?.trim();
            if (featureText && featureText.length < 100) {
              features.push(featureText);
            }
          });
          
          if (features.length > 0) {
            description += '. Features: ' + features.join(', ');
          }
          
          results.push({
            year,
            make,
            model,
            trim,
            price,
            odometer,
            images,
            dealRating,
            vin,
            stockNumber,
            cargurusUrl,
            description,
            dealership: dealerName,
            dealershipId,
            location
          });
          
        } catch (e) {
          console.error('Error parsing listing:', e);
        }
      });
      
      return results;
    }, dealerName, dealershipId, location);
    
    console.log(`  Found ${extractedVehicles.length} USED vehicle listings`);
    
    // Convert extracted data to CarGurusVehicle objects
    extractedVehicles.forEach((data: any) => {
      const vehicle: CarGurusVehicle = {
        year: data.year,
        make: data.make,
        model: data.model,
        trim: data.trim,
        type: determineBodyType(data.description, data.model),
        price: data.price,
        odometer: data.odometer,
        images: data.images,
        badges: detectBadges(data.description),
        location: data.location,
        dealership: data.dealership,
        dealershipId: data.dealershipId,
        description: data.description,
        vin: data.vin,
        stockNumber: data.stockNumber,
        dealRating: data.dealRating,
        cargurusPrice: data.price,
        cargurusUrl: data.cargurusUrl
      };
      
      vehicles.push(vehicle);
    });
    
    console.log(`  ✓ Successfully scraped ${vehicles.length} vehicles for ${dealerName}`);
    
  } finally {
    await browser.close();
  }
  
  return vehicles;
}

export async function scrapeAllCarGurusDealers(): Promise<CarGurusVehicle[]> {
  console.log('\n========================================');
  console.log('CARGURUS SCRAPER (PRIMARY DATA SOURCE)');
  console.log('========================================\n');
  
  const allVehicles: CarGurusVehicle[] = [];
  
  for (const dealer of DEALER_PAGES) {
    try {
      console.log(`\nProcessing dealership: ${dealer.name}`);
      const dealerVehicles = await scrapeCarGurusDealerPage(
        dealer.url,
        dealer.name,
        dealer.dealershipId,
        dealer.location
      );
      
      allVehicles.push(...dealerVehicles);
      
      // Delay between dealer pages
      await new Promise(resolve => setTimeout(resolve, 3000));
      
    } catch (error) {
      console.error(`✗ Error scraping ${dealer.name}:`, error);
    }
  }
  
  console.log(`\n✓ Total vehicles scraped from CarGurus: ${allVehicles.length}`);
  console.log(`  - Olympic Hyundai: ${allVehicles.filter(v => v.dealershipId === 1).length} vehicles`);
  console.log(`  - Boundary Hyundai: ${allVehicles.filter(v => v.dealershipId === 2).length} vehicles`);
  console.log(`  - Kia Vancouver: ${allVehicles.filter(v => v.dealershipId === 3).length} vehicles`);
  
  return allVehicles;
}
