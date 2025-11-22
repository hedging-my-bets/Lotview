import puppeteer from 'puppeteer';
import { execSync } from 'child_process';

// CarGurus dealer page URLs for the three dealerships
const DEALER_PAGES = [
  {
    name: 'Olympic Hyundai Vancouver',
    url: 'https://www.cargurus.ca/Cars/m-Olympic-Hyundai-Vancouver-sp459833'
  },
  {
    name: 'Boundary Hyundai Vancouver',
    url: 'https://www.cargurus.ca/Cars/m-Boundary-Hyundai-sp393663'
  },
  {
    name: 'Kia Vancouver',
    url: 'https://www.cargurus.ca/Cars/m-Kia-Vancouver-sp357122'
  }
];

interface CarGurusListing {
  vin?: string;
  price?: number;
  dealRating?: string; // "Great Deal", "Good Deal", etc.
  cargurusPrice?: number;
  cargurusUrl?: string;
}

async function scrapeCarGurusDealerPage(dealerUrl: string, dealerName: string): Promise<Map<string, CarGurusListing>> {
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
  
  const page = await browser.newPage();
  const listings = new Map<string, CarGurusListing>();
  
  try {
    await page.goto(dealerUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait for listings to load
    try {
      await page.waitForSelector('a[href*="/Cars/"], .result-tile', { timeout: 10000 });
    } catch (e) {
      console.log(`  No listings found for ${dealerName}`);
      return listings;
    }
    
    // Scroll to load all listings
    let previousHeight = 0;
    for (let i = 0; i < 5; i++) {
      const currentHeight = await page.evaluate(() => document.body.scrollHeight);
      if (currentHeight === previousHeight) break;
      
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await new Promise(resolve => setTimeout(resolve, 1000));
      previousHeight = currentHeight;
    }
    
    // Extract listing data
    const scrapedListings = await page.evaluate(() => {
      const results: any[] = [];
      
      // Find all listing cards (CarGurus uses different selectors)
      const listingElements = document.querySelectorAll('[data-cg-vin], a[href*="listing="]');
      
      listingElements.forEach((element) => {
        try {
          // Extract VIN from data attribute or link
          let vin = element.getAttribute('data-cg-vin');
          
          if (!vin) {
            // Try to find VIN in the listing text
            const textContent = element.textContent || '';
            const vinMatch = textContent.match(/VIN[:\s]+([A-HJ-NPR-Z0-9]{17})/i);
            if (vinMatch) vin = vinMatch[1];
          }
          
          if (!vin) return; // Skip if no VIN found
          
          // Extract price
          let price: number | undefined;
          const priceEl = element.querySelector('[data-testid="price"], .price, .deal-price');
          if (priceEl) {
            const priceText = priceEl.textContent || '';
            const priceMatch = priceText.match(/\$([0-9,]+)/);
            if (priceMatch) {
              price = parseInt(priceMatch[1].replace(/,/g, ''));
            }
          }
          
          // Extract deal rating
          let dealRating: string | undefined;
          const ratingEl = element.querySelector('[class*="deal"], [class*="rating"]');
          if (ratingEl) {
            const ratingText = ratingEl.textContent || '';
            if (ratingText.includes('Great')) dealRating = 'Great Deal';
            else if (ratingText.includes('Good')) dealRating = 'Good Deal';
            else if (ratingText.includes('Fair')) dealRating = 'Fair Deal';
            else if (ratingText.includes('High')) dealRating = 'High Price';
            else if (ratingText.includes('Overpriced')) dealRating = 'Overpriced';
          }
          
          // Extract listing URL
          let url: string | undefined;
          if (element.tagName === 'A') {
            url = element.getAttribute('href') || undefined;
            if (url && !url.startsWith('http')) {
              url = 'https://www.cargurus.ca' + url;
            }
          } else {
            const linkEl = element.querySelector('a[href*="listing="]');
            if (linkEl) {
              url = linkEl.getAttribute('href') || undefined;
              if (url && !url.startsWith('http')) {
                url = 'https://www.cargurus.ca' + url;
              }
            }
          }
          
          results.push({
            vin,
            price,
            dealRating,
            url
          });
        } catch (e) {
          console.error('Error extracting listing:', e);
        }
      });
      
      return results;
    });
    
    // Convert to Map keyed by normalized VIN
    scrapedListings.forEach((listing: any) => {
      if (listing.vin) {
        // Normalize VIN: trim and uppercase for better matching
        const normalizedVin = listing.vin.trim().toUpperCase();
        listings.set(normalizedVin, {
          vin: normalizedVin,
          price: listing.price,
          cargurusPrice: listing.price,
          dealRating: listing.dealRating,
          cargurusUrl: listing.url
        });
      }
    });
    
    console.log(`  Found ${listings.size} listings with VINs for ${dealerName}`);
    
  } finally {
    await browser.close();
  }
  
  return listings;
}

export async function scrapeAllCarGurusDealers(): Promise<Map<string, CarGurusListing>> {
  console.log('Starting CarGurus scrape for all dealerships...');
  
  const allListings = new Map<string, CarGurusListing>();
  
  for (const dealer of DEALER_PAGES) {
    try {
      const dealerListings = await scrapeCarGurusDealerPage(dealer.url, dealer.name);
      
      // Merge into main map
      dealerListings.forEach((listing, vin) => {
        allListings.set(vin, listing);
      });
      
      // Delay between dealer pages
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error(`Error scraping ${dealer.name}:`, error);
    }
  }
  
  console.log(`Total CarGurus listings with VINs: ${allListings.size}`);
  return allListings;
}
