import type { AdTemplate, Vehicle } from "@shared/schema";
import { DEFAULT_MARKETPLACE_COMPLIANCE_FOOTER, buildMarketplaceListingDraft, type MarketplaceTemplate } from "./marketplace-utils";
import { generateMarketplaceContent } from "./openai";

const DEFAULT_TEMPLATE: MarketplaceTemplate = {
  titleTemplate: "{year} {make} {model} - ${price}",
  descriptionTemplate: "Check out this {year} {make} {model}! Only {mileage} km. Contact us today!",
};

type BundleBuildOptions = {
  template?: AdTemplate | null;
  templateOverride?: MarketplaceTemplate | null;
  useAi?: boolean;
  pageDmLink?: string | null;
  includePageDmCta?: boolean;
  includeComplianceFooter?: boolean;
  complianceFooter?: string | null;
};

type BundleCopy = {
  title: string;
  description: string;
};

function formatNumber(value?: number | null): string {
  if (!value) return "0";
  return value.toLocaleString();
}

function buildDescriptionWithFooter(params: {
  baseDescription: string;
  pageDmLink?: string | null;
  includePageDmCta?: boolean;
  includeComplianceFooter?: boolean;
  complianceFooter?: string | null;
}): string {
  const base = params.baseDescription.trim();
  const ctaLink = params.pageDmLink?.trim();
  const ctaBlock = params.includePageDmCta && ctaLink
    ? `Fastest response: message our dealership page here: ${ctaLink}\nInclude stock # or VIN.`
    : "";
  const footer = params.includeComplianceFooter
    ? (params.complianceFooter || DEFAULT_MARKETPLACE_COMPLIANCE_FOOTER).trim()
    : "";

  return [base, ctaBlock, footer].filter(Boolean).join("\n\n");
}

function toHashtag(input?: string | null): string | null {
  if (!input) return null;
  const cleaned = input.replace(/[^a-zA-Z0-9]/g, "");
  if (!cleaned) return null;
  return `#${cleaned}`;
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

function buildFeatures(vehicle: Vehicle): string[] {
  const features: string[] = [];

  if (vehicle.badges?.length) {
    features.push(...vehicle.badges.slice(0, 8));
  }

  if (vehicle.odometer) {
    features.push(`Odometer: ${formatNumber(vehicle.odometer)} km`);
  }

  if (vehicle.exteriorColor) {
    features.push(`Exterior: ${vehicle.exteriorColor}`);
  }

  if (vehicle.interiorColor) {
    features.push(`Interior: ${vehicle.interiorColor}`);
  }

  if (vehicle.stockNumber) {
    features.push(`Stock #: ${vehicle.stockNumber}`);
  }

  if (vehicle.carfaxUrl) {
    features.push("Carfax available");
  }

  return dedupe(features).slice(0, 10);
}

function buildHashtags(vehicle: Vehicle): string[] {
  const baseTags = [
    toHashtag(`${vehicle.year}${vehicle.make}${vehicle.model}`),
    toHashtag(`${vehicle.make}${vehicle.model}`),
    toHashtag(vehicle.make),
    toHashtag(vehicle.model),
    toHashtag(vehicle.type),
    toHashtag(vehicle.location),
    "#UsedCars",
    "#CarForSale",
  ].filter(Boolean) as string[];

  return dedupe(baseTags).slice(0, 12);
}

async function buildBundleCopy(params: {
  vehicle: Vehicle;
  dealershipId: number;
  options: BundleBuildOptions;
}): Promise<BundleCopy> {
  const { vehicle, dealershipId, options } = params;
  const fallbackTitle = `${vehicle.year} ${vehicle.make} ${vehicle.model} - $${formatNumber(vehicle.price)}`;
  const fallbackDescription = `Check out this ${vehicle.year} ${vehicle.make} ${vehicle.model}. Contact us for details.`;

  if (options.useAi) {
    const templates = await generateMarketplaceContent(
      {
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        trim: vehicle.trim,
        type: vehicle.type,
        price: vehicle.price,
        odometer: vehicle.odometer,
        badges: vehicle.badges || [],
        description: vehicle.description,
        location: vehicle.location,
        dealership: vehicle.dealership,
        vin: vehicle.vin || undefined,
        carfaxUrl: vehicle.carfaxUrl || undefined,
      },
      dealershipId
    );

    const title = templates.marketplace?.title?.trim() || fallbackTitle;
    const baseDescription = templates.marketplace?.description?.trim() || fallbackDescription;
    const description = buildDescriptionWithFooter({
      baseDescription,
      pageDmLink: options.pageDmLink || null,
      includePageDmCta: options.includePageDmCta,
      includeComplianceFooter: options.includeComplianceFooter,
      complianceFooter: options.complianceFooter,
    });

    return { title, description };
  }

  const override = options.templateOverride;
  const resolvedTemplate: MarketplaceTemplate = override
    ? {
        titleTemplate: override.titleTemplate || DEFAULT_TEMPLATE.titleTemplate,
        descriptionTemplate: override.descriptionTemplate || DEFAULT_TEMPLATE.descriptionTemplate,
      }
    : {
        titleTemplate: options.template?.titleTemplate || DEFAULT_TEMPLATE.titleTemplate,
        descriptionTemplate: options.template?.descriptionTemplate || DEFAULT_TEMPLATE.descriptionTemplate,
      };

  const listingDraft = buildMarketplaceListingDraft(vehicle, resolvedTemplate, {
    ctaLink: options.includePageDmCta ? options.pageDmLink : null,
    complianceFooter: options.complianceFooter || DEFAULT_MARKETPLACE_COMPLIANCE_FOOTER,
    includeComplianceFooter: options.includeComplianceFooter !== false,
  });

  return { title: listingDraft.title, description: listingDraft.description };
}

export async function buildListingBundlePayload(params: {
  vehicle: Vehicle;
  dealershipId: number;
  userId: number;
  options: BundleBuildOptions;
}): Promise<{
  title: string;
  description: string;
  price: number;
  features: string[];
  hashtags: string[];
  imageUrls: string[];
}> {
  const { vehicle, dealershipId, userId, options } = params;
  const { title, description } = await buildBundleCopy({ vehicle, dealershipId, options });

  return {
    title,
    description,
    price: vehicle.price,
    features: buildFeatures(vehicle),
    hashtags: buildHashtags(vehicle),
    imageUrls: (vehicle.images || []).filter(Boolean).slice(0, 10),
  };
}
