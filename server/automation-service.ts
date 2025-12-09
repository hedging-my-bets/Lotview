import { storage } from "./storage";
import { createGhlApiService, type GhlApiResponse } from "./ghl-api-service";
import type { 
  FollowUpSequence, 
  FollowUpQueue, 
  InsertFollowUpQueue,
  InsertAutomationLog,
  Dealership 
} from "@shared/schema";

interface SequenceStep {
  stepNumber: number;
  delayMinutes: number;
  messageType: 'sms' | 'email';
  templateText: string;
}

interface GhlSendMessageResponse {
  conversationId?: string;
  messageId?: string;
  message?: string;
}

export class AutomationService {
  private dealershipId: number;
  private ghlService: ReturnType<typeof createGhlApiService>;

  constructor(dealershipId: number) {
    this.dealershipId = dealershipId;
    this.ghlService = createGhlApiService(dealershipId);
  }

  async sendSMS(contactId: string, message: string): Promise<GhlApiResponse<GhlSendMessageResponse>> {
    const account = await storage.getGhlAccountByDealership(this.dealershipId);
    if (!account) {
      return { success: false, error: "No GHL account connected", errorCode: "NO_ACCOUNT" };
    }

    const tokenValid = await this.ensureValidToken();
    if (!tokenValid) {
      return { success: false, error: "Token refresh failed", errorCode: "TOKEN_EXPIRED" };
    }

    const refreshedAccount = await storage.getGhlAccountByDealership(this.dealershipId);
    if (!refreshedAccount) {
      return { success: false, error: "Account not found after refresh", errorCode: "NO_ACCOUNT" };
    }

    try {
      const response = await fetch("https://services.leadconnectorhq.com/conversations/messages", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${refreshedAccount.accessToken}`,
          "Content-Type": "application/json",
          "Version": "2021-07-28",
        },
        body: JSON.stringify({
          type: "SMS",
          contactId: contactId,
          message: message,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Automation] SMS send failed: ${response.status} - ${errorText}`);
        return { success: false, error: errorText, errorCode: `HTTP_${response.status}` };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Automation] SMS send error:`, error);
      return { success: false, error: errorMessage, errorCode: "NETWORK_ERROR" };
    }
  }

  private async ensureValidToken(): Promise<boolean> {
    return await this.ghlService.refreshAccessToken();
  }

  async processDueFollowUps(): Promise<{ processed: number; successful: number; failed: number }> {
    console.log(`[Automation] Processing due follow-ups for dealership ${this.dealershipId}`);

    const dueItems = await storage.getDueFollowUpItems(this.dealershipId, 50);
    
    if (dueItems.length === 0) {
      console.log(`[Automation] No due follow-ups for dealership ${this.dealershipId}`);
      return { processed: 0, successful: 0, failed: 0 };
    }

    console.log(`[Automation] Found ${dueItems.length} due follow-ups`);

    let successful = 0;
    let failed = 0;

    for (const item of dueItems) {
      try {
        await storage.updateFollowUpQueueItem(item.id, this.dealershipId, { status: 'processing' });

        const result = await this.processFollowUpItem(item);
        
        if (result.success) {
          successful++;
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error(`[Automation] Error processing item ${item.id}:`, error);
        
        await storage.updateFollowUpQueueItem(item.id, this.dealershipId, {
          status: 'failed',
          lastError: errorMessage,
        });

        await this.logAction({
          dealershipId: this.dealershipId,
          automationType: 'follow_up',
          actionType: 'failed',
          sourceTable: 'follow_up_queue',
          sourceId: item.id,
          contactId: item.contactId || undefined,
          contactName: item.contactName || undefined,
          contactPhone: item.contactPhone || undefined,
          success: false,
          errorMessage,
        });
      }
    }

    console.log(`[Automation] Completed: ${successful} successful, ${failed} failed`);
    return { processed: dueItems.length, successful, failed };
  }

  private async processFollowUpItem(item: FollowUpQueue): Promise<{ success: boolean; error?: string }> {
    const sequence = await storage.getFollowUpSequenceById(item.sequenceId, this.dealershipId);
    if (!sequence) {
      await storage.updateFollowUpQueueItem(item.id, this.dealershipId, {
        status: 'cancelled',
        lastError: 'Sequence not found',
      });
      return { success: false, error: 'Sequence not found' };
    }

    let steps: SequenceStep[];
    try {
      steps = JSON.parse(sequence.steps);
    } catch {
      await storage.updateFollowUpQueueItem(item.id, this.dealershipId, {
        status: 'failed',
        lastError: 'Invalid sequence steps JSON',
      });
      return { success: false, error: 'Invalid sequence steps JSON' };
    }

    const currentStepData = steps.find(s => s.stepNumber === item.currentStep);
    if (!currentStepData) {
      await storage.updateFollowUpQueueItem(item.id, this.dealershipId, {
        status: 'failed',
        lastError: `Step ${item.currentStep} not found in sequence`,
      });
      return { success: false, error: `Step ${item.currentStep} not found` };
    }

    const personalizedMessage = this.personalizeMessage(currentStepData.templateText, item);

    let ghlContactId = item.contactId;

    if (!ghlContactId && item.contactPhone) {
      const searchResult = await this.ghlService.searchContacts({ phone: item.contactPhone });
      if (searchResult.success && searchResult.data?.contacts?.length) {
        ghlContactId = searchResult.data.contacts[0].id;
        await storage.updateFollowUpQueueItem(item.id, this.dealershipId, { contactId: ghlContactId });
      } else {
        const createResult = await this.ghlService.createContact({
          firstName: item.contactName?.split(' ')[0] || 'Customer',
          lastName: item.contactName?.split(' ').slice(1).join(' ') || '',
          phone: item.contactPhone,
          email: item.contactEmail || undefined,
          source: 'Lotview Automation',
        });
        
        if (createResult.success && createResult.data) {
          ghlContactId = createResult.data.id;
          await storage.updateFollowUpQueueItem(item.id, this.dealershipId, { contactId: ghlContactId });
        } else {
          await storage.updateFollowUpQueueItem(item.id, this.dealershipId, {
            status: 'failed',
            lastError: 'Failed to create GHL contact',
          });
          return { success: false, error: 'Failed to create GHL contact' };
        }
      }
    }

    if (!ghlContactId) {
      await storage.updateFollowUpQueueItem(item.id, this.dealershipId, {
        status: 'failed',
        lastError: 'No contact ID and no phone number to create contact',
      });
      return { success: false, error: 'No contact ID available' };
    }

    let sendResult: GhlApiResponse<GhlSendMessageResponse>;

    if (currentStepData.messageType === 'sms') {
      sendResult = await this.sendSMS(ghlContactId, personalizedMessage);
    } else {
      sendResult = { success: false, error: 'Email not yet implemented', errorCode: 'NOT_IMPLEMENTED' };
    }

    if (sendResult.success) {
      const isLastStep = item.currentStep >= item.totalSteps;
      
      if (isLastStep) {
        await storage.updateFollowUpQueueItem(item.id, this.dealershipId, {
          status: 'completed',
          lastSentAt: new Date(),
          ghlMessageId: sendResult.data?.messageId || undefined,
        });
      } else {
        const nextStep = steps.find(s => s.stepNumber === item.currentStep + 1);
        const delayMinutes = nextStep?.delayMinutes || 1440;
        const nextSendAt = new Date(Date.now() + delayMinutes * 60 * 1000);

        await storage.updateFollowUpQueueItem(item.id, this.dealershipId, {
          currentStep: item.currentStep + 1,
          nextSendAt,
          status: 'pending',
          lastSentAt: new Date(),
          ghlMessageId: sendResult.data?.messageId || undefined,
        });
      }

      await this.logAction({
        dealershipId: this.dealershipId,
        automationType: 'follow_up',
        actionType: 'sent',
        sourceTable: 'follow_up_queue',
        sourceId: item.id,
        contactId: ghlContactId,
        contactName: item.contactName || undefined,
        contactPhone: item.contactPhone || undefined,
        messageType: currentStepData.messageType,
        messageContent: personalizedMessage.substring(0, 500),
        success: true,
        externalId: sendResult.data?.messageId || undefined,
      });

      return { success: true };
    } else {
      await storage.updateFollowUpQueueItem(item.id, this.dealershipId, {
        status: 'failed',
        lastError: sendResult.error,
      });

      await this.logAction({
        dealershipId: this.dealershipId,
        automationType: 'follow_up',
        actionType: 'failed',
        sourceTable: 'follow_up_queue',
        sourceId: item.id,
        contactId: ghlContactId,
        contactName: item.contactName || undefined,
        contactPhone: item.contactPhone || undefined,
        messageType: currentStepData.messageType,
        messageContent: personalizedMessage.substring(0, 500),
        success: false,
        errorMessage: sendResult.error,
      });

      return { success: false, error: sendResult.error };
    }
  }

  private personalizeMessage(template: string, item: FollowUpQueue): string {
    let message = template;
    
    message = message.replace(/\{\{name\}\}/g, item.contactName || 'there');
    message = message.replace(/\{\{first_name\}\}/g, item.contactName?.split(' ')[0] || 'there');
    message = message.replace(/\{\{phone\}\}/g, item.contactPhone || '');
    message = message.replace(/\{\{email\}\}/g, item.contactEmail || '');

    if (item.metadata) {
      try {
        const metadata = JSON.parse(item.metadata);
        if (metadata.vehicleName) {
          message = message.replace(/\{\{vehicle\}\}/g, metadata.vehicleName);
          message = message.replace(/\{\{vehicle_name\}\}/g, metadata.vehicleName);
        }
        if (metadata.vehiclePrice) {
          message = message.replace(/\{\{price\}\}/g, `$${metadata.vehiclePrice.toLocaleString()}`);
        }
        if (metadata.dealershipName) {
          message = message.replace(/\{\{dealership\}\}/g, metadata.dealershipName);
        }
      } catch {
      }
    }

    return message;
  }

  async triggerFollowUp(params: {
    triggerType: string;
    contactName?: string;
    contactPhone?: string;
    contactEmail?: string;
    sourceType: string;
    sourceId?: string;
    vehicleId?: number;
    metadata?: Record<string, unknown>;
  }): Promise<{ success: boolean; queueItemId?: number; error?: string }> {
    const activeSequences = await storage.getActiveFollowUpSequences(this.dealershipId);
    const matchingSequence = activeSequences.find(s => s.triggerType === params.triggerType);

    if (!matchingSequence) {
      console.log(`[Automation] No active sequence for trigger type: ${params.triggerType}`);
      return { success: false, error: 'No matching sequence found' };
    }

    if (params.contactPhone) {
      const existing = await storage.getPendingFollowUpsByContact(this.dealershipId, params.contactPhone);
      if (existing.length > 0) {
        console.log(`[Automation] Contact already has pending follow-ups: ${params.contactPhone}`);
        return { success: false, error: 'Contact already in sequence' };
      }
    }

    let steps: SequenceStep[];
    try {
      steps = JSON.parse(matchingSequence.steps);
    } catch {
      return { success: false, error: 'Invalid sequence configuration' };
    }

    const firstStep = steps.find(s => s.stepNumber === 1);
    if (!firstStep) {
      return { success: false, error: 'No first step in sequence' };
    }

    const nextSendAt = new Date(Date.now() + firstStep.delayMinutes * 60 * 1000);

    const queueItem = await storage.createFollowUpQueueItem({
      dealershipId: this.dealershipId,
      sequenceId: matchingSequence.id,
      contactName: params.contactName || null,
      contactPhone: params.contactPhone || null,
      contactEmail: params.contactEmail || null,
      sourceType: params.sourceType,
      sourceId: params.sourceId || null,
      vehicleId: params.vehicleId || null,
      currentStep: 1,
      totalSteps: steps.length,
      nextSendAt,
      status: 'pending',
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    });

    await this.logAction({
      dealershipId: this.dealershipId,
      automationType: 'follow_up',
      actionType: 'triggered',
      sourceTable: 'follow_up_queue',
      sourceId: queueItem.id,
      contactName: params.contactName || undefined,
      contactPhone: params.contactPhone || undefined,
      success: true,
      metadata: JSON.stringify({ triggerType: params.triggerType, sequenceId: matchingSequence.id }),
    });

    console.log(`[Automation] Created follow-up queue item ${queueItem.id} for trigger: ${params.triggerType}`);
    return { success: true, queueItemId: queueItem.id };
  }

  private async logAction(log: Omit<InsertAutomationLog, 'executedAt'>): Promise<void> {
    try {
      await storage.createAutomationLog(log as InsertAutomationLog);
    } catch (error) {
      console.error('[Automation] Failed to log action:', error);
    }
  }
}

export async function processAllDealershipFollowUps(): Promise<void> {
  console.log('[Automation] Starting follow-up processing for all dealerships');
  
  const dealerships = await storage.getAllDealerships();
  
  for (const dealership of dealerships) {
    if (!dealership.isActive) continue;

    try {
      const automation = new AutomationService(dealership.id);
      await automation.processDueFollowUps();
    } catch (error) {
      console.error(`[Automation] Error processing dealership ${dealership.id}:`, error);
    }
  }

  console.log('[Automation] Completed follow-up processing for all dealerships');
}

export function createAutomationService(dealershipId: number): AutomationService {
  return new AutomationService(dealershipId);
}
