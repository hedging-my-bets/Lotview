import { facebookService } from "./facebook-service";
import type { MarketplaceListingDraft } from "./marketplace-utils";

export type MarketplacePublisherProvider = "manual_assist" | "meta_partner";

export class MarketplaceAutomationError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export interface MarketplacePublisher {
  provider: MarketplacePublisherProvider;
  isEnabled(): boolean;
  createListing(params: { accessToken: string; listing: MarketplaceListingDraft }): Promise<{ listingId: string }>;
  updateListing?(params: { accessToken: string; listingId: string; listing: MarketplaceListingDraft }): Promise<void>;
  deleteListing(params: { accessToken: string; listingId: string }): Promise<void>;
}

class ManualAssistPublisher implements MarketplacePublisher {
  provider: MarketplacePublisherProvider = "manual_assist";

  isEnabled(): boolean {
    return false;
  }

  async createListing(): Promise<{ listingId: string }> {
    throw new MarketplaceAutomationError(
      "PARTNER_REQUIRED",
      "Marketplace Partner approval is required for auto-posting."
    );
  }

  async deleteListing(): Promise<void> {
    throw new MarketplaceAutomationError(
      "PARTNER_REQUIRED",
      "Marketplace Partner approval is required for auto-removal."
    );
  }
}

class MetaPartnerPublisher implements MarketplacePublisher {
  provider: MarketplacePublisherProvider = "meta_partner";

  isEnabled(): boolean {
    return true;
  }

  async createListing(params: { accessToken: string; listing: MarketplaceListingDraft }): Promise<{ listingId: string }> {
    const result = await facebookService.postMarketplaceListing(params.accessToken, params.listing);
    return { listingId: result.postId };
  }

  async updateListing(): Promise<void> {
    throw new MarketplaceAutomationError("NOT_IMPLEMENTED", "Marketplace update is not implemented yet.");
  }

  async deleteListing(params: { accessToken: string; listingId: string }): Promise<void> {
    await facebookService.deleteMarketplaceListing(params.accessToken, params.listingId);
  }
}

function createMarketplacePublisher(): MarketplacePublisher {
  const automationEnabled = process.env.MARKETPLACE_AUTOMATION_ENABLED === "true";
  const partnerApproved = process.env.MARKETPLACE_PARTNER_APPROVED === "true";
  const provider = (process.env.MARKETPLACE_PUBLISHER_PROVIDER || "meta_partner") as MarketplacePublisherProvider;

  if (!automationEnabled || !partnerApproved) {
    return new ManualAssistPublisher();
  }

  if (provider === "meta_partner") {
    return new MetaPartnerPublisher();
  }

  return new ManualAssistPublisher();
}

export const marketplacePublisher = createMarketplacePublisher();
