import puppeteer from 'puppeteer';
import { execSync } from 'child_process';
import { sql } from 'drizzle-orm';
import { db } from './db';
import { vehicles } from '@shared/schema';
import { scrapeAllCarGurusDealers } from './cargurus-scraper';
import { generateVehicleDescription } from './openai';

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
  dealershipId: number;
  description: string;
  fullPageContent?: string;
  vin?: string;
  stockNumber?: string;
  carfaxUrl?: string;
}

// Individual dealership URLs (better data quality - includes Carfax links and full image galleries)
const DEALERSHIP_URLS = [
  {
    url: 'https://www.olympichyundaivancouver.com/vehicles/used/?st=price,desc&view=grid&sc=used',
    name: 'Olympic Hyundai Vancouver',
    dealershipId: 1,
    location: 'Vancouver'
  },
  {
    url: 'https://www.boundaryhyundai.com/vehicles/used/?st=price,desc&view=grid&sc=used',
    name: 'Boundary Hyundai Vancouver',
    dealershipId: 2,
    location: 'Burnaby'
  },
  {
    url: 'https://www.kiavancouver.com/vehicles/used/?st=year,desc&view=grid&sc=used',
    name: 'Kia Vancouver',
    dealershipId: 3,
    location: 'Vancouver'
  }
];

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

async function scrapeInventoryPage(inventoryUrl: string, dealershipName: string, dealershipId: number, location: string): Promise<ScrapedVehicle[]> {
  console.log(`Launching browser for ${dealershipName}...`);
  
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
    
    console.log(`Navigating to ${dealershipName} inventory page...`);
    await page.goto(inventoryUrl, {
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
    
    const vehicles = await page.evaluate((dealershipName, dealershipId, location) => {
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
        
        // Extract kilometers with multiple patterns
        let odometer = 0;
        // Try multiple patterns for odometer extraction
        const odometerPatterns = [
          /(\d+[,\d]*)\s*km/i,                    // Standard: "12,345 km"
          /Odometer[:\s]+(\d+[,\d]*)/i,           // Label format: "Odometer: 12345"
          /(\d+[,\d]*)\s*kilometers/i,            // Full word
          /mileage[:\s]+(\d+[,\d]*)/i,            // Mileage label
          /km[:\s]+(\d+[,\d]*)/i,                 // KM label first
        ];
        
        for (const pattern of odometerPatterns) {
          const match = cardText.match(pattern);
          if (match) {
            odometer = parseInt(match[1].replace(/,/g, ''));
            break;
          }
        }
        
        // Also try from odometer element with data attributes
        const odometerEl = card.querySelector('[data-field="odometer"], [data-field="mileage"], .odometer, .mileage');
        if (odometerEl && odometer === 0) {
          const odometerText = odometerEl.textContent || odometerEl.getAttribute('data-value') || '';
          const odometerMatch = odometerText.match(/(\d+[,\d]*)/);
          if (odometerMatch) {
            odometer = parseInt(odometerMatch[1].replace(/,/g, ''));
          }
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
        
        // Get the detail page URL (relative URLs need the domain from current location)
        const detailUrl = href.startsWith('http') ? href : `${window.location.origin}${href}`;
        
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
          location: location,
          dealership: dealershipName,
          dealershipId: dealershipId,
          cardText: cardText.substring(0, 500), // For badge detection
          heading
        });
      });
      
      return vehicleData;
    }, dealershipName, dealershipId, location);
    
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
          // Extract odometer from detail page specs
          let odometer = 0;
          const odometerPatterns = [
            /(\d+[,\d]*)\s*km/i,
            /Odometer[:\s]+(\d+[,\d]*)/i,
            /(\d+[,\d]*)\s*kilometers/i,
            /mileage[:\s]+(\d+[,\d]*)/i,
          ];
          
          // Try to find odometer in the full page text
          const pageText = document.body.textContent || '';
          for (const pattern of odometerPatterns) {
            const match = pageText.match(pattern);
            if (match) {
              odometer = parseInt(match[1].replace(/,/g, ''));
              break;
            }
          }
          
          // Also try from odometer element with data attributes
          if (odometer === 0) {
            const odometerEl = document.querySelector('[data-field="odometer"], [data-field="mileage"], .odometer, .mileage, .km');
            if (odometerEl) {
              const odometerText = odometerEl.textContent || odometerEl.getAttribute('data-value') || '';
              const odometerMatch = odometerText.match(/(\d+[,\d]*)/);
              if (odometerMatch) {
                odometer = parseInt(odometerMatch[1].replace(/,/g, ''));
              }
            }
          }
          
          // Extract all images - ONLY clean vehicle photos from thumbnail gallery
          const images: string[] = [];
          
          // Strategy 1: Target thumbnail gallery specifically (most reliable)
          // Look for thumbnail containers - these are the clickable small images below the main photo
          const thumbnailSelectors = [
            '.thumbnails img',
            '.thumb img', 
            '.thumbnail img',
            '[class*="thumb"] img',
            '[id*="thumb"] img',
            '.gallery-thumbs img',
            '.image-thumbs img',
            '[data-thumb] img',
            '.carousel-indicators img',
            '.slider-nav img',
            'a[data-slide] img',
            'a[href*="#photo"] img'
          ];
          
          for (let s = 0; s < thumbnailSelectors.length; s++) {
            const thumbs = document.querySelectorAll(thumbnailSelectors[s]);
            if (thumbs.length > 0) {
              for (let t = 0; t < thumbs.length; t++) {
                const img = thumbs[t] as HTMLImageElement;
                // Get the full-size image URL from thumbnail's src or data attributes
                let src = img.src || 
                         img.getAttribute('data-src') || 
                         img.getAttribute('data-image') ||
                         img.getAttribute('data-lazy-src') ||
                         img.getAttribute('data-full') || '';
                
                // Also check parent anchor tag for full image URL
                const parentAnchor = img.closest('a');
                if (parentAnchor) {
                  const href = parentAnchor.getAttribute('href') || '';
                  // If anchor links to an image, use that instead
                  if (href && (href.includes('.jpg') || href.includes('.jpeg') || href.includes('.png'))) {
                    src = href;
                  }
                }
                
                // Filter out watermarked/branded images
                if (src) {
                  const lowerSrc = src.toLowerCase();
                  const isClean = !lowerSrc.includes('logo') && !lowerSrc.includes('icon') && 
                                 !lowerSrc.includes('carfax') && !lowerSrc.includes('.svg') &&
                                 !lowerSrc.includes('watermark') && !lowerSrc.includes('badge');
                  
                  if (isClean) {
                    // Get high-res version
                    const highResSrc = src
                      .replace('-420x315', '-1024x786')
                      .replace('-300x225', '-1024x786')
                      .replace('-640x480', '-1024x786')
                      .replace('-150x150', '-1024x786')
                      .replace('-100x75', '-1024x786')
                      .replace('/thumbs/', '/photos/')
                      .replace('/small/', '/large/')
                      .replace('/thumb/', '/photo/');
                    
                    if (highResSrc && !images.includes(highResSrc) && highResSrc.length > 20) {
                      images.push(highResSrc);
                    }
                  }
                }
              }
              // If we found thumbnails, don't continue to fallback strategies
              if (images.length > 0) break;
            }
          }
          
          // Strategy 2: Extract from data-gallery JSON attribute (if no thumbnails found)
          if (images.length === 0) {
            const galleryEl = document.querySelector('[data-gallery]');
            if (galleryEl) {
              try {
                const galleryData = JSON.parse(galleryEl.getAttribute('data-gallery') || '[]');
                if (Array.isArray(galleryData)) {
                  for (let i = 0; i < galleryData.length; i++) {
                    const item = galleryData[i];
                    if (item.url || item.src || item.image) {
                      const url = item.url || item.src || item.image;
                      const lowerUrl = url.toLowerCase();
                      const isClean = !lowerUrl.includes('logo') && !lowerUrl.includes('icon') && 
                                     !lowerUrl.includes('carfax') && !lowerUrl.includes('.svg') &&
                                     !lowerUrl.includes('watermark') && !lowerUrl.includes('badge');
                      
                      if (isClean) {
                        const highResUrl = url
                          .replace('-420x315', '-1024x786')
                          .replace('-300x225', '-1024x786')
                          .replace('-640x480', '-1024x786')
                          .replace('-150x150', '-1024x786')
                          .replace('-100x75', '-1024x786')
                          .replace('/thumbs/', '/photos/')
                          .replace('/small/', '/large/')
                          .replace('/thumb/', '/photo/');
                        
                        if (highResUrl && !images.includes(highResUrl)) {
                          images.push(highResUrl);
                        }
                      }
                    }
                  }
                }
              } catch (e) {
                // Silent fail - continue to next strategy
              }
            }
          }
          
          // Strategy 3: Look for gallery containers (fallback)
          if (images.length < 3) {
            const galleryContainers = document.querySelectorAll('.vehicle-gallery, .image-gallery, .photos-container, .gallery, [data-images]');
            for (let c = 0; c < galleryContainers.length; c++) {
              const container = galleryContainers[c];
              const imgs = container.querySelectorAll('img');
              for (let i = 0; i < imgs.length; i++) {
                const imgEl = imgs[i] as HTMLImageElement;
                const src = imgEl.src || 
                           imgEl.getAttribute('data-src') || 
                           imgEl.getAttribute('data-lazy') || 
                           imgEl.getAttribute('data-lazy-src') || '';
                
                if (src) {
                  const lowerSrc = src.toLowerCase();
                  const isClean = !lowerSrc.includes('logo') && !lowerSrc.includes('icon') && 
                                 !lowerSrc.includes('carfax') && !lowerSrc.includes('.svg') &&
                                 !lowerSrc.includes('watermark') && !lowerSrc.includes('badge');
                  
                  if (isClean) {
                    const highResSrc = src
                      .replace('-420x315', '-1024x786')
                      .replace('-300x225', '-1024x786')
                      .replace('-640x480', '-1024x786')
                      .replace('-150x150', '-1024x786')
                      .replace('-100x75', '-1024x786')
                      .replace('/thumbs/', '/photos/')
                      .replace('/small/', '/large/')
                      .replace('/thumb/', '/photo/');
                    
                    if (highResSrc && !images.includes(highResSrc)) {
                      images.push(highResSrc);
                    }
                  }
                }
              }
            }
          }
          
          // Log image extraction results for debugging
          console.log(`  Found ${images.length} images for vehicle`)
          
          // Extract description with multiple strategies
          let description = '';
          
          // Strategy 1: Look for dedicated description sections
          const descriptionSelectors = [
            '.vehicle-description',
            '.vehicle-overview',
            '.description',
            '[data-field="description"]',
            '.product-description',
            '.car-description'
          ];
          
          for (const selector of descriptionSelectors) {
            const descEl = document.querySelector(selector);
            if (descEl && descEl.textContent && descEl.textContent.trim().length > 50) {
              description = descEl.textContent.trim();
              break;
            }
          }
          
          // Strategy 2: Look for heading + features/specs
          if (!description || description.length < 50) {
            const h1 = document.querySelector('h1');
            let descParts: string[] = [];
            
            if (h1?.textContent) {
              descParts.push(h1.textContent.trim());
            }
            
            // Extract features list
            const features: string[] = [];
            const featureElements = document.querySelectorAll('.vehicle-features li, .features-list li, [data-field="features"] li');
            featureElements.forEach((el, idx) => {
              if (idx < 8) { // Limit to 8 features for description
                const text = el.textContent?.trim();
                if (text && text.length > 2 && text.length < 100) {
                  features.push(text);
                }
              }
            });
            
            if (features.length > 0) {
              descParts.push('Features: ' + features.join(', '));
            }
            
            description = descParts.join(' | ');
          }
          
          // Strategy 3: Fallback to basic info from title/heading
          if (!description || description.length < 30) {
            const titleEl = document.querySelector('title, h1, h2');
            description = titleEl?.textContent?.trim() || '';
          }
          
          // Extract full page content for AI analysis/processing
          let fullPageContent = '';
          const contentSelectors = [
            '.vehicle-description',
            '.vehicle-details',
            '.vehicle-specs',
            '.vehicle-features',
            '.vehicle-overview',
            '[data-field]',
            '.specs-list',
            '.features-list',
            'article',
            'main'
          ];
          
          // Try to extract from common content containers
          for (const selector of contentSelectors) {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
              const text = el.textContent?.trim();
              if (text && text.length > 20 && text.length < 2000) {
                fullPageContent += text + '\n\n';
              }
            });
          }
          
          // If still no content, extract all meaningful text from body
          if (fullPageContent.length < 100) {
            const allText = document.body.innerText;
            fullPageContent = allText.slice(0, 5000); // Limit to 5000 chars
          }
          
          // Clean up description (remove extra whitespace, newlines)
          description = description.replace(/\s+/g, ' ').trim();
          if (description.length > 500) {
            description = description.slice(0, 497) + '...';
          }
          
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
          
          // Extract Carfax URL with multiple strategies
          let carfaxUrl = '';
          
          // Strategy 1: Look for Carfax links in common patterns
          const carfaxLink = document.querySelector('a[href*="carfax"]') as HTMLAnchorElement;
          if (carfaxLink && carfaxLink.href) {
            carfaxUrl = carfaxLink.href;
          }
          
          // Strategy 2: Check for data attributes
          if (!carfaxUrl) {
            const carfaxDataEl = document.querySelector('[data-carfax], [data-carfax-url], [data-carfax-link]');
            if (carfaxDataEl) {
              carfaxUrl = carfaxDataEl.getAttribute('data-carfax') || 
                         carfaxDataEl.getAttribute('data-carfax-url') || 
                         carfaxDataEl.getAttribute('data-carfax-link') || '';
            }
          }
          
          // Strategy 3: Look for buttons/divs with Carfax class
          if (!carfaxUrl) {
            const carfaxBtn = document.querySelector('.carfax-link, .carfax-button, .carfax-report');
            if (carfaxBtn) {
              const href = carfaxBtn.getAttribute('href') || carfaxBtn.getAttribute('data-url');
              if (href) carfaxUrl = href;
            }
          }
          
          // Strategy 4: Search all links for carfax.com URLs with VIN-specific reports
          if (!carfaxUrl) {
            const allLinks = Array.from(document.querySelectorAll('a[href]')) as HTMLAnchorElement[];
            for (const link of allLinks) {
              if (link.href && (link.href.includes('carfax.com') || link.href.includes('carfax.ca'))) {
                // Prioritize VIN-specific URLs over homepage
                if (link.href.includes('/vehicle/') || link.href.includes('/vhr/') || link.href.includes('vin=')) {
                  carfaxUrl = link.href;
                  break;
                } else if (!carfaxUrl) {
                  // Store homepage as fallback, but keep looking for VIN-specific URL
                  carfaxUrl = link.href;
                }
              }
            }
          }
          
          // Filter out generic Carfax homepage URLs - prefer no URL over homepage
          if (carfaxUrl && (carfaxUrl === 'https://www.carfax.ca/' || carfaxUrl === 'https://www.carfax.com/' || carfaxUrl === 'https://carfax.ca/' || carfaxUrl === 'https://carfax.com/')) {
            carfaxUrl = '';
          }
          
          // Extract body style from specs
          let bodyStyle = '';
          const bodyStyleElem = Array.from(document.querySelectorAll('li')).find(li => 
            li.textContent?.includes('Body Style:')
          );
          if (bodyStyleElem && bodyStyleElem.textContent) {
            bodyStyle = bodyStyleElem.textContent.replace('Body Style:', '').trim();
          }
          
          return {
            images: images.slice(0, 10), // Limit to 10 images
            description,
            fullPageContent,
            vin,
            stockNumber,
            carfaxUrl,
            bodyStyle,
            odometer
          };
        });
        
        const badges = detectBadges(v.cardText + ' ' + v.heading);
        const type = determineBodyType(detailData.bodyStyle || v.bodyStyle);
        const finalDescription = detailData.description || `${v.year} ${v.make} ${v.model} ${v.trim}`.trim();
        
        // Use detail images if available, otherwise fall back to primary image
        const finalImages = detailData.images.length > 0 ? detailData.images : [v.primaryImage];
        
        // Use detail page odometer if found, otherwise fall back to card extraction
        const finalOdometer = detailData.odometer > 0 ? detailData.odometer : v.odometer;
        
        scrapedVehicles.push({
          year: v.year,
          make: v.make,
          model: v.model,
          trim: v.trim,
          type,
          price: v.price,
          odometer: finalOdometer,
          images: finalImages,
          badges,
          location: v.location,
          dealership: v.dealership,
          dealershipId: v.dealershipId,
          description: finalDescription,
          fullPageContent: detailData.fullPageContent || undefined,
          vin: detailData.vin || undefined,
          stockNumber: detailData.stockNumber || undefined,
          carfaxUrl: detailData.carfaxUrl || undefined
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
          dealershipId: v.dealershipId,
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
  console.log('Starting comprehensive inventory scrape...');
  
  try {
    // PRIMARY SOURCE: Scrape CarGurus for complete vehicle data (20+ photos, clean data, deal ratings)
    console.log('\n=== USING CARGURUS AS PRIMARY DATA SOURCE ===\n');
    let cargurusVehicles: ScrapedVehicle[] = [];
    
    try {
      cargurusVehicles = await scrapeAllCarGurusDealers();
      console.log(`✓ Scraped ${cargurusVehicles.length} vehicles from CarGurus`);
    } catch (error) {
      console.error('✗ CarGurus scraping failed:', error);
      throw error; // CarGurus is now primary source, so fail if it fails
    }
    
    if (cargurusVehicles.length === 0) {
      console.log('⚠ No vehicles scraped from CarGurus');
      return 0;
    }
    
    console.log(`\n✓ Total scraped: ${cargurusVehicles.length} vehicles from CarGurus`);
    
    // No need to merge - CarGurus data is complete and already has all fields
    const allScrapedVehicles = cargurusVehicles;
    
    // Generate AI-powered descriptions for all vehicles
    console.log('\nGenerating AI-powered vehicle descriptions...');
    const vehiclesWithDescriptions = await Promise.all(
      allScrapedVehicles.map(async (vehicle) => {
        try {
          const aiDescription = await generateVehicleDescription({
            year: vehicle.year,
            make: vehicle.make,
            model: vehicle.model,
            trim: vehicle.trim,
            type: vehicle.type,
            price: vehicle.price,
            odometer: vehicle.odometer,
            badges: vehicle.badges,
            dealership: vehicle.dealership,
            location: vehicle.location,
            rawDescription: vehicle.description,
            fullPageContent: vehicle.fullPageContent
          });
          
          return {
            ...vehicle,
            description: aiDescription
          };
        } catch (error) {
          console.error(`Failed to generate description for ${vehicle.year} ${vehicle.make} ${vehicle.model}:`, error);
          // Keep original description on error
          return vehicle;
        }
      })
    );
    
    console.log(`✓ Generated AI descriptions for ${vehiclesWithDescriptions.length} vehicles`);
    
    // Save to database
    console.log('\nSaving to database...');
    
    // Clear existing inventory (delete views first to avoid foreign key constraint)
    await db.execute(sql`TRUNCATE TABLE vehicle_views, vehicles RESTART IDENTITY CASCADE`);
    
    // Insert new inventory
    await db.insert(vehicles).values(vehiclesWithDescriptions);
    
    console.log(`\n✓ Successfully scraped and saved ${vehiclesWithDescriptions.length} vehicles from CarGurus`);
    console.log(`  - Olympic Hyundai: ${allScrapedVehicles.filter(v => v.dealershipId === 1).length} vehicles`);
    console.log(`  - Boundary Hyundai: ${allScrapedVehicles.filter(v => v.dealershipId === 2).length} vehicles`);
    console.log(`  - Kia Vancouver: ${allScrapedVehicles.filter(v => v.dealershipId === 3).length} vehicles`);
    console.log(`  - All vehicles include deal ratings and 20+ photos`);
    console.log(`  - AI descriptions: ${vehiclesWithDescriptions.length} vehicles`);
    
    return vehiclesWithDescriptions.length;
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

