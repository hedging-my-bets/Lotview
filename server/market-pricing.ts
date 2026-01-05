const SOURCE_RELIABILITY: Record<string, { weight: number }> = {
  marketcheck: { weight: 1 },
  cargurus: { weight: 1 },
  cargurus_browserless: { weight: 1 },
  autotrader_browserless: { weight: 0.9 },
  apify: { weight: 0.85 },
  autotrader_scraper: { weight: 0.85 },
  kijiji: { weight: 0.75 },
  craigslist: { weight: 0.7 },
  unknown: { weight: 0.75 }
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const calculateMedian = (values: number[]) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
};

const filterOutliersByMad = <T extends { price: number }>(listings: T[]) => {
  const prices = listings.map(l => l.price).filter(p => p > 0).sort((a, b) => a - b);
  if (prices.length === 0) return listings;
  const median = calculateMedian(prices);
  const deviations = prices.map(p => Math.abs(p - median)).sort((a, b) => a - b);
  const mad = calculateMedian(deviations);
  if (mad === 0) {
    const threshold = Math.max(1000, median * 3);
    return listings.filter(l => l.price > 0 && l.price <= threshold);
  }
  return listings.filter(l => {
    if (l.price <= 0) return false;
    const robustZ = (0.6745 * (l.price - median)) / mad;
    return Math.abs(robustZ) <= 3.5;
  });
};

const weightedStats = (values: Array<{ price: number; weight: number }>) => {
  const sorted = values.filter(v => v.price > 0 && v.weight > 0).sort((a, b) => a.price - b.price);
  const totalWeight = sorted.reduce((sum, item) => sum + item.weight, 0);
  if (sorted.length === 0 || totalWeight <= 0) {
    return { average: 0, median: 0, p25: 0, p75: 0 };
  }
  const average = Math.round(sorted.reduce((sum, item) => sum + item.price * item.weight, 0) / totalWeight);
  const percentile = (p: number) => {
    const target = totalWeight * p;
    let cumulative = 0;
    for (const item of sorted) {
      cumulative += item.weight;
      if (cumulative >= target) return item.price;
    }
    return sorted[sorted.length - 1].price;
  };
  return {
    average,
    median: percentile(0.5),
    p25: percentile(0.25),
    p75: percentile(0.75)
  };
};

const normalizeTrim = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();

const fuzzyTrimMatch = (listingTrim: string, targetTrim: string) => {
  const normListing = normalizeTrim(listingTrim);
  const normTarget = normalizeTrim(targetTrim);
  if (!normListing || !normTarget) return false;
  if (normListing.includes(normTarget) || normTarget.includes(normListing)) return true;
  const listingWords = normListing.split(' ').filter(w => w.length > 0);
  const targetWords = normTarget.split(' ').filter(w => w.length > 0);
  const targetFoundInListing = targetWords.every(tw => listingWords.some(lw => lw.includes(tw) || tw.includes(lw)));
  const listingFoundInTarget = listingWords.every(lw => targetWords.some(tw => tw.includes(lw) || lw.includes(tw)));
  return targetFoundInListing || listingFoundInTarget;
};

const calculateSimilarityScore = (listing: Vehicle, target: MarketPricingRequest, colorScore: number) => {
  const yearDiff = Math.abs(listing.year - target.year);
  const yearScore = clamp(100 - yearDiff * 15, 40, 100);

  let trimScore = 70;
  if (target.trims && target.trims.length > 0) {
    if (!listing.trim) {
      trimScore = 55;
    } else {
      const matched = target.trims.some(t => fuzzyTrimMatch(listing.trim!, t));
      trimScore = matched ? 95 : 35;
    }
  } else if (target.trim && listing.trim) {
    trimScore = fuzzyTrimMatch(listing.trim, target.trim) ? 95 : 35;
  }

  let mileageScore = 60;
  if (target.mileage && listing.mileage) {
    const diff = Math.abs(listing.mileage - target.mileage);
    mileageScore = clamp(100 - (diff / 1000) * 1.2, 25, 100);
  }

  const score = Math.round(yearScore * 0.3 + trimScore * 0.3 + mileageScore * 0.25 + colorScore * 0.15);
  return score;
};

export interface MarketPricingRequest {
  year: number;
  make: string;
  model: string;
  trim?: string;
  trims?: string[]; // Support multiple trim selection
  mileage?: number;
  radius?: number; // miles for location-based search
  interiorColor?: string; // Target interior color for matching
  exteriorColor?: string; // Target exterior color for matching
}

// Calculate color match score (0-100) between two color strings
export function calculateColorMatchScore(targetColor?: string, compColor?: string): number {
  if (!targetColor || !compColor) return 50; // Neutral score if colors unknown
  
  const normalize = (c: string) => c.toLowerCase().trim().replace(/[^a-z]/g, '');
  const target = normalize(targetColor);
  const comp = normalize(compColor);
  
  // Exact match
  if (target === comp) return 100;
  
  // Partial match (one contains the other)
  if (target.includes(comp) || comp.includes(target)) return 85;
  
  // Common color groupings (e.g., "jet black" matches "black")
  const colorGroups: Record<string, string[]> = {
    black: ['black', 'jet', 'ebony', 'onyx', 'obsidian', 'midnight', 'charcoal'],
    white: ['white', 'pearl', 'ivory', 'snow', 'arctic', 'polar', 'cream'],
    gray: ['gray', 'grey', 'silver', 'titanium', 'graphite', 'pewter', 'slate', 'steel'],
    red: ['red', 'crimson', 'ruby', 'burgundy', 'maroon', 'cherry', 'scarlet', 'wine'],
    blue: ['blue', 'navy', 'sapphire', 'cobalt', 'azure', 'indigo', 'ocean', 'royal'],
    brown: ['brown', 'tan', 'beige', 'cognac', 'mocha', 'espresso', 'camel', 'saddle', 'caramel'],
    green: ['green', 'olive', 'emerald', 'forest', 'sage', 'hunter', 'lime'],
  };
  
  for (const group of Object.values(colorGroups)) {
    const targetInGroup = group.some(c => target.includes(c));
    const compInGroup = group.some(c => comp.includes(c));
    if (targetInGroup && compInGroup) return 70;
  }
  
  // No match
  return 30;
}

export interface PricingComparison {
  stockNumber: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  price: number;
  mileage?: number;
  location: string;
  dealership: string;
  priceDifference: number;
  percentageDifference: number;
  source?: string;
  listingUrl?: string;
  listingType?: string;
  postedDate?: Date | null;
  daysOnLot?: number; // Days since posted
  interiorColor?: string;
  exteriorColor?: string;
  colorMatchScore?: number; // 0-100 score for how well colors match target vehicle
  similarityScore?: number;
  weight?: number;
}

export interface MarketPricingResult {
  averagePrice: number;
  medianPrice: number;
  minPrice: number;
  maxPrice: number;
  totalComps: number;
  comparisons: PricingComparison[];
  priceRange: {
    low: number;
    high: number;
  };
  weightedAveragePrice?: number;
  weightedMedianPrice?: number;
  recommendation: string;
  marketPosition: 'below_market' | 'at_market' | 'above_market';
}

export interface Vehicle {
  id: number;
  stockNumber?: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  price: number;
  mileage?: number;
  odometer?: number; // Legacy field for internal inventory compatibility
  location: string;
  dealership: string;
  source?: string; // 'autotrader', 'kijiji', 'internal', 'craigslist', 'cargurus'
  listingType?: string; // 'dealer', 'private'
  listingUrl?: string; // Original listing URL for external sources
  postedDate?: Date | null;
  scrapedAt?: Date | null;
  interiorColor?: string;
  exteriorColor?: string;
}

export function analyzeMarketPricing(
  targetVehicle: MarketPricingRequest,
  inventoryVehicles: Vehicle[]
): MarketPricingResult {
  // Normalize trim string for fuzzy matching (remove punctuation, extra spaces)
  const normalizeTrim = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
  
  // Check if two trims are a fuzzy match (handles variations like "Ultimate" vs "Ultimate Calligraphy")
  const fuzzyTrimMatch = (listingTrim: string, targetTrim: string): boolean => {
    const normListing = normalizeTrim(listingTrim);
    const normTarget = normalizeTrim(targetTrim);
    
    // Direct contains check (either direction)
    if (normListing.includes(normTarget) || normTarget.includes(normListing)) {
      return true;
    }
    
    // Check if all words from the shorter string appear in the longer one
    const listingWords = normListing.split(' ').filter(w => w.length > 0);
    const targetWords = normTarget.split(' ').filter(w => w.length > 0);
    
    // Target words should be found in listing (e.g., "Ultimate" found in "Ultimate Calligraphy")
    const targetFoundInListing = targetWords.every(tw => listingWords.some(lw => lw.includes(tw) || tw.includes(lw)));
    const listingFoundInTarget = listingWords.every(lw => targetWords.some(tw => tw.includes(lw) || lw.includes(tw)));
    
    return targetFoundInListing || listingFoundInTarget;
  };
  
  // Filter comparable vehicles
  const comparables = inventoryVehicles.filter(v => {
    // Match year within 2 years
    const yearMatch = Math.abs(v.year - targetVehicle.year) <= 2;
    
    // Match make and model (case insensitive)
    const makeMatch = v.make.toLowerCase() === targetVehicle.make.toLowerCase();
    const modelMatch = v.model.toLowerCase() === targetVehicle.model.toLowerCase();
    
    // If trim(s) is specified, use fuzzy matching
    let trimMatch = true;
    if (v.trim) {
      // Check if multiple trims are specified
      if (targetVehicle.trims && targetVehicle.trims.length > 0) {
        trimMatch = targetVehicle.trims.some(targetTrim => fuzzyTrimMatch(v.trim!, targetTrim));
      } else if (targetVehicle.trim) {
        // Legacy single trim support
        trimMatch = fuzzyTrimMatch(v.trim, targetVehicle.trim);
      }
    }
    
    return yearMatch && makeMatch && modelMatch && trimMatch;
  });

  if (comparables.length === 0) {
    return {
      averagePrice: 0,
      medianPrice: 0,
      minPrice: 0,
      maxPrice: 0,
      totalComps: 0,
      comparisons: [],
      priceRange: { low: 0, high: 0 },
      recommendation: 'No comparable vehicles found in inventory. Consider expanding search criteria.',
      marketPosition: 'at_market'
    };
  }

  // Filter outliers using robust MAD
  const filteredComparables = filterOutliersByMad(comparables);
  if (filteredComparables.length === 0) {
    return {
      averagePrice: 0,
      medianPrice: 0,
      minPrice: 0,
      maxPrice: 0,
      totalComps: 0,
      comparisons: [],
      priceRange: { low: 0, high: 0 },
      recommendation: 'No comparable vehicles found after filtering outliers.',
      marketPosition: 'at_market'
    };
  }

  // Sort by price
  const sortedPrices = filteredComparables.map(v => v.price).sort((a, b) => a - b);
  const unweightedAverage = Math.round(
    filteredComparables.reduce((sum, v) => sum + v.price, 0) / filteredComparables.length
  );
  const unweightedMedian = calculateMedian(sortedPrices);

  const minPrice = sortedPrices[0];
  const maxPrice = sortedPrices[sortedPrices.length - 1];

  const weightedInputs = filteredComparables.map(v => {
    const interiorScore = calculateColorMatchScore(targetVehicle.interiorColor, v.interiorColor);
    const exteriorScore = calculateColorMatchScore(targetVehicle.exteriorColor, v.exteriorColor);
    const colorMatchScore = Math.round(interiorScore * 0.6 + exteriorScore * 0.4);
    const similarityScore = calculateSimilarityScore(v, targetVehicle, colorMatchScore);
    const sourceKey = v.source || 'unknown';
    const sourceWeight = SOURCE_RELIABILITY[sourceKey]?.weight ?? SOURCE_RELIABILITY.unknown.weight;
    const weight = Math.max(0.05, Math.exp((similarityScore - 60) / 15) * sourceWeight);
    return { price: v.price, weight, similarityScore, colorMatchScore };
  });

  const weighted = weightedStats(weightedInputs);
  const averagePrice = weighted.average || unweightedAverage;
  const medianPrice = weighted.median || unweightedMedian;

  const priceRange = {
    low: weighted.p25 || sortedPrices[Math.floor(sortedPrices.length * 0.25)],
    high: weighted.p75 || sortedPrices[Math.floor(sortedPrices.length * 0.75)]
  };

  // Create detailed comparisons with source, URL, and color match info
  const comparisons: PricingComparison[] = filteredComparables.map(v => {
    const priceDiff = v.price - averagePrice;
    const percentDiff = ((priceDiff / averagePrice) * 100);
    
    // Calculate color match score (weighted: 60% interior, 40% exterior for trade-in valuation)
    const interiorScore = calculateColorMatchScore(targetVehicle.interiorColor, v.interiorColor);
    const exteriorScore = calculateColorMatchScore(targetVehicle.exteriorColor, v.exteriorColor);
    const colorMatchScore = Math.round(interiorScore * 0.6 + exteriorScore * 0.4);
    const similarityScore = calculateSimilarityScore(v, targetVehicle, colorMatchScore);
    const sourceKey = v.source || 'unknown';
    const sourceWeight = SOURCE_RELIABILITY[sourceKey]?.weight ?? SOURCE_RELIABILITY.unknown.weight;
    const weight = Math.max(0.05, Math.exp((similarityScore - 60) / 15) * sourceWeight);
    
    // Calculate days on lot from postedDate
    let daysOnLot: number | undefined;
    if (v.postedDate) {
      const posted = new Date(v.postedDate);
      const now = new Date();
      daysOnLot = Math.floor((now.getTime() - posted.getTime()) / (1000 * 60 * 60 * 24));
      if (daysOnLot < 0) daysOnLot = undefined; // Future dates are invalid
    }
    
    return {
      stockNumber: v.stockNumber || `ID-${v.id}`,
      year: v.year,
      make: v.make,
      model: v.model,
      trim: v.trim,
      price: v.price,
      mileage: v.mileage,
      location: v.location,
      dealership: v.dealership,
      priceDifference: Math.round(priceDiff),
      percentageDifference: Math.round(percentDiff * 10) / 10,
      source: v.source,
      listingUrl: v.listingUrl,
      listingType: v.listingType,
      postedDate: v.postedDate,
      daysOnLot,
      interiorColor: v.interiorColor,
      exteriorColor: v.exteriorColor,
      colorMatchScore,
      similarityScore,
      weight: Math.round(weight * 1000) / 1000
    };
  }).sort((a, b) => a.price - b.price);

  // Determine market position (if we have a reference price from mileage or other factors)
  let marketPosition: 'below_market' | 'at_market' | 'above_market' = 'at_market';
  let recommendation = '';

  // Generate recommendation based on price distribution
  const priceSpread = maxPrice - minPrice;
  const spreadPercentage = (priceSpread / averagePrice) * 100;

  if (spreadPercentage < 10) {
    recommendation = `Market is very tight with ${spreadPercentage.toFixed(1)}% price spread. ` +
      `Average price is $${averagePrice.toLocaleString()}. ` +
      `Consider pricing between $${priceRange.low.toLocaleString()} and $${priceRange.high.toLocaleString()}.`;
  } else if (spreadPercentage < 20) {
    recommendation = `Market shows moderate variation with ${spreadPercentage.toFixed(1)}% price spread. ` +
      `Average price is $${averagePrice.toLocaleString()}. ` +
      `Recommended range: $${priceRange.low.toLocaleString()} - $${priceRange.high.toLocaleString()}.`;
  } else {
    recommendation = `Market shows high variation with ${spreadPercentage.toFixed(1)}% price spread. ` +
      `Average price is $${averagePrice.toLocaleString()}. ` +
      `Wide range suggests condition, options, or mileage significantly impact pricing.`;
  }

  return {
    averagePrice,
    medianPrice,
    minPrice,
    maxPrice,
    totalComps: filteredComparables.length,
    comparisons,
    priceRange,
    weightedAveragePrice: weighted.average || averagePrice,
    weightedMedianPrice: weighted.median || medianPrice,
    recommendation,
    marketPosition
  };
}
