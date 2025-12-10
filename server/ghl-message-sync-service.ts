import { storage } from "./storage";
import { createGhlApiService } from "./ghl-api-service";
import type { MessengerConversation, MessengerMessage } from "@shared/schema";

export class GhlMessageSyncService {
  private dealershipId: number;

  constructor(dealershipId: number) {
    this.dealershipId = dealershipId;
  }

  async syncMessageToGhl(
    conversation: MessengerConversation & { ghlConversationId?: string | null; ghlContactId?: string | null },
    message: string,
    senderName: string
  ): Promise<{ success: boolean; ghlMessageId?: string; error?: string }> {
    try {
      const ghlService = createGhlApiService(this.dealershipId);

      if (!conversation.ghlConversationId || !conversation.ghlContactId) {
        const linkResult = await this.linkConversationToGhl(conversation);
        if (!linkResult.success) {
          console.log(`[GHL Sync] Could not link conversation ${conversation.id} to GHL:`, linkResult.error);
          return { success: false, error: linkResult.error };
        }
        conversation.ghlConversationId = linkResult.ghlConversationId ?? null;
        conversation.ghlContactId = linkResult.ghlContactId ?? null;
      }

      const result = await ghlService.sendMessage(conversation.ghlConversationId!, {
        type: 'FB',
        message: message,
      });

      if (result.success && result.data) {
        console.log(`[GHL Sync] Message synced to GHL for conversation ${conversation.id}`);
        return { success: true, ghlMessageId: result.data.id };
      }

      console.error(`[GHL Sync] Failed to send message to GHL:`, result.error);
      return { success: false, error: result.error };
    } catch (error: any) {
      console.error(`[GHL Sync] Error syncing message to GHL:`, error);
      return { success: false, error: error.message };
    }
  }

  async linkConversationToGhl(
    conversation: MessengerConversation
  ): Promise<{ success: boolean; ghlConversationId?: string; ghlContactId?: string; error?: string }> {
    try {
      const ghlService = createGhlApiService(this.dealershipId);

      const searchResult = await ghlService.searchContacts({
        query: conversation.participantName,
        limit: 5,
      });

      let ghlContactId: string | undefined;

      if (searchResult.success && searchResult.data?.contacts?.length) {
        ghlContactId = searchResult.data.contacts[0].id;
      } else {
        const createResult = await ghlService.createContact({
          name: conversation.participantName,
          firstName: conversation.participantName.split(' ')[0],
          lastName: conversation.participantName.split(' ').slice(1).join(' ') || undefined,
          source: 'Facebook Messenger',
          tags: ['Facebook Lead', 'Lotview Sync'],
        });

        if (!createResult.success || !createResult.data) {
          return { success: false, error: createResult.error || 'Failed to create GHL contact' };
        }

        ghlContactId = createResult.data.id;
      }

      const conversationResult = await ghlService.getOrCreateConversation(ghlContactId, 'TYPE_FB_MESSENGER');

      if (!conversationResult.success || !conversationResult.data) {
        return { success: false, error: conversationResult.error || 'Failed to create GHL conversation' };
      }

      await storage.updateMessengerConversation(conversation.id, this.dealershipId, {
        ghlConversationId: conversationResult.data.id,
        ghlContactId: ghlContactId,
        lastGhlSyncAt: new Date(),
      } as any);

      console.log(`[GHL Sync] Linked conversation ${conversation.id} to GHL contact ${ghlContactId} and conversation ${conversationResult.data.id}`);

      return {
        success: true,
        ghlConversationId: conversationResult.data.id,
        ghlContactId: ghlContactId,
      };
    } catch (error: any) {
      console.error(`[GHL Sync] Error linking conversation to GHL:`, error);
      return { success: false, error: error.message };
    }
  }

  async handleInboundGhlMessage(webhookData: {
    conversationId: string;
    contactId: string;
    locationId: string;
    body: string;
    messageId: string;
    direction: 'inbound' | 'outbound';
    dateAdded: string;
    type: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const existingMessage = await storage.getMessengerMessageByGhlId(this.dealershipId, webhookData.messageId);
      if (existingMessage) {
        console.log(`[GHL Sync] Message ${webhookData.messageId} already exists, skipping`);
        return { success: true };
      }

      const conversation = await storage.getMessengerConversationByGhlId(
        this.dealershipId,
        webhookData.conversationId
      );

      if (!conversation) {
        console.log(`[GHL Sync] No matching Lotview conversation for GHL conversation ${webhookData.conversationId}`);
        return { success: false, error: 'No matching conversation' };
      }

      const ghlService = createGhlApiService(this.dealershipId);
      let senderName = 'Unknown';

      if (webhookData.direction === 'inbound') {
        const contactResult = await ghlService.getContact(webhookData.contactId);
        if (contactResult.success && contactResult.data) {
          senderName = contactResult.data.name || contactResult.data.firstName || 'Customer';
        }
      } else {
        senderName = 'Sales Team';
      }

      const newMessage = await storage.createMessengerMessage({
        dealershipId: this.dealershipId,
        conversationId: conversation.id,
        facebookMessageId: `ghl_${webhookData.messageId}`,
        senderId: webhookData.direction === 'inbound' ? webhookData.contactId : 'dealership',
        senderName: senderName,
        isFromCustomer: webhookData.direction === 'inbound',
        content: webhookData.body,
        isRead: webhookData.direction === 'outbound',
        sentAt: new Date(webhookData.dateAdded),
        ghlMessageId: webhookData.messageId,
        syncSource: 'ghl',
      });

      await storage.updateMessengerConversation(conversation.id, this.dealershipId, {
        lastMessage: webhookData.direction === 'inbound'
          ? webhookData.body.substring(0, 200)
          : `You: ${webhookData.body.substring(0, 200)}`,
        lastMessageAt: new Date(webhookData.dateAdded),
        unreadCount: webhookData.direction === 'inbound' ? (conversation.unreadCount || 0) + 1 : conversation.unreadCount,
        lastGhlSyncAt: new Date(),
      } as any);

      console.log(`[GHL Sync] Created message from GHL webhook for conversation ${conversation.id}`);

      return { success: true };
    } catch (error: any) {
      console.error(`[GHL Sync] Error handling inbound GHL message:`, error);
      return { success: false, error: error.message };
    }
  }
}

export function createGhlMessageSyncService(dealershipId: number): GhlMessageSyncService {
  return new GhlMessageSyncService(dealershipId);
}
