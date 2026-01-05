import type { Vehicle } from "@shared/schema";

export type MarketplaceTemplate = {
  titleTemplate: string;
  descriptionTemplate: string;
};

export type MarketplaceListingDraft = {
  title: string;
  description: string;
  price: number;
  currency: string;
  availability: string;
  images: string[];
};

export const DEFAULT_MARKETPLACE_COMPLIANCE_FOOTER =
  "Availability and price subject to change. Taxes and fees extra. Confirm details with our team.";

function renderTemplate(template: string, vehicle: Vehicle): string {
  const replacements: Record<string, string> = {
    "{price}": vehicle.price?.toString() || "0",
    "${price}": vehicle.price ? `$${vehicle.price.toLocaleString()}` : "$0",
    "{year}": vehicle.year?.toString() || "",
    "{make}": vehicle.make || "",
    "{model}": vehicle.model || "",
    "{trim}": vehicle.trim || "",
    "{odometer}": vehicle.odometer?.toString() || "",
    "{mileage}": vehicle.odometer?.toLocaleString() || "",
    "{location}": vehicle.location || "",
    "{carfaxUrl}": vehicle.carfaxUrl || "",
  };

  let result = template;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(key.replace(/[{}$]/g, "\\$&"), "g"), value);
  }
  return result;
}

export function buildMarketplaceListingDraft(
  vehicle: Vehicle,
  template: MarketplaceTemplate,
  options?: {
    ctaLink?: string | null;
    complianceFooter?: string | null;
    includeComplianceFooter?: boolean;
  }
): MarketplaceListingDraft {
  const title = renderTemplate(template.titleTemplate, vehicle).trim();
  const descriptionBase = renderTemplate(template.descriptionTemplate, vehicle).trim();

  const ctaLink = options?.ctaLink?.trim();
  const ctaBlock = ctaLink
    ? `Fastest response: message our dealership page here: ${ctaLink}\nInclude stock # or VIN.`
    : "";

  const includeFooter = options?.includeComplianceFooter !== false;
  const footer = (options?.complianceFooter ?? DEFAULT_MARKETPLACE_COMPLIANCE_FOOTER).trim();

  const fallbackTitle = `${vehicle.year} ${vehicle.make} ${vehicle.model} - $${
    vehicle.price ? vehicle.price.toLocaleString() : "0"
  }`;
  const fallbackDescription = `Check out this ${vehicle.year} ${vehicle.make} ${vehicle.model}. Contact us for details.`;

  const description = [descriptionBase || fallbackDescription, ctaBlock, includeFooter ? footer : ""]
    .filter(Boolean)
    .join("\n\n");

  return {
    title: title || fallbackTitle,
    description,
    price: vehicle.price || 0,
    currency: "CAD",
    availability: "in stock",
    images: (vehicle.images || []).filter(Boolean),
  };
}
