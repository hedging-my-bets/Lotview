import { storage } from './storage';
import { marketAggregationService, MarketAggregationParams } from './market-aggregation-service';
import type { MarketListing, InsertMarketSnapshot, InsertPriceHistory } from '@shared/schema';
import { generateMarketInsights } from './openai';

export interface EnhancedMarketAnalysisParams {
  make: string;
  model: string;
  years: number[];
  trims?: string[];
  mileage?: number;
  postalCode: string;
  radiusKm: number;
  dealershipId: number;
  targetPrice?: number;
  centerLat?: number;
  centerLon?: number;
  skipAggregation?: boolean;
  skipPriceHistory?: boolean;
  skipAiInsights?: boolean;
}

export interface PercentileBreakdown {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

export interface ListingQualityScore {
  overall: number;
  breakdown: {
    hasVin: boolean;
    hasTrim: boolean;
    hasColors: boolean;
    hasMileage: boolean;
    hasSpecs: boolean;
    hasHistoryBadges: boolean;
    hasDealRating: boolean;
  };
  dataCompleteness: 'high' | 'medium' | 'low';
}

export interface CompetitorListing {
  year: number;
  make: string;
  model: string;
  trim?: string;
  price: number;
  mileage?: number;
  listingUrl: string;
  daysOnLot?: number;
  interiorColor?: string;
  exteriorColor?: string;
  source?: string;
  qualityScore?: ListingQualityScore;
  vin?: string;
  historyBadges?: string[];
  dealRating?: string;
}

export interface CompetitorInfo {
  sellerName: string;
  listingCount: number;
  averagePrice: number;
  lowestPrice: number;
  highestPrice: number;
  priceRange: string;
  listings: CompetitorListing[];
}

export interface DaysOnMarketInfo {
  average: number;
  median: number;
  fastest: number;
  slowest: number;
  distribution: {
    under7Days: number;
    under14Days: number;
    under30Days: number;
    over30Days: number;
  };
}

export interface PriceTrend {
  date: string;
  averagePrice: number;
  medianPrice: number;
  listingCount: number;
}

export interface SourceBreakdown {
  name: string;
  listingCount: number;
  averageQualityScore: number;
  dataRank: number;
  reliability: 'high' | 'medium' | 'low';
}

export interface TrimCoverageStats {
  totalListings: number;
  listingsWithTrim: number;
  trimMatchedListings: number;
  trimMismatchedListings: number;
  noTrimListings: number;
}

export interface DistanceCoverageStats {
  totalListings: number;
  listingsWithCoordinates: number;
  listingsWithinRadius: number;
  listingsOutsideRadius: number;
  listingsUnknownDistance: number;
}

export interface ComparisonListing {
  year: number;
  make: string;
  model: string;
  trim?: string;
  price: number;
  mileage?: number;
  distance?: number;
  listingUrl?: string;
  listingType: 'dealer' | 'private';
  dealership?: string;
  daysOnLot?: number;
  source?: string;
  similarityScore?: number;
  weight?: number;
  qualityScore?: number;
  exteriorColor?: string;
  interiorColor?: string;
}

export interface EnhancedMarketAnalysisResult {
  success: boolean;
  dataSource: string;
  searchParams: {
    make: string;
    model: string;
    years: number[];
    location: string;
    radiusKm: number;
    trims?: string[];
  };
  summary: {
    totalListings: number;
    averagePrice: number;
    medianPrice: number;
    minPrice: number;
    maxPrice: number;
    averageMileage: number;
    unweightedAveragePrice?: number;
    unweightedMedianPrice?: number;
    weightedAveragePrice?: number;
    weightedMedianPrice?: number;
    averageSimilarityScore?: number;
    averageDaysOnMarket?: number;
    averageQualityScore?: number;
    highQualityListings?: number;
  };
  trimCoverage?: TrimCoverageStats;
  distanceCoverage?: DistanceCoverageStats;
  percentiles: PercentileBreakdown;
  daysOnMarket: DaysOnMarketInfo;
  competitors: CompetitorInfo[];
  comparisons: ComparisonListing[];
  priceTrends: PriceTrend[];
  priceRecommendation: {
    suggestedPrice: number;
    priceRange: { low: number; high: number };
    marketPosition: 'below_market' | 'at_market' | 'above_market' | 'competitive';
    confidence: 'high' | 'medium' | 'low';
    reasoning: string;
  };
  aiInsights?: string;
  sources: string[];
  sourceBreakdown: SourceBreakdown[];
  scrapedAt: string;
  errors: string[];
}

const SOURCE_RELIABILITY: Record<string, { rank: number; reliability: 'high' | 'medium' | 'low' }> = {
  'marketcheck': { rank: 1, reliability: 'high' },
  'cargurus': { rank: 2, reliability: 'high' },
  'cargurus_browserless': { rank: 2, reliability: 'high' },
  'autotrader_browserless': { rank: 3, reliability: 'medium' },
  'browserless': { rank: 3, reliability: 'medium' },
  'apify': { rank: 3, reliability: 'medium' },
  'autotrader_scraper': { rank: 4, reliability: 'medium' },
  'kijiji': { rank: 5, reliability: 'medium' },
  'craigslist': { rank: 6, reliability: 'low' },
  'unknown': { rank: 10, reliability: 'low' }
};

const RELIABILITY_WEIGHT: Record<'high' | 'medium' | 'low', number> = {
  high: 1,
  medium: 0.85,
  low: 0.7
};

export class EnhancedMarketAnalysisService {
  private calculateListingQualityScore(listing: MarketListing): ListingQualityScore {
    const breakdown = {
      hasVin: !!listing.vin,
      hasTrim: !!listing.trim,
      hasColors: !!(listing.interiorColor || listing.exteriorColor),
      hasMileage: !!listing.mileage && listing.mileage > 0,
      hasSpecs: !!listing.specsJson,
      hasHistoryBadges: !!listing.historyBadges,
      hasDealRating: !!listing.dealerRating
    };

    let score = 0;
    if (breakdown.hasVin) score += 20;
    if (breakdown.hasTrim) score += 15;
    if (breakdown.hasColors) score += 10;
    if (breakdown.hasMileage) score += 15;
    if (breakdown.hasSpecs) score += 15;
    if (breakdown.hasHistoryBadges) score += 15;
    if (breakdown.hasDealRating) score += 10;

    const sourceInfo = SOURCE_RELIABILITY[listing.source] || SOURCE_RELIABILITY['unknown'];
    score = Math.min(100, score + (sourceInfo.rank <= 2 ? 10 : 0));

    let dataCompleteness: 'high' | 'medium' | 'low' = 'low';
    if (score >= 70) dataCompleteness = 'high';
    else if (score >= 40) dataCompleteness = 'medium';

    return { overall: score, breakdown, dataCompleteness };
  }

  private calculateSourceBreakdown(listings: MarketListing[]): SourceBreakdown[] {
    const sourceMap = new Map<string, { listings: MarketListing[]; totalQuality: number }>();

    for (const listing of listings) {
      const source = listing.source || 'unknown';
      if (!sourceMap.has(source)) {
        sourceMap.set(source, { listings: [], totalQuality: 0 });
      }
      const entry = sourceMap.get(source)!;
      entry.listings.push(listing);
      entry.totalQuality += this.calculateListingQualityScore(listing).overall;
    }

    const breakdown: SourceBreakdown[] = [];
    for (const [name, data] of sourceMap.entries()) {
      const sourceInfo = SOURCE_RELIABILITY[name] || SOURCE_RELIABILITY['unknown'];
      breakdown.push({
        name,
        listingCount: data.listings.length,
        averageQualityScore: Math.round(data.totalQuality / data.listings.length),
        dataRank: sourceInfo.rank,
        reliability: sourceInfo.reliability
      });
    }

    return breakdown.sort((a, b) => a.dataRank - b.dataRank);
  }

  private normalizeTrim(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private fuzzyTrimMatch(listingTrim: string, targetTrim: string): boolean {
    const normListing = this.normalizeTrim(listingTrim);
    const normTarget = this.normalizeTrim(targetTrim);

    if (!normListing || !normTarget) return false;
    if (normListing.includes(normTarget) || normTarget.includes(normListing)) {
      return true;
    }

    const listingWords = normListing.split(' ').filter(w => w.length > 0);
    const targetWords = normTarget.split(' ').filter(w => w.length > 0);

    const targetFoundInListing = targetWords.every(tw => listingWords.some(lw => lw.includes(tw) || tw.includes(lw)));
    const listingFoundInTarget = listingWords.every(lw => targetWords.some(tw => tw.includes(lw) || lw.includes(tw)));

    return targetFoundInListing || listingFoundInTarget;
  }

  private calculateTrimMatchScore(listingTrim?: string | null, targetTrims?: string[]): { score: number; matched: boolean; missing: boolean } {
    if (!targetTrims || targetTrims.length === 0) {
      return { score: 70, matched: true, missing: false };
    }

    if (!listingTrim) {
      return { score: 55, matched: false, missing: true };
    }

    const matched = targetTrims.some(targetTrim => this.fuzzyTrimMatch(listingTrim, targetTrim));
    return {
      score: matched ? 95 : 35,
      matched,
      missing: false
    };
  }

  private calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusKm * c;
  }

  private calculateSimilarityScore(params: {
    listing: MarketListing;
    targetYears: number[];
    targetTrims?: string[];
    targetMileage?: number;
    centerLat?: number;
    centerLon?: number;
    radiusKm?: number;
    qualityScore: ListingQualityScore;
    distanceKm?: number;
  }): { score: number; weight: number; distanceKm?: number; trimMatched: boolean } {
    const { listing, targetYears, targetTrims, targetMileage, centerLat, centerLon, radiusKm, qualityScore } = params;

    const yearDiff = Math.min(...targetYears.map(y => Math.abs(listing.year - y)));
    const yearScore = Math.max(35, 100 - yearDiff * 15);

    const trimResult = this.calculateTrimMatchScore(listing.trim || undefined, targetTrims);

    let mileageScore = 60;
    if (targetMileage && listing.mileage && listing.mileage > 0) {
      const diff = Math.abs(listing.mileage - targetMileage);
      mileageScore = Math.max(25, 100 - (diff / 1000) * 1.2);
    }

    let distanceScore = 60;
    let distanceKm: number | undefined = params.distanceKm;
    if (distanceKm === undefined && centerLat !== undefined && centerLon !== undefined && listing.latitude && listing.longitude) {
      const lat = parseFloat(listing.latitude);
      const lon = parseFloat(listing.longitude);
      if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
        distanceKm = this.calculateDistanceKm(centerLat, centerLon, lat, lon);
      }
    }
    if (distanceKm !== undefined) {
      const radius = radiusKm && radiusKm > 0 ? radiusKm : 100;
      distanceScore = Math.max(30, 100 - (distanceKm / radius) * 40);
    } else if (radiusKm && radiusKm > 0) {
      // Penalize listings without coordinates when radius filtering is requested.
      distanceScore = 40;
    }

    const score = Math.round(
      yearScore * 0.3
      + trimResult.score * 0.35
      + mileageScore * 0.2
      + distanceScore * 0.15
    );

    const sourceInfo = SOURCE_RELIABILITY[listing.source] || SOURCE_RELIABILITY['unknown'];
    const reliabilityWeight = RELIABILITY_WEIGHT[sourceInfo.reliability];
    const qualityWeight = Math.max(0.6, qualityScore.overall / 100);
    const similarityWeight = Math.exp((score - 60) / 15);
    const weight = Math.max(0.05, similarityWeight * reliabilityWeight * qualityWeight);

    return {
      score,
      weight,
      distanceKm,
      trimMatched: trimResult.matched
    };
  }

  private filterOutliersByMad(listings: MarketListing[]): { listings: MarketListing[]; outlierCount: number; median: number; mad: number } {
    const prices = listings.map(l => l.price).filter(p => p > 0).sort((a, b) => a - b);
    if (prices.length === 0) {
      return { listings: [], outlierCount: 0, median: 0, mad: 0 };
    }

    const median = this.calculateMedian(prices);
    const deviations = prices.map(p => Math.abs(p - median)).sort((a, b) => a - b);
    const mad = this.calculateMedian(deviations);

    if (mad === 0) {
      const threshold = Math.max(1000, median * 3);
      const filtered = listings.filter(l => l.price > 0 && l.price <= threshold);
      return { listings: filtered, outlierCount: listings.length - filtered.length, median, mad };
    }

    const filtered = listings.filter(l => {
      if (l.price <= 0) return false;
      const robustZ = (0.6745 * (l.price - median)) / mad;
      return Math.abs(robustZ) <= 3.5;
    });

    return { listings: filtered, outlierCount: listings.length - filtered.length, median, mad };
  }

  private calculateWeightedStats(weightedListings: Array<{ price: number; weight: number }>): {
    average: number;
    median: number;
    p10: number;
    p25: number;
    p75: number;
    p90: number;
  } {
    const sorted = weightedListings
      .filter(l => l.price > 0 && l.weight > 0)
      .sort((a, b) => a.price - b.price);

    const totalWeight = sorted.reduce((sum, item) => sum + item.weight, 0);
    if (sorted.length === 0 || totalWeight <= 0) {
      return { average: 0, median: 0, p10: 0, p25: 0, p75: 0, p90: 0 };
    }

    const weightedAverage = Math.round(sorted.reduce((sum, item) => sum + item.price * item.weight, 0) / totalWeight);

    const percentile = (p: number) => {
      const target = totalWeight * p;
      let cumulative = 0;
      for (const item of sorted) {
        cumulative += item.weight;
        if (cumulative >= target) {
          return item.price;
        }
      }
      return sorted[sorted.length - 1].price;
    };

    return {
      average: weightedAverage,
      median: percentile(0.5),
      p10: percentile(0.1),
      p25: percentile(0.25),
      p75: percentile(0.75),
      p90: percentile(0.9)
    };
  }

  private calculateMileageAdjustment(listings: MarketListing[], targetMileage?: number): {
    adjustment: number;
    slopePerKm: number | null;
    marketAvgMileage: number | null;
  } {
    if (!targetMileage) {
      return { adjustment: 0, slopePerKm: null, marketAvgMileage: null };
    }

    const samples = listings.filter(l => l.mileage && l.mileage > 0 && l.price > 0);
    if (samples.length < 6) {
      return { adjustment: 0, slopePerKm: null, marketAvgMileage: null };
    }

    const avgMileage = Math.round(samples.reduce((sum, l) => sum + (l.mileage || 0), 0) / samples.length);
    const avgPrice = samples.reduce((sum, l) => sum + l.price, 0) / samples.length;
    const numerator = samples.reduce((sum, l) => sum + ((l.mileage || 0) - avgMileage) * (l.price - avgPrice), 0);
    const denominator = samples.reduce((sum, l) => sum + Math.pow((l.mileage || 0) - avgMileage, 2), 0);

    if (denominator === 0) {
      return { adjustment: 0, slopePerKm: null, marketAvgMileage: avgMileage };
    }

    let slope = numerator / denominator;
    if (slope > -0.02) slope = -0.02;
    if (slope < -0.3) slope = -0.3;

    const adjustment = Math.round((targetMileage - avgMileage) * slope);
    return { adjustment, slopePerKm: slope, marketAvgMileage: avgMileage };
  }

  async analyze(params: EnhancedMarketAnalysisParams): Promise<EnhancedMarketAnalysisResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const sources: string[] = [];

    console.log(`[EnhancedMarketAnalysis] Starting analysis for ${params.make} ${params.model}`);

    const yearMin = Math.min(...params.years);
    const yearMax = Math.max(...params.years);

    const aggregationParams: MarketAggregationParams = {
      make: params.make,
      model: params.model,
      yearMin,
      yearMax,
      postalCode: params.postalCode,
      radiusKm: params.radiusKm,
      maxResults: 150,
      dealershipId: params.dealershipId
    };

    if (!params.skipAggregation) {
      let aggResult;
      try {
        aggResult = await marketAggregationService.aggregateMarketData(aggregationParams);
        if (aggResult.sources) {
          sources.push(...aggResult.sources);
        }
        if (aggResult.errors) {
          errors.push(...aggResult.errors);
        }
      } catch (error) {
        console.error('[EnhancedMarketAnalysis] Aggregation error:', error);
        errors.push(`Aggregation: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    const { listings } = await storage.getMarketListings(params.dealershipId, {
      make: params.make,
      model: params.model,
      yearMin,
      yearMax
    }, 500);

    // Track trim coverage statistics
    let trimCoverage = {
      totalListings: listings.length,
      listingsWithTrim: listings.filter(l => l.trim).length,
      trimMatchedListings: 0,
      trimMismatchedListings: 0,
      noTrimListings: 0
    };
    
    let filteredListings = listings;
    if (params.trims && params.trims.length > 0) {
      // STRICT trim filtering - only include listings that match the specified trim
      // This prevents mixing Long Range with Plaid trim which can differ by $30k+
      const trimMatched: typeof listings = [];
      const trimMismatched: typeof listings = [];
      const noTrim: typeof listings = [];
      
      for (const l of listings) {
        if (!l.trim) {
          noTrim.push(l);
        } else {
          const matches = params.trims!.some(t => this.fuzzyTrimMatch(l.trim!, t));
          if (matches) {
            trimMatched.push(l);
          } else {
            trimMismatched.push(l);
          }
        }
      }
      
      trimCoverage.trimMatchedListings = trimMatched.length;
      trimCoverage.trimMismatchedListings = trimMismatched.length;
      trimCoverage.noTrimListings = noTrim.length;
      
      // Use only trim-matched listings for accurate pricing
      // If too few trim matches, fall back to include no-trim listings with a warning
      if (trimMatched.length >= 5) {
        filteredListings = trimMatched;
        console.log(`[EnhancedMarketAnalysis] Strict trim filter: ${trimMatched.length} exact matches for "${params.trims.join(', ')}"`);
      } else if (trimMatched.length + noTrim.length >= 3) {
        // Include listings without trim data as fallback
        filteredListings = [...trimMatched, ...noTrim];
        errors.push(`Limited trim data: Only ${trimMatched.length} exact trim matches, including ${noTrim.length} listings without trim info`);
        console.log(`[EnhancedMarketAnalysis] Trim fallback: ${trimMatched.length} matches + ${noTrim.length} without trim = ${filteredListings.length} total`);
      } else {
        // Very limited data - use all listings but warn strongly
        filteredListings = listings;
        errors.push(`Warning: Insufficient trim data for accurate comparison. Only ${trimMatched.length} of ${listings.length} listings match trim "${params.trims.join(', ')}". Results may include different trim levels.`);
        console.log(`[EnhancedMarketAnalysis] Trim data insufficient: using all ${listings.length} listings with warning`);
      }
    }

    if (filteredListings.length === 0) {
      return this.createEmptyResult(params, sources, errors);
    }

    if (sources.length === 0) {
      const inferredSources = Array.from(new Set(filteredListings.map(l => l.source).filter((s): s is string => !!s)));
      sources.push(...inferredSources);
    }

    // Filter out price outliers using robust MAD (median absolute deviation)
    const positiveListings = filteredListings.filter(l => l.price > 0);
    
    if (positiveListings.length === 0) {
      return this.createEmptyResult(params, sources, errors);
    }

    const { listings: validListings, outlierCount } = this.filterOutliersByMad(positiveListings);
    const zeroCount = filteredListings.length - positiveListings.length;
    
    if (zeroCount > 0) {
      console.log(`[EnhancedMarketAnalysis] Removed ${zeroCount} listings with zero/negative prices`);
    }
    if (outlierCount > 0) {
      console.log(`[EnhancedMarketAnalysis] Filtered ${outlierCount} price outliers with robust MAD`);
      errors.push(`Filtered ${outlierCount} listings with outlier prices (MAD)`);
    }
    
    filteredListings = validListings;
    
    if (filteredListings.length === 0) {
      return this.createEmptyResult(params, sources, errors);
    }

    const centerLat = typeof params.centerLat === 'number' ? params.centerLat : undefined;
    const centerLon = typeof params.centerLon === 'number' ? params.centerLon : undefined;

    // Apply distance filtering when coordinates are available
    let distanceCoverage: DistanceCoverageStats | undefined;
    const radius = params.radiusKm && params.radiusKm > 0 ? params.radiusKm : undefined;
    const distanceById = new Map<number, number | undefined>();

    if (centerLat !== undefined && centerLon !== undefined && radius) {
      const withDistance: MarketListing[] = [];
      const outsideRadius: MarketListing[] = [];
      const unknownDistance: MarketListing[] = [];

      for (const listing of filteredListings) {
        let distanceKm: number | undefined;
        if (listing.latitude && listing.longitude) {
          const lat = parseFloat(listing.latitude);
          const lon = parseFloat(listing.longitude);
          if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
            distanceKm = this.calculateDistanceKm(centerLat, centerLon, lat, lon);
          }
        }
        if (distanceKm !== undefined) {
          distanceById.set(listing.id, distanceKm);
          if (distanceKm <= radius) {
            withDistance.push(listing);
          } else {
            outsideRadius.push(listing);
          }
        } else {
          unknownDistance.push(listing);
        }
      }

      distanceCoverage = {
        totalListings: filteredListings.length,
        listingsWithCoordinates: withDistance.length + outsideRadius.length,
        listingsWithinRadius: withDistance.length,
        listingsOutsideRadius: outsideRadius.length,
        listingsUnknownDistance: unknownDistance.length
      };

      if (withDistance.length >= 5) {
        filteredListings = withDistance;
      } else if (withDistance.length + unknownDistance.length >= 3) {
        filteredListings = [...withDistance, ...unknownDistance];
        errors.push(`Limited location data: ${unknownDistance.length} listings missing coordinates; included to maintain sample size.`);
      } else if (outsideRadius.length > 0) {
        errors.push('Most listings fall outside the selected radius. Consider expanding your search range.');
      }
    }

    if (filteredListings.length === 0) {
      errors.push('No listings remain after applying location filters.');
      return this.createEmptyResult(params, sources, errors);
    }

    const prices = filteredListings.map(l => l.price).sort((a, b) => a - b);
    const mileages = filteredListings.filter(l => l.mileage).map(l => l.mileage!);

    const analysisListings = filteredListings.map(listing => {
      const qualityScore = this.calculateListingQualityScore(listing);
      const distanceKm = distanceById.get(listing.id);
      const similarity = this.calculateSimilarityScore({
        listing,
        targetYears: params.years,
        targetTrims: params.trims,
        targetMileage: params.mileage,
        centerLat,
        centerLon,
        radiusKm: params.radiusKm,
        qualityScore,
        distanceKm
      });

      return {
        listing,
        qualityScore,
        similarityScore: similarity.score,
        weight: similarity.weight,
        distanceKm: similarity.distanceKm,
        trimMatched: similarity.trimMatched
      };
    });

    const avgQualityScore = Math.round(
      analysisListings.reduce((sum, item) => sum + item.qualityScore.overall, 0) / analysisListings.length
    );
    const highQualityCount = analysisListings.filter(item => item.qualityScore.dataCompleteness === 'high').length;
    const averageSimilarityScore = Math.round(
      analysisListings.reduce((sum, item) => sum + item.similarityScore, 0) / analysisListings.length
    );

    const sourceBreakdown = this.calculateSourceBreakdown(filteredListings);

    const unweightedAveragePrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
    const unweightedMedianPrice = this.calculateMedian(prices);

    const weightedStats = this.calculateWeightedStats(
      analysisListings.map(item => ({ price: item.listing.price, weight: item.weight }))
    );

    const avgMileage = mileages.length > 0
      ? Math.round(mileages.reduce((a, b) => a + b, 0) / mileages.length)
      : 0;

    const daysOnMarket = this.calculateDaysOnMarket(filteredListings);
    const averageDaysOnMarket = daysOnMarket.average > 0 ? daysOnMarket.average : undefined;

    const summary = {
      totalListings: filteredListings.length,
      averagePrice: weightedStats.average || unweightedAveragePrice,
      medianPrice: weightedStats.median || unweightedMedianPrice,
      minPrice: prices[0],
      maxPrice: prices[prices.length - 1],
      averageMileage: avgMileage,
      unweightedAveragePrice,
      unweightedMedianPrice,
      weightedAveragePrice: weightedStats.average,
      weightedMedianPrice: weightedStats.median,
      averageSimilarityScore,
      averageDaysOnMarket,
      averageQualityScore: avgQualityScore,
      highQualityListings: highQualityCount
    };

    const unweightedPercentiles = this.calculatePercentiles(prices);
    const percentiles = {
      p10: weightedStats.p10 || unweightedPercentiles.p10,
      p25: weightedStats.p25 || unweightedPercentiles.p25,
      p50: weightedStats.median || unweightedMedianPrice,
      p75: weightedStats.p75 || unweightedPercentiles.p75,
      p90: weightedStats.p90 || unweightedPercentiles.p90
    };

    const competitors = this.analyzeCompetitors(filteredListings);

    const priceTrends = params.skipPriceHistory ? [] : await this.getPriceTrends(params.dealershipId, params.make, params.model);

    const mileageAdjustment = this.calculateMileageAdjustment(filteredListings, params.mileage);
    const priceRecommendation = this.generatePriceRecommendation(
      summary,
      percentiles,
      params.targetPrice,
      mileageAdjustment
    );

    if (!params.skipPriceHistory) {
      await this.recordPriceHistory(params.dealershipId, filteredListings);
    }

    await this.createSnapshot(params.dealershipId, params, summary, percentiles, daysOnMarket, sources);

    const elapsed = Date.now() - startTime;
    console.log(`[EnhancedMarketAnalysis] Complete in ${elapsed}ms - ${filteredListings.length} listings analyzed`);

    const comparisons: ComparisonListing[] = [...analysisListings]
      .sort((a, b) => {
        if (b.weight !== a.weight) return b.weight - a.weight;
        if (b.similarityScore !== a.similarityScore) return b.similarityScore - a.similarityScore;
        return a.listing.price - b.listing.price;
      })
      .map(item => ({
      year: item.listing.year,
      make: item.listing.make,
      model: item.listing.model,
      trim: item.listing.trim || undefined,
      price: item.listing.price,
      mileage: item.listing.mileage || undefined,
      distance: item.distanceKm,
      listingUrl: item.listing.listingUrl || undefined,
      listingType: (item.listing.listingType === 'private' ? 'private' : 'dealer') as 'dealer' | 'private',
      dealership: item.listing.sellerName || undefined,
      daysOnLot: item.listing.daysOnLot || undefined,
      source: item.listing.source || undefined,
      similarityScore: item.similarityScore,
      weight: Math.round(item.weight * 1000) / 1000,
      qualityScore: item.qualityScore.overall,
      exteriorColor: item.listing.exteriorColor || undefined,
      interiorColor: item.listing.interiorColor || undefined
    }));

    let aiInsights: string | undefined;
    if (!params.skipAiInsights && summary.totalListings >= 5) {
      try {
        aiInsights = await generateMarketInsights({
          dealershipId: params.dealershipId,
          make: params.make,
          model: params.model,
          years: params.years,
          summary,
          percentiles,
          daysOnMarket,
          priceRecommendation,
          distanceCoverage
        });
      } catch (error) {
        errors.push(`AI insights: ${error instanceof Error ? error.message : 'Unavailable'}`);
      }
    }

    return {
      success: true,
      dataSource: sources.join(', ') || 'database',
      searchParams: {
        make: params.make,
        model: params.model,
        years: params.years,
        location: params.postalCode,
        radiusKm: params.radiusKm,
        trims: params.trims
      },
      summary,
      trimCoverage: params.trims && params.trims.length > 0 ? trimCoverage : undefined,
      distanceCoverage,
      percentiles,
      daysOnMarket,
      competitors,
      comparisons,
      priceTrends,
      priceRecommendation,
      aiInsights,
      sources,
      sourceBreakdown,
      scrapedAt: new Date().toISOString(),
      errors
    };
  }

  private calculateMedian(sortedArray: number[]): number {
    const mid = Math.floor(sortedArray.length / 2);
    return sortedArray.length % 2 !== 0
      ? sortedArray[mid]
      : Math.round((sortedArray[mid - 1] + sortedArray[mid]) / 2);
  }

  private calculatePercentiles(sortedPrices: number[]): PercentileBreakdown {
    const getPercentile = (arr: number[], p: number) => {
      const index = Math.floor((p / 100) * arr.length);
      return arr[Math.min(index, arr.length - 1)];
    };

    return {
      p10: getPercentile(sortedPrices, 10),
      p25: getPercentile(sortedPrices, 25),
      p50: getPercentile(sortedPrices, 50),
      p75: getPercentile(sortedPrices, 75),
      p90: getPercentile(sortedPrices, 90)
    };
  }

  private calculateDaysOnMarket(listings: MarketListing[]): DaysOnMarketInfo {
    // Use daysOnLot field from scraper (CarGurus provides this directly)
    // Fall back to calculating from postedDate if daysOnLot not available
    const now = new Date();
    const daysOnMarket = listings
      .map(l => {
        // Prefer scraped daysOnLot field
        if (typeof l.daysOnLot === 'number' && l.daysOnLot >= 0) {
          return l.daysOnLot;
        }
        // Fallback to postedDate calculation
        if (l.postedDate) {
          const posted = new Date(l.postedDate);
          const days = Math.floor((now.getTime() - posted.getTime()) / (1000 * 60 * 60 * 24));
          if (days >= 0 && days < 365) return days;
        }
        return null;
      })
      .filter((d): d is number => d !== null);

    if (daysOnMarket.length === 0) {
      return {
        average: 0,
        median: 0,
        fastest: 0,
        slowest: 0,
        distribution: { under7Days: 0, under14Days: 0, under30Days: 0, over30Days: 0 }
      };
    }

    const sorted = daysOnMarket.sort((a, b) => a - b);

    return {
      average: Math.round(daysOnMarket.reduce((a, b) => a + b, 0) / daysOnMarket.length),
      median: this.calculateMedian(sorted),
      fastest: sorted[0],
      slowest: sorted[sorted.length - 1],
      distribution: {
        under7Days: daysOnMarket.filter(d => d < 7).length,
        under14Days: daysOnMarket.filter(d => d < 14).length,
        under30Days: daysOnMarket.filter(d => d < 30).length,
        over30Days: daysOnMarket.filter(d => d >= 30).length
      }
    };
  }

  private analyzeCompetitors(listings: MarketListing[]): CompetitorInfo[] {
    const dealerListings = listings.filter(l => l.listingType === 'dealer' && l.sellerName);
    
    const dealerMap = new Map<string, MarketListing[]>();
    for (const listing of dealerListings) {
      const name = listing.sellerName || 'Unknown Dealer';
      if (!dealerMap.has(name)) {
        dealerMap.set(name, []);
      }
      dealerMap.get(name)!.push(listing);
    }

    const competitors: CompetitorInfo[] = [];
    for (const [sellerName, sellerListings] of Array.from(dealerMap.entries())) {
      const prices = sellerListings.map((l: MarketListing) => l.price).sort((a: number, b: number) => a - b);
      const avgPrice = Math.round(prices.reduce((a: number, b: number) => a + b, 0) / prices.length);
      
      const competitorListings: CompetitorListing[] = sellerListings
        .slice(0, 10)
        .map((l: MarketListing) => {
          // Use scraped daysOnLot field from listing (CarGurus provides this directly)
          let daysOnLot: number | undefined = l.daysOnLot ?? undefined;
          
          // Fallback to postedDate calculation only if daysOnLot not available
          if (daysOnLot === undefined && l.postedDate) {
            const posted = new Date(l.postedDate);
            const now = new Date();
            const calculatedDays = Math.floor((now.getTime() - posted.getTime()) / (1000 * 60 * 60 * 24));
            if (calculatedDays >= 0) daysOnLot = calculatedDays;
          }
          
          const qualityScore = this.calculateListingQualityScore(l);
          let historyBadges: string[] | undefined;
          try {
            if (l.historyBadges) {
              historyBadges = JSON.parse(l.historyBadges);
            }
          } catch {}
          
          return {
            year: l.year,
            make: l.make,
            model: l.model,
            trim: l.trim || undefined,
            price: l.price,
            mileage: l.mileage || undefined,
            listingUrl: l.listingUrl,
            daysOnLot,
            interiorColor: l.interiorColor || undefined,
            exteriorColor: l.exteriorColor || undefined,
            source: l.source,
            qualityScore,
            vin: l.vin || undefined,
            historyBadges,
            dealRating: l.dealerRating || undefined
          };
        });
      
      competitors.push({
        sellerName,
        listingCount: sellerListings.length,
        averagePrice: avgPrice,
        lowestPrice: prices[0],
        highestPrice: prices[prices.length - 1],
        priceRange: `$${prices[0].toLocaleString()} - $${prices[prices.length - 1].toLocaleString()}`,
        listings: competitorListings
      });
    }

    return competitors.sort((a, b) => b.listingCount - a.listingCount).slice(0, 10);
  }

  private async getPriceTrends(dealershipId: number, make: string, model: string): Promise<PriceTrend[]> {
    try {
      const snapshots = await storage.getMarketSnapshots(dealershipId, { make, model, limit: 30 });
      
      return snapshots.map(s => ({
        date: new Date(s.snapshotDate).toISOString().split('T')[0],
        averagePrice: s.averagePrice,
        medianPrice: s.medianPrice,
        listingCount: s.totalListings
      }));
    } catch (error) {
      console.error('[EnhancedMarketAnalysis] Price trends error:', error);
      return [];
    }
  }

  private generatePriceRecommendation(
    summary: {
      totalListings: number;
      averagePrice: number;
      medianPrice: number;
      minPrice: number;
      maxPrice: number;
      averageMileage?: number | null;
      averageQualityScore?: number;
      averageSimilarityScore?: number;
    },
    percentiles: PercentileBreakdown,
    targetPrice: number | undefined,
    mileageContext: { adjustment: number; slopePerKm: number | null; marketAvgMileage: number | null }
  ): EnhancedMarketAnalysisResult['priceRecommendation'] {
    const mileageAdjustment = mileageContext.adjustment || 0;

    const suggestedPrice = Math.round(summary.medianPrice + mileageAdjustment);
    const priceRange = {
      low: Math.round(percentiles.p25 + mileageAdjustment),
      high: Math.round(percentiles.p75 + mileageAdjustment)
    };

    let marketPosition: 'below_market' | 'at_market' | 'above_market' | 'competitive' = 'at_market';
    let reasoning = '';

    if (targetPrice) {
      if (targetPrice < percentiles.p25) {
        marketPosition = 'below_market';
        reasoning = `Your price of $${targetPrice.toLocaleString()} is below the 25th percentile ($${percentiles.p25.toLocaleString()}). This is very competitive and should sell quickly.`;
      } else if (targetPrice < percentiles.p50) {
        marketPosition = 'competitive';
        reasoning = `Your price of $${targetPrice.toLocaleString()} is between the 25th and 50th percentile. This is competitively priced.`;
      } else if (targetPrice <= percentiles.p75) {
        marketPosition = 'at_market';
        reasoning = `Your price of $${targetPrice.toLocaleString()} is at market average. Consider pricing at $${suggestedPrice.toLocaleString()} for faster sale.`;
      } else {
        marketPosition = 'above_market';
        reasoning = `Your price of $${targetPrice.toLocaleString()} is above the 75th percentile ($${percentiles.p75.toLocaleString()}). Consider reducing to $${suggestedPrice.toLocaleString()} to be more competitive.`;
      }
    } else {
      reasoning = `Based on ${summary.totalListings} comparable listings, we recommend pricing between $${priceRange.low.toLocaleString()} and $${priceRange.high.toLocaleString()}. The median market price is $${summary.medianPrice.toLocaleString()}.`;
    }

    const qualityScore = summary.averageQualityScore ?? 0;
    const similarityScore = summary.averageSimilarityScore ?? 0;
    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (summary.totalListings >= 20 && qualityScore >= 70 && similarityScore >= 70) {
      confidence = 'high';
    } else if (summary.totalListings >= 10 && qualityScore >= 55 && similarityScore >= 60) {
      confidence = 'medium';
    }

    if (mileageContext.marketAvgMileage && mileageContext.slopePerKm) {
      const direction = mileageAdjustment === 0 ? 'no mileage adjustment applied' : mileageAdjustment > 0 ? 'mileage-adjusted higher' : 'mileage-adjusted lower';
      reasoning += ` Mileage adjustment: ${direction} versus market average of ${mileageContext.marketAvgMileage.toLocaleString()} km.`;
    }

    return {
      suggestedPrice,
      priceRange,
      marketPosition,
      confidence,
      reasoning
    };
  }

  private async recordPriceHistory(dealershipId: number, listings: MarketListing[]): Promise<void> {
    const records: InsertPriceHistory[] = listings.slice(0, 50).map(l => ({
      dealershipId,
      marketListingId: l.id,
      externalId: l.externalId,
      source: l.source,
      year: l.year,
      make: l.make,
      model: l.model,
      trim: l.trim,
      price: l.price,
      mileage: l.mileage,
      location: l.location,
      sellerName: l.sellerName
    }));

    try {
      await storage.createPriceHistoryBatch(records);
    } catch (error) {
      console.error('[EnhancedMarketAnalysis] Price history recording error:', error);
    }
  }

  private async createSnapshot(
    dealershipId: number,
    params: EnhancedMarketAnalysisParams,
    summary: any,
    percentiles: PercentileBreakdown,
    daysOnMarket: DaysOnMarketInfo,
    sources: string[]
  ): Promise<void> {
    const snapshot: InsertMarketSnapshot = {
      dealershipId,
      snapshotDate: new Date(),
      make: params.make,
      model: params.model,
      yearMin: Math.min(...params.years),
      yearMax: Math.max(...params.years),
      totalListings: summary.totalListings,
      averagePrice: summary.averagePrice,
      medianPrice: summary.medianPrice,
      minPrice: summary.minPrice,
      maxPrice: summary.maxPrice,
      p10Price: percentiles.p10,
      p25Price: percentiles.p25,
      p75Price: percentiles.p75,
      p90Price: percentiles.p90,
      averageMileage: summary.averageMileage,
      averageDaysOnMarket: daysOnMarket.average,
      sources,
      searchRadiusKm: params.radiusKm,
      searchPostalCode: params.postalCode
    };

    try {
      await storage.createMarketSnapshot(snapshot);
    } catch (error) {
      console.error('[EnhancedMarketAnalysis] Snapshot creation error:', error);
    }
  }

  private createEmptyResult(params: EnhancedMarketAnalysisParams, sources: string[], errors: string[]): EnhancedMarketAnalysisResult {
    return {
      success: false,
      dataSource: 'none',
      searchParams: {
        make: params.make,
        model: params.model,
        years: params.years,
        location: params.postalCode,
        radiusKm: params.radiusKm
      },
      summary: {
        totalListings: 0,
        averagePrice: 0,
        medianPrice: 0,
        minPrice: 0,
        maxPrice: 0,
        averageMileage: 0,
        unweightedAveragePrice: 0,
        unweightedMedianPrice: 0,
        weightedAveragePrice: 0,
        weightedMedianPrice: 0,
        averageSimilarityScore: 0,
        averageDaysOnMarket: 0,
        averageQualityScore: 0,
        highQualityListings: 0
      },
      percentiles: { p10: 0, p25: 0, p50: 0, p75: 0, p90: 0 },
      daysOnMarket: {
        average: 0,
        median: 0,
        fastest: 0,
        slowest: 0,
        distribution: { under7Days: 0, under14Days: 0, under30Days: 0, over30Days: 0 }
      },
      competitors: [],
      comparisons: [],
      priceTrends: [],
      priceRecommendation: {
        suggestedPrice: 0,
        priceRange: { low: 0, high: 0 },
        marketPosition: 'at_market',
        confidence: 'low',
        reasoning: 'No market data found. Please try refreshing market data first.'
      },
      sources,
      sourceBreakdown: [],
      scrapedAt: new Date().toISOString(),
      errors: [...errors, 'No listings found matching your criteria']
    };
  }
}

export const enhancedMarketAnalysis = new EnhancedMarketAnalysisService();
