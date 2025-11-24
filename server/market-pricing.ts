export interface MarketPricingRequest {
  year: number;
  make: string;
  model: string;
  trim?: string;
  mileage?: number;
  radius?: number; // miles for location-based search
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
  location: string;
  dealership: string;
}

export function analyzeMarketPricing(
  targetVehicle: MarketPricingRequest,
  inventoryVehicles: Vehicle[]
): MarketPricingResult {
  // Filter comparable vehicles
  const comparables = inventoryVehicles.filter(v => {
    // Match year within 2 years
    const yearMatch = Math.abs(v.year - targetVehicle.year) <= 2;
    
    // Match make and model (case insensitive)
    const makeMatch = v.make.toLowerCase() === targetVehicle.make.toLowerCase();
    const modelMatch = v.model.toLowerCase() === targetVehicle.model.toLowerCase();
    
    // If trim is specified, prefer exact match but allow without trim
    let trimMatch = true;
    if (targetVehicle.trim && v.trim) {
      trimMatch = v.trim.toLowerCase().includes(targetVehicle.trim.toLowerCase()) ||
                  targetVehicle.trim.toLowerCase().includes(v.trim.toLowerCase());
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

  // Sort by price
  const sortedPrices = comparables.map(v => v.price).sort((a, b) => a - b);
  
  // Calculate statistics
  const averagePrice = Math.round(
    comparables.reduce((sum, v) => sum + v.price, 0) / comparables.length
  );
  
  const medianPrice = sortedPrices.length % 2 === 0
    ? Math.round((sortedPrices[sortedPrices.length / 2 - 1] + sortedPrices[sortedPrices.length / 2]) / 2)
    : sortedPrices[Math.floor(sortedPrices.length / 2)];
  
  const minPrice = sortedPrices[0];
  const maxPrice = sortedPrices[sortedPrices.length - 1];

  // Calculate price range (25th to 75th percentile)
  const q1Index = Math.floor(sortedPrices.length * 0.25);
  const q3Index = Math.floor(sortedPrices.length * 0.75);
  const priceRange = {
    low: sortedPrices[q1Index],
    high: sortedPrices[q3Index]
  };

  // Create detailed comparisons
  const comparisons: PricingComparison[] = comparables.map(v => {
    const priceDiff = v.price - averagePrice;
    const percentDiff = ((priceDiff / averagePrice) * 100);
    
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
      percentageDifference: Math.round(percentDiff * 10) / 10
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
    totalComps: comparables.length,
    comparisons,
    priceRange,
    recommendation,
    marketPosition
  };
}
