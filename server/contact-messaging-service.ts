import { storage } from './storage';
import { facebookService } from './facebook-service';
import type { CrmContact, CrmMessage, InsertCrmMessage, InsertCrmActivity } from '@shared/schema';

interface SendMessageParams {
  dealershipId: number;
  contactId: number;
  channel: 'email' | 'sms' | 'facebook';
  content: string;
  subject?: string;
  sentById?: number;
  aiGenerated?: boolean;
  aiPromptUsed?: string;
}

interface SendMessageResult {
  success: boolean;
  messageId?: number;
  externalMessageId?: string;
  error?: string;
}

interface AIMessageSuggestionParams {
  dealershipId: number;
  contactId: number;
  channel: 'email' | 'sms' | 'facebook';
  context?: string;
}

export function createContactMessagingService(dealershipId: number) {
  
  async function sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
    const { contactId, channel, content, subject, sentById, aiGenerated, aiPromptUsed } = params;
    
    const contact = await storage.getCrmContactById(contactId, dealershipId);
    if (!contact) {
      return { success: false, error: 'Contact not found' };
    }
    
    let recipientEmail: string | undefined;
    let recipientPhone: string | undefined;
    let recipientFacebookId: string | undefined;
    
    if (channel === 'email') {
      if (!contact.email) {
        return { success: false, error: 'Contact has no email address' };
      }
      if (!contact.optInEmail) {
        return { success: false, error: 'Contact has opted out of email communications' };
      }
      recipientEmail = contact.email;
    } else if (channel === 'sms') {
      if (!contact.phone) {
        return { success: false, error: 'Contact has no phone number' };
      }
      if (!contact.optInSms) {
        return { success: false, error: 'Contact has opted out of SMS communications' };
      }
      recipientPhone = contact.phone;
    } else if (channel === 'facebook') {
      if (!contact.facebookId) {
        return { success: false, error: 'Contact has no Facebook ID' };
      }
      if (!contact.optInFacebook) {
        return { success: false, error: 'Contact has opted out of Facebook messages' };
      }
      recipientFacebookId = contact.facebookId;
    }
    
    const messageData: InsertCrmMessage = {
      dealershipId,
      contactId,
      sentById: sentById || null,
      channel,
      subject: subject || null,
      content,
      recipientEmail: recipientEmail || null,
      recipientPhone: recipientPhone || null,
      recipientFacebookId: recipientFacebookId || null,
      status: 'pending',
      aiGenerated: aiGenerated || false,
      aiPromptUsed: aiPromptUsed || null,
    };
    
    const message = await storage.createCrmMessage(messageData);
    
    let externalMessageId: string | undefined;
    let sendError: string | undefined;
    
    try {
      if (channel === 'email') {
        const result = await sendEmailMessage(dealershipId, recipientEmail!, subject || '', content);
        if (result.success) {
          externalMessageId = result.messageId;
        } else {
          sendError = result.error;
        }
      } else if (channel === 'sms') {
        const result = await sendSmsMessage(dealershipId, recipientPhone!, content);
        if (result.success) {
          externalMessageId = result.messageId;
        } else {
          sendError = result.error;
        }
      } else if (channel === 'facebook') {
        const result = await sendFacebookMessage(dealershipId, contact, content);
        if (result.success) {
          externalMessageId = result.messageId;
        } else {
          sendError = result.error;
        }
      }
      
      if (externalMessageId) {
        await storage.updateCrmMessage(message.id, dealershipId, {
          status: 'sent',
          externalMessageId,
          sentAt: new Date(),
        });
        
        const activityData: InsertCrmActivity = {
          dealershipId,
          contactId,
          userId: sentById || null,
          activityType: channel,
          direction: 'outbound',
          subject: subject || null,
          content,
          status: 'completed',
          deliveryStatus: 'sent',
          messageId: externalMessageId,
        };
        await storage.createCrmActivity(activityData);
        
        await storage.updateCrmContact(contactId, dealershipId, {
          lastContactedAt: new Date(),
          totalMessagesSent: (contact.totalMessagesSent || 0) + 1,
        });
        
        return { success: true, messageId: message.id, externalMessageId };
      } else {
        await storage.updateCrmMessage(message.id, dealershipId, {
          status: 'failed',
          errorMessage: sendError || 'Unknown error',
        });
        
        return { success: false, messageId: message.id, error: sendError };
      }
    } catch (error: any) {
      console.error(`[ContactMessaging] Error sending ${channel} message:`, error);
      
      await storage.updateCrmMessage(message.id, dealershipId, {
        status: 'failed',
        errorMessage: error.message || 'Unexpected error',
      });
      
      return { success: false, messageId: message.id, error: error.message };
    }
  }
  
  async function sendEmailMessage(
    dealershipId: number,
    recipientEmail: string,
    subject: string,
    content: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
      
      if (!SENDGRID_API_KEY) {
        console.warn('[ContactMessaging] SendGrid API key not configured - simulating email send');
        return { success: true, messageId: `sim_email_${Date.now()}` };
      }
      
      const dealership = await storage.getDealershipById(dealershipId);
      
      const fromEmail = 'noreply@lotview.ai';
      const fromName = dealership?.name || 'Lotview';
      
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: recipientEmail }] }],
          from: { email: fromEmail, name: fromName },
          subject: subject || 'Message from ' + fromName,
          content: [{ type: 'text/plain', value: content }],
        }),
      });
      
      if (response.ok || response.status === 202) {
        const messageId = response.headers.get('X-Message-Id') || `sg_${Date.now()}`;
        return { success: true, messageId };
      } else {
        const errorBody = await response.text();
        console.error('[ContactMessaging] SendGrid error:', response.status, errorBody);
        return { success: false, error: `SendGrid error: ${response.status}` };
      }
    } catch (error: any) {
      console.error('[ContactMessaging] Email send error:', error);
      return { success: false, error: error.message };
    }
  }
  
  async function sendSmsMessage(
    dealershipId: number,
    recipientPhone: string,
    content: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
      const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
      const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
      
      if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
        console.warn('[ContactMessaging] Twilio not configured - simulating SMS send');
        return { success: true, messageId: `sim_sms_${Date.now()}` };
      }
      
      const normalizedPhone = recipientPhone.replace(/\D/g, '');
      const e164Phone = normalizedPhone.startsWith('1') 
        ? `+${normalizedPhone}` 
        : `+1${normalizedPhone}`;
      
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            From: TWILIO_PHONE_NUMBER,
            To: e164Phone,
            Body: content,
          }),
        }
      );
      
      if (response.ok) {
        const result = await response.json();
        return { success: true, messageId: result.sid };
      } else {
        const errorBody = await response.json();
        console.error('[ContactMessaging] Twilio error:', errorBody);
        return { success: false, error: errorBody.message || 'Twilio error' };
      }
    } catch (error: any) {
      console.error('[ContactMessaging] SMS send error:', error);
      return { success: false, error: error.message };
    }
  }
  
  async function sendFacebookMessage(
    dealershipId: number,
    contact: CrmContact,
    content: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      if (!contact.facebookId) {
        return { success: false, error: 'Contact has no Facebook ID' };
      }
      
      const conversations = await storage.getMessengerConversationsByContactFacebookId(
        dealershipId,
        contact.facebookId
      );
      
      if (!conversations || conversations.length === 0) {
        return { success: false, error: 'No Facebook Messenger conversation found for this contact' };
      }
      
      const conversation = conversations[0];
      
      // Get the Facebook account to get the page access token
      const facebookAccount = await storage.getFacebookAccountById(conversation.facebookAccountId);
      if (!facebookAccount || !facebookAccount.pageAccessToken) {
        return { success: false, error: 'Facebook page access token not available' };
      }
      
      const result = await facebookService.sendMessengerMessage(
        facebookAccount.pageAccessToken,
        contact.facebookId,
        content
      );
      
      if (result.messageId) {
        await storage.updateMessengerConversation(conversation.id, dealershipId, {
          lastMessage: `You: ${content.substring(0, 200)}`,
          lastMessageAt: new Date(),
        });
        
        return { success: true, messageId: result.messageId };
      } else {
        return { success: false, error: 'Failed to send Facebook message' };
      }
    } catch (error: any) {
      console.error('[ContactMessaging] Facebook send error:', error);
      return { success: false, error: error.message };
    }
  }
  
  async function generateAiMessageSuggestion(
    params: AIMessageSuggestionParams
  ): Promise<{ success: boolean; suggestion?: string; error?: string }> {
    const { contactId, channel, context } = params;
    
    try {
      const contact = await storage.getCrmContactById(contactId, dealershipId);
      if (!contact) {
        return { success: false, error: 'Contact not found' };
      }
      
      const activities = await storage.getCrmActivities(contactId, dealershipId, 5);
      
      const dealership = await storage.getDealershipById(dealershipId);
      const dealershipName = dealership?.name || 'our dealership';
      
      let vehicleContext = '';
      if (contact.interestedVehicleIds) {
        try {
          const vehicleIds = JSON.parse(contact.interestedVehicleIds);
          if (vehicleIds.length > 0) {
            const vehicle = await storage.getVehicleById(vehicleIds[0], dealershipId);
            if (vehicle) {
              vehicleContext = `\nThey were interested in a ${vehicle.year} ${vehicle.make} ${vehicle.model} priced at $${vehicle.price.toLocaleString()}.`;
            }
          }
        } catch (e) {
        }
      }
      
      const recentActivitySummary = activities.slice(0, 3).map(a => 
        `${a.activityType} (${a.direction || 'n/a'}) - ${a.content?.substring(0, 50) || 'no content'}`
      ).join('\n');
      
      const prompt = `You are a professional automotive sales assistant for ${dealershipName}. Write a personalized ${channel} message for a customer.

Customer: ${contact.firstName} ${contact.lastName || ''}
Status: ${contact.status}
Lead Source: ${contact.leadSource || 'unknown'}
Preferred Contact: ${contact.preferredContactMethod || 'any'}
${vehicleContext}

Recent interactions:
${recentActivitySummary || 'No recent activity'}

${context ? `Additional context: ${context}` : ''}

Write a warm, professional message appropriate for ${channel}. Keep it:
- ${channel === 'sms' ? 'Under 160 characters, casual but professional' : ''}
- ${channel === 'email' ? 'Professional with a clear subject line implied' : ''}
- ${channel === 'facebook' ? 'Friendly and conversational' : ''}

Only output the message content, nothing else.`;

      const { generateChatResponse } = await import('./openai');
      const messages = [{ role: 'user' as const, content: prompt }];
      
      const response = await generateChatResponse(messages, dealershipId);
      
      if (response && typeof response === 'object' && 'content' in response) {
        return { success: true, suggestion: (response as any).content?.trim() || '' };
      } else if (typeof response === 'string') {
        return { success: true, suggestion: response.trim() };
      } else {
        return { success: false, error: 'AI did not generate a response' };
      }
    } catch (error: any) {
      console.error('[ContactMessaging] AI suggestion error:', error);
      return { success: false, error: error.message };
    }
  }
  
  return {
    sendMessage,
    generateAiMessageSuggestion,
  };
}
