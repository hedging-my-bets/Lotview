import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { execSync } from 'child_process';
import { cookieStore } from './cloudflare-bypass/cookie-store';
import { proxyManager } from './cloudflare-bypass/proxy-manager';
import { generateRandomFingerprint, applyFingerprint, randomDelay, isCloudflareChallenge, humanLikeScroll } from './cloudflare-bypass/browser-utils';

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

// Scrape VDP using an existing page (reuses page instead of creating new ones)
async function scrapeVehicleDetailPage(page: any, vdpUrl: string, retries = 2): Promise<VehicleDetailData> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Navigate to VDP using existing page
      await page.goto(vdpUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
      
      // Wait for the page to be fully interactive
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Check for Cloudflare challenge on VDP page
      const isChallenged = await isCloudflareChallenge(page);
      if (isChallenged) {
        console.log('    ⚠ Cloudflare challenge on VDP, waiting...');
        // Wait for challenge to resolve
        for (let i = 0; i < 15; i++) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          if (!(await isCloudflareChallenge(page))) {
            console.log('    ✓ VDP challenge resolved');
            break;
          }
        }
      }
      
      // Wait for dynamic content to render
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Debug: Log that we're about to extract data
      const pageUrl = await page.url();
      console.log(`    → VDP loaded: ${pageUrl}`);
      
      // Use page.evaluate with a string to prevent ESBuild transformation
      const data = await page.evaluate(`(function() {
        var pageText = document.body.textContent || '';
        
        function isPaymentContext(element) {
          var paymentKeywords = /payment|weekly|bi-?weekly|monthly|calculator|financing|finance|per\\s+month|\\/mo/i;
          var elementText = element.textContent || '';
          if (paymentKeywords.test(elementText)) return true;
          var elementClass = element.getAttribute('class') || '';
          var elementId = element.getAttribute('id') || '';
          if (paymentKeywords.test(elementClass) || paymentKeywords.test(elementId)) return true;
          var parent = element.parentElement;
          if (parent) {
            var parentClass = parent.getAttribute('class') || '';
            var parentId = parent.getAttribute('id') || '';
            if (paymentKeywords.test(parentClass) || paymentKeywords.test(parentId)) return true;
          }
          return false;
        }
        
        var pageTitle = document.title || 'No title';
        var bodyLength = pageText.length;
        var priceElExists = document.querySelector('.vehicle-price') ? 'yes' : 'no';
        var allImgs = document.querySelectorAll('img').length;
        var allPriceElements = document.querySelectorAll('[class*="price"]').length;
        
        // Extract VIN (no TypeScript annotations)
        var vin = null;
        var vinMatch = pageText.match(/VIN[:\\s]*([A-HJ-NPR-Z0-9]{17})/i);
        if (vinMatch) {
          vin = vinMatch[1].toUpperCase();
        }
        
        // Extract Stock Number
        var stockNumber = null;
        var stockMatch = pageText.match(/stock[#\\s:]*([A-Z0-9-]+)/i);
        if (stockMatch) {
          stockNumber = stockMatch[1];
        }
        
        // Extract price - target the actual selling price with high confidence
        var price = null;
        var priceConfidence = 'low';
        var priceSource = 'none';
        
        // Strategy 1: Target authoritative DOM nodes with dealer-specific selectors
        // NOTE: Avoid overly generic selectors like [id*="price"] that match financing widgets
        // IMPORTANT: Order matters - more specific selectors first
        var authoritativePriceSelectors = [
          // Olympic Hyundai Vancouver specific - the main selling price
          '.price-block__price--primary',
          '.price-block__price',
          '.main-price',
          // Standard dealer website patterns
          '[data-field="price"]',
          '[data-field="sellingPrice"]',
          '[data-price]',
          '[itemprop="price"]',
          '.vehicle-price__price',
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
        
        for (var pi = 0; pi < authoritativePriceSelectors.length; pi++) {
          var priceSelector = authoritativePriceSelectors[pi];
          var priceEl = document.querySelector(priceSelector);
          if (priceEl) {
            // CRITICAL: Use payment context helper to reject payment widgets
            if (!isPaymentContext(priceEl)) {
              var priceText = priceEl.textContent || priceEl.getAttribute('data-value') || priceEl.getAttribute('data-price') || '';
              var priceMatchResult = priceText.match(/\\$?\\s*([0-9,]+)/);
              if (priceMatchResult) {
                var priceVal = parseInt(priceMatchResult[1].replace(/,/g, ''));
                // Realistic minimum: $1000 (excludes payment amounts like $399)
                if (priceVal >= 1000 && priceVal <= 500000) {
                  price = priceVal;
                  priceConfidence = 'high';
                  priceSource = priceSelector;
                  break; // Use first valid CASH price from authoritative selector
                }
                // Note: Values below $1000 are ignored as likely payment amounts
              }
            }
          }
        }
        
        // Strategy 2: Scoped regex with label anchoring (high confidence)
        if (!price) {
          var labeledPricePatterns = [
            /(?:Sale|Selling|Asking|Dealer|Final|Internet)\\s*Price[:\\s]*\\$?\\s*([0-9,]+)/i,
            /Price[:\\s]*\\$?\\s*([0-9,]+)(?!\\s*(?:weekly|monthly|payment))/i,
            /\\$\\s*([0-9,]+)\\s*(?:CAD|CDN|Canadian)?(?!\\s*(?:weekly|monthly|payment|per))/i
          ];
          
          for (var lpi = 0; lpi < labeledPricePatterns.length; lpi++) {
            var pattern = labeledPricePatterns[lpi];
            var labeledMatch = pageText.match(pattern);
            if (labeledMatch) {
              var labeledVal = parseInt(labeledMatch[1].replace(/,/g, ''));
              // Realistic minimum: $1000 (excludes typical payment amounts)
              if (labeledVal >= 1000 && labeledVal <= 500000) {
                price = labeledVal;
                priceConfidence = 'medium';
                priceSource = 'labeled-pattern';
                break;
              }
              // Note: Values below $1000 are ignored as likely payment amounts
            }
          }
        }
        
        // Strategy 3: Last resort - scan all prices, use median (avoid both payments and MSRP)
        // NOTE: This is unreliable and may be removed in future
        if (!price) {
          var priceRegex = /\\$\\s*([0-9,]+)(?!\\s*(?:weekly|bi-?weekly|monthly|per\\s+month|\\/mo|payment))/gi;
          var priceMatch2;
          var prices = [];
          
          while ((priceMatch2 = priceRegex.exec(pageText)) !== null) {
            var val = parseInt(priceMatch2[1].replace(/,/g, ''));
            // Minimum $2000 for fallback strategy (more conservative but still captures low-end inventory)
            if (val >= 2000 && val <= 500000) {
              prices.push(val);
            }
          }
          
          // Use MEDIAN price (more robust than min/max)
          if (prices.length >= 2) {
            prices.sort(function(a, b) { return a - b; });
            var mid = Math.floor(prices.length / 2);
            price = prices.length % 2 === 0 ? prices[mid - 1] : prices[mid];
            priceConfidence = 'low';
          } else if (prices.length === 1) {
            price = prices[0];
            priceConfidence = 'low';
          }
          // Note: Low confidence prices are still used but should be validated
        }
        
        // Extract odometer
        var odometer = null;
        var odoMatch = pageText.match(/([0-9,]+)\\s*(km|kilometers?)/i);
        if (odoMatch) {
          var odoVal = parseInt(odoMatch[1].replace(/,/g, ''));
          if (odoVal > 0 && odoVal < 500000) {
            odometer = odoVal;
          }
        }
        
        // Extract trim from title/heading
        var trim = 'Base';
        var h1El = document.querySelector('h1');
        if (h1El) {
          var titleText = h1El.textContent || '';
          // Try to extract trim from title (usually after model name)
          var trimMatch = titleText.match(/(?:\\d{4}\\s+[A-Za-z-]+\\s+[A-Za-z0-9-]+\\s+)([A-Za-z0-9\\s]+)/i);
          if (trimMatch && trimMatch[1]) {
            trim = trimMatch[1].trim();
          }
        }
        
        // Extract description
        var description = '';
        var descriptionSelectors = [
          '[class*="description"]',
          '[class*="details"]',
          '[class*="comments"]',
          'p[class*="text"]',
          '.vehicle-description',
          '#description'
        ];
        
        for (var di = 0; di < descriptionSelectors.length; di++) {
          var descSelector = descriptionSelectors[di];
          var descElement = document.querySelector(descSelector);
          if (descElement && descElement.textContent && descElement.textContent.length > 50) {
            description = descElement.textContent.trim();
            break;
          }
        }
        
        // If no description found, create a basic one
        if (!description) {
          description = 'Used vehicle. Contact dealer for more information.';
        }
        
        // Extract images from multiple sources - AGGRESSIVE APPROACH
        var images = [];
        var processedUrls = {};
        var debugImgInfo = [];
        
        // Helper function to check if URL is a valid vehicle image
        function isVehicleImage(src) {
          if (!src || src.length < 10) return false;
          var lower = src.toLowerCase();
          // Skip obvious non-vehicle images
          if (lower.indexOf('placeholder') !== -1) return false;
          if (lower.indexOf('logo') !== -1) return false;
          if (lower.indexOf('icon') !== -1) return false;
          if (lower.indexOf('avatar') !== -1) return false;
          if (lower.indexOf('spinner') !== -1) return false;
          if (lower.indexOf('loading') !== -1) return false;
          if (lower.indexOf('blank') !== -1) return false;
          if (lower.indexOf('pixel') !== -1) return false;
          if (lower.indexOf('.svg') !== -1) return false;
          if (lower.indexOf('.gif') !== -1 && lower.indexOf('loading') !== -1) return false;
          if (lower.indexOf('data:image') === 0 && lower.length < 200) return false; // Skip tiny base64
          // Must be a proper image URL
          return (src.indexOf('http') === 0 || src.indexOf('//') === 0 || src.indexOf('/') === 0);
        }
        
        // Helper function to normalize URL
        function normalizeUrl(src) {
          if (src.indexOf('//') === 0) {
            return 'https:' + src;
          } else if (src.indexOf('/') === 0) {
            return window.location.origin + src;
          }
          return src;
        }
        
        // Strategy 1: Get ALL images on the page and filter
        var allImgElements = document.querySelectorAll('img');
        debugImgInfo.push('Total img tags: ' + allImgElements.length);
        
        for (var i = 0; i < allImgElements.length; i++) {
          var img = allImgElements[i];
          // Check multiple attributes for the actual image URL
          var possibleSrcs = [
            img.getAttribute('src'),
            img.getAttribute('data-src'),
            img.getAttribute('data-lazy-src'),
            img.getAttribute('data-original'),
            img.getAttribute('data-image'),
            img.getAttribute('data-full-size'),
            img.getAttribute('data-large'),
            img.currentSrc // What the browser actually loaded
          ];
          
          // Also check srcset for high-quality images
          var srcset = img.getAttribute('srcset') || '';
          if (srcset) {
            var srcsetParts = srcset.split(',');
            for (var sp = 0; sp < srcsetParts.length; sp++) {
              var part = srcsetParts[sp].trim().split(' ')[0];
              if (part) possibleSrcs.push(part);
            }
          }
          
          for (var ps = 0; ps < possibleSrcs.length; ps++) {
            var src = possibleSrcs[ps];
            if (src && isVehicleImage(src)) {
              src = normalizeUrl(src);
              if (src.indexOf('http') === 0 && !processedUrls[src]) {
                // Additional size checks - prefer larger images
                var imgWidth = img.naturalWidth || img.width || 0;
                var imgHeight = img.naturalHeight || img.height || 0;
                // Skip tiny images (likely thumbnails or icons)
                if (imgWidth > 50 || imgHeight > 50 || imgWidth === 0) {
                  processedUrls[src] = true;
                  images.push(src);
                }
              }
            }
          }
        }
        
        debugImgInfo.push('Images from img tags: ' + images.length);
        
        // Strategy 2: Look for background images in style attributes
        var elementsWithBg = document.querySelectorAll('[style*="background"]');
        for (var bi = 0; bi < elementsWithBg.length; bi++) {
          var el = elementsWithBg[bi];
          var style = el.getAttribute('style') || '';
          var bgMatch = style.match(/url\\s*\\(\\s*['"]?([^'"\\)]+)['"]?\\s*\\)/i);
          if (bgMatch && bgMatch[1]) {
            var bgSrc = bgMatch[1];
            if (isVehicleImage(bgSrc)) {
              bgSrc = normalizeUrl(bgSrc);
              if (bgSrc.indexOf('http') === 0 && !processedUrls[bgSrc]) {
                processedUrls[bgSrc] = true;
                images.push(bgSrc);
              }
            }
          }
        }
        
        debugImgInfo.push('After bg images: ' + images.length);
        
        // Strategy 3: Look for data attributes on non-img elements (common for lazy loading)
        var dataImageEls = document.querySelectorAll('[data-image], [data-src], [data-background]');
        for (var di2 = 0; di2 < dataImageEls.length; di2++) {
          var dataEl = dataImageEls[di2];
          var dataSrcs = [
            dataEl.getAttribute('data-image'),
            dataEl.getAttribute('data-src'),
            dataEl.getAttribute('data-background')
          ];
          for (var ds = 0; ds < dataSrcs.length; ds++) {
            var dataSrc = dataSrcs[ds];
            if (dataSrc && isVehicleImage(dataSrc)) {
              dataSrc = normalizeUrl(dataSrc);
              if (dataSrc.indexOf('http') === 0 && !processedUrls[dataSrc]) {
                processedUrls[dataSrc] = true;
                images.push(dataSrc);
              }
            }
          }
        }
        
        debugImgInfo.push('After data attrs: ' + images.length);
        
        return {
          vin: vin,
          price: price,
          odometer: odometer,
          images: images,
          trim: trim,
          description: description,
          stockNumber: stockNumber,
          pageText: pageText,
          debug: { 
            pageTitle: pageTitle, 
            bodyLength: bodyLength, 
            priceElExists: priceElExists, 
            priceSource: priceSource, 
            priceConfidence: priceConfidence, 
            allImgs: allImgs, 
            allPriceElements: allPriceElements,
            imgDebug: debugImgInfo.join(', ')
          }
        };
      })()`);
      
      // Log debug info to help diagnose extraction issues
      if (data.debug) {
        console.log(`    Debug: ${data.debug.bodyLength} chars, ${data.debug.allImgs} total imgs, price=$${data.price || 'null'}`);
        console.log(`    Images: ${data.debug.imgDebug || 'N/A'}`);
      }
      
      // Detect badges and body type from page text
      const badges = detectBadges(data.pageText);
      const type = determineBodyType(data.pageText);
      
      // Don't close the page - we're reusing it for all VDPs
      
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
      console.log(`    ✗ VDP extraction error (attempt ${attempt + 1}): ${error instanceof Error ? error.message : String(error)}`);
      
      if (attempt < retries) {
        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
        continue;
      }
      
      // Final attempt failed, return defaults
      console.log(`    ✗ VDP extraction failed after ${retries + 1} attempts`);
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

  // Get proxy if available
  const proxy = proxyManager.getNext();
  const launchOptions: any = {
    headless: true,
    executablePath: chromiumPath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-blink-features=AutomationControlled'
    ],
  };

  // Add proxy args if configured
  if (proxy) {
    launchOptions.args.push(`--proxy-server=${proxy.server}`);
    console.log(`  Using proxy: ${proxy.server}`);
  }

  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();
  
  // Authenticate proxy if needed
  if (proxy) {
    await proxyManager.authenticateProxy(page, proxy);
  }
  
  // Generate and apply random fingerprint
  const fingerprint = generateRandomFingerprint();
  await applyFingerprint(page, fingerprint);
  console.log(`  Applied fingerprint: ${fingerprint.viewport.width}x${fingerprint.viewport.height}`);
  
  // Try to load saved cookies
  const savedCookies = await cookieStore.loadCookies(dealerConfig.domain);
  if (savedCookies) {
    await page.setCookie(...savedCookies);
    console.log(`  ✓ Loaded saved cf_clearance cookies`);
  }
  
  // Add human-like delay before navigation
  await randomDelay(500, 1500);
  
  try {
    const response = await page.goto(dealerConfig.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    console.log(`  Waiting for vehicle listings to load...`);
    console.log(`  Response status: ${response?.status()}, url: ${response?.url()}`);
    
    // Check for Cloudflare challenge page
    const isChallenged = await isCloudflareChallenge(page);
    if (isChallenged) {
      console.log('  ⚠ Cloudflare challenge detected - waiting for automatic solve...');
      console.log('  This may take up to 60 seconds...');
      
      // Wait up to 60 seconds for Cloudflare challenge to resolve
      let attempts = 0;
      const maxAttempts = 60;
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check if challenge is solved by looking for vehicle content
        try {
          const hasVehicles = await page.evaluate(() => {
            return document.querySelectorAll('a[href*="/vehicles/2"]').length > 0;
          });
          
          if (hasVehicles) {
            console.log(`  ✓ Cloudflare challenge solved automatically after ${attempts + 1} seconds!`);
            
            // Save new cookies
            const cookies = await page.cookies();
            await cookieStore.saveCookies(dealerConfig.domain, cookies);
            break;
          }
        } catch (err) {
          // Continue waiting
        }
        
        // Also check if page content changed
        const stillChallenged = await isCloudflareChallenge(page);
        if (!stillChallenged) {
          console.log(`  ✓ Challenge page cleared after ${attempts + 1} seconds (checking for content...)`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          break;
        }
        
        attempts++;
        
        if (attempts % 10 === 0) {
          console.log(`    Still waiting... (${attempts}/${maxAttempts}s)`);
        }
      }
      
      if (attempts >= maxAttempts) {
        // Save screenshot for debugging
        try {
          await page.screenshot({ path: '/tmp/cloudflare-blocked.png', fullPage: false });
          console.log('  Screenshot saved to /tmp/cloudflare-blocked.png');
        } catch (err) {
          // Ignore screenshot errors
        }
        throw new Error('Cloudflare challenge did not resolve after 60 seconds');
      }
    }
    
    // Human-like behavior: scroll before interacting
    await randomDelay(500, 1000);
    await humanLikeScroll(page);
    
    // Wait for vehicle links to appear with retry
    console.log('  Looking for vehicle listings...');
    let vehicleLinksFound = false;
    for (let retry = 0; retry < 3; retry++) {
      try {
        await page.waitForSelector('a[href*="/vehicles/2"]', { timeout: 10000 });
        vehicleLinksFound = true;
        console.log('  ✓ Vehicle listings loaded successfully');
        break;
      } catch (err) {
        console.log(`  Retry ${retry + 1}/3: Vehicle links not found yet...`);
        await randomDelay(2000, 3000);
      }
    }
    
    if (!vehicleLinksFound) {
      throw new Error('Vehicle listings failed to load after multiple retries');
    }
    
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
    
    const vdpUrls = await page.evaluate(function(baseUrl) {
      var results = [];
      var processedUrls = {};
      
      // Find all vehicle detail page links
      var links = document.querySelectorAll('a[href*="/vehicles/2"]');
      
      for (var i = 0; i < links.length; i++) {
        var link = links[i];
        var href = link.getAttribute('href');
        if (!href) continue;
        
        // Filter for actual VDP URLs: /vehicles/{year}/{make}/{model}/{city}/{province}/{ID}/
        var match = href.match(/\/vehicles\/(\d{4})\/([a-z-]+)\/([a-z0-9-]+)\/([a-z-]+)\/([a-z]+)\/(\d+)\//i);
        if (!match) continue;
        
        var fullUrl = href.indexOf('http') === 0 ? href : 'https://' + baseUrl + href;
        
        if (processedUrls[fullUrl]) continue;
        processedUrls[fullUrl] = true;
        
        // Extract year, make, model from URL
        var year = parseInt(match[1]);
        var makeParts = match[2].split('-');
        var make = '';
        for (var j = 0; j < makeParts.length; j++) {
          if (j > 0) make += ' ';
          make += makeParts[j].charAt(0).toUpperCase() + makeParts[j].slice(1);
        }
        var modelParts = match[3].split('-');
        var model = '';
        for (var k = 0; k < modelParts.length; k++) {
          if (k > 0) model += ' ';
          model += modelParts[k].charAt(0).toUpperCase() + modelParts[k].slice(1);
        }
        
        results.push({ vdpUrl: fullUrl, year: year, make: make, model: model });
      }
      
      return results;
    }, dealerConfig.domain);

    console.log(`  ✓ Found ${vdpUrls.length} VDP URLs, now extracting VIN/price/odometer...`);
    
    // IMPORTANT: Reuse the SAME page that already solved Cloudflare challenge
    // This preserves the cf_clearance cookie and browser fingerprint
    // Creating a new page would require solving Cloudflare again
    const vdpPage = page; // Reuse the same page
    console.log(`  Reusing listing page (already has Cloudflare clearance) for VDP scraping`);
    
    // Visit each VDP to extract complete vehicle data
    const vehicles: DealerVehicleListing[] = [];
    
    console.log(`  Processing ${vdpUrls.length} vehicles...`);
    
    for (let i = 0; i < vdpUrls.length; i++) {
      const urlData = vdpUrls[i];
      console.log(`  [${i + 1}/${vdpUrls.length}] Scraping ${urlData.year} ${urlData.make} ${urlData.model}...`);
      
      // Pass the reusable page instead of browser
      const detailData = await scrapeVehicleDetailPage(vdpPage, urlData.vdpUrl);
      
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
      
      // Human-like delay between requests (randomized)
      await randomDelay(800, 1500);
    }
    
    console.log(`  ✓ Successfully scraped ${vehicles.length} vehicles from ${dealerConfig.name}`);
    
    // Clean up (vdpPage is the same as page, just close the browser)
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
