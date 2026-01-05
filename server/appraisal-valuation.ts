type PriceRange = { low: number; high: number };

type MarketAnalysisPayload = {
  summary?: {
    averagePrice?: number;
    medianPrice?: number;
    minPrice?: number;
    maxPrice?: number;
  };
  percentiles?: {
    p10?: number;
    p25?: number;
    p50?: number;
    p75?: number;
    p90?: number;
  };
  priceRecommendation?: {
    suggestedPrice?: number;
    priceRange?: PriceRange;
  };
  priceRange?: PriceRange;
  comparisons?: Array<{
    listingUrl?: string;
    dealership?: string;
    sellerName?: string;
    price?: number;
    daysOnLot?: number;
    source?: string;
  }>;
  daysOnMarket?: {
    average?: number;
  } | null;
  marketVelocity?: {
    avgDaysOnMarket?: number;
  } | null;
};

const formatRange = (range: PriceRange) => {
  const low = range.low || 0;
  const high = range.high || 0;
  if (!low || !high) return undefined;
  return `$${low.toLocaleString('en-CA')} - $${high.toLocaleString('en-CA')}`;
};

const toNumber = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);

export function deriveAppraisalFieldsFromMarketData(marketData: MarketAnalysisPayload) {
  const summary = marketData.summary || {};
  const priceRecommendation = marketData.priceRecommendation || {};
  const fallbackMedian = toNumber(summary.medianPrice) || toNumber(summary.averagePrice) || 0;

  const percentiles = {
    p10: toNumber(marketData.percentiles?.p10),
    p25: toNumber(marketData.percentiles?.p25),
    p50: toNumber(marketData.percentiles?.p50) || fallbackMedian,
    p75: toNumber(marketData.percentiles?.p75),
    p90: toNumber(marketData.percentiles?.p90)
  };

  const range: PriceRange = priceRecommendation.priceRange
    || marketData.priceRange
    || {
      low: percentiles.p25 || fallbackMedian,
      high: percentiles.p75 || fallbackMedian
    };

  const retailValue = Math.round(toNumber(priceRecommendation.suggestedPrice) || percentiles.p50 || fallbackMedian || 0);
  const tradeinValue = Math.round(percentiles.p25 || retailValue * 0.85);
  const wholesaleValue = Math.round(percentiles.p10 || tradeinValue * 0.9);
  const askingPrice = Math.round(range.high || retailValue * 1.05);

  const averageMarketPrice = Math.round((toNumber(summary.averagePrice) || percentiles.p50 || retailValue || 0) * 100);
  const marketPriceRange = formatRange(range);

  const daysOnMarketAvg = Math.round(
    toNumber(marketData.daysOnMarket?.average)
    || toNumber(marketData.marketVelocity?.avgDaysOnMarket)
    || 0
  );

  const competitorListings = Array.isArray(marketData.comparisons)
    ? marketData.comparisons
        .filter(item => item.listingUrl && item.price)
        .slice(0, 5)
        .map(item => ({
          url: item.listingUrl,
          dealer: item.dealership || item.sellerName || 'Unknown',
          price: item.price,
          daysOnLot: item.daysOnLot ?? null,
          source: item.source ?? null
        }))
    : [];

  return {
    marketAnalysisData: JSON.stringify(marketData),
    averageMarketPrice,
    marketPriceRange,
    retailValue: retailValue * 100,
    tradeinValue: tradeinValue * 100,
    wholesaleValue: wholesaleValue * 100,
    askingPrice: askingPrice * 100,
    daysOnMarketAvg: daysOnMarketAvg || null,
    competitorListings: competitorListings.length > 0 ? JSON.stringify(competitorListings) : null
  };
}
