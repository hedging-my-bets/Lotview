import type { Vehicle } from '@shared/schema';

interface FacebookConfig {
  appId: string;
  appSecret: string;
  redirectUri: string;
}

interface FacebookAccount {
  id: number;
  accessToken?: string;
  facebookUserId?: string;
}

interface PostingTemplate {
  titleTemplate: string;
  descriptionTemplate: string;
}

export class FacebookService {
  private config: FacebookConfig;

  constructor() {
    this.config = {
      appId: process.env.FACEBOOK_APP_ID || 'YOUR_FACEBOOK_APP_ID',
      appSecret: process.env.FACEBOOK_APP_SECRET || 'YOUR_FACEBOOK_APP_SECRET',
      redirectUri: process.env.FACEBOOK_REDIRECT_URI || 'https://your-domain.replit.app/api/facebook/oauth/callback'
    };
  }

  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.appId,
      redirect_uri: this.config.redirectUri,
      state,
      scope: 'pages_manage_posts,pages_read_engagement,catalog_management',
      response_type: 'code'
    });

    return `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string): Promise<{ accessToken: string; expiresIn: number }> {
    const params = new URLSearchParams({
      client_id: this.config.appId,
      client_secret: this.config.appSecret,
      redirect_uri: this.config.redirectUri,
      code
    });

    const response = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token?${params.toString()}`);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to exchange code for token');
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in
    };
  }

  async getUserInfo(accessToken: string): Promise<{ id: string; name: string }> {
    const response = await fetch(`https://graph.facebook.com/v18.0/me?access_token=${accessToken}`);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to get user info');
    }

    return response.json();
  }

  async getLongLivedToken(shortLivedToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: this.config.appId,
      client_secret: this.config.appSecret,
      fb_exchange_token: shortLivedToken
    });

    const response = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token?${params.toString()}`);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to get long-lived token');
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in
    };
  }

  private replaceTemplateVariables(template: string, vehicle: Vehicle): string {
    return template
      .replace(/{price}/g, vehicle.price?.toString() || '0')
      .replace(/{year}/g, vehicle.year.toString())
      .replace(/{make}/g, vehicle.make)
      .replace(/{model}/g, vehicle.model)
      .replace(/{trim}/g, vehicle.trim || '')
      .replace(/{odometer}/g, vehicle.odometer?.toString() || '0');
  }

  async postToMarketplace(
    accessToken: string,
    vehicle: Vehicle,
    template: PostingTemplate
  ): Promise<{ postId: string }> {
    const title = this.replaceTemplateVariables(template.titleTemplate, vehicle);
    const description = this.replaceTemplateVariables(template.descriptionTemplate, vehicle);

    const formData = new FormData();
    formData.append('access_token', accessToken);
    formData.append('title', title);
    formData.append('description', description);
    formData.append('price', vehicle.price?.toString() || '0');
    formData.append('currency', 'CAD');
    formData.append('availability', 'in stock');
    
    if (vehicle.images && vehicle.images.length > 0) {
      formData.append('images[0][url]', vehicle.images[0]);
    }

    const response = await fetch('https://graph.facebook.com/v18.0/me/marketplace_listings', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to post to Marketplace');
    }

    const data = await response.json();
    return { postId: data.id };
  }

  async deleteMarketplaceListing(accessToken: string, postId: string): Promise<void> {
    const response = await fetch(`https://graph.facebook.com/v18.0/${postId}?access_token=${accessToken}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to delete listing');
    }
  }

  isConfigured(): boolean {
    return (
      this.config.appId !== 'YOUR_FACEBOOK_APP_ID' &&
      this.config.appSecret !== 'YOUR_FACEBOOK_APP_SECRET' &&
      this.config.redirectUri !== 'https://your-domain.replit.app/api/facebook/oauth/callback'
    );
  }
}

export const facebookService = new FacebookService();
