import OpenAI from "openai";
import type { InsertMessengerConversation, MessengerConversation, Vehicle } from "@shared/schema";
import { facebookService } from "./facebook-service";
import { logError, logInfo, logWarn } from "./error-utils";
import { storage } from "./storage";
import { GHLClient } from "./ghl-client";
import { completeMessengerResponseTasks } from "./messenger-sla-service";

type IntentCategory = "availability" | "price" | "appointment" | "financing" | "trade" | "complaint" | "general";

type ContactInfo = {
  phone?: string;
  email?: string;
};

type AppointmentOptions = {
  optionA: string;
  optionB: string;
};

const STOP_PATTERNS = [
  /\bunsubscribe\b/i,
  /\bdo not contact\b/i,
  /\bremove me\b/i,
  /\bstop messaging\b/i,
  /\bstop contacting\b/i,
  /\bstop texting\b/i,
];

const COMPLAINT_PATTERNS = [
  /\bcomplaint\b/i,
  /\bupset\b/i,
  /\bangry\b/i,
  /\bfrustrat(ed|ing)\b/i,
  /\bscam\b/i,
  /\bfraud\b/i,
  /\bterrible\b/i,
  /\bawful\b/i,
  /\bworst\b/i,
  /\brefund\b/i,
];

const FINANCE_PATTERNS = [
  /\bfinance\b/i,
  /\bfinancing\b/i,
  /\bcredit\b/i,
  /\bapproval\b/i,
  /\bpre-?approval\b/i,
  /\bapr\b/i,
  /\binterest rate\b/i,
  /\bmonthly\b/i,
];

const TRADE_PATTERNS = [
  /\btrade\b/i,
  /\btrade[- ]?in\b/i,
  /\bmy (car|truck|vehicle)\b/i,
  /\bswap\b/i,
];

const APPOINTMENT_PATTERNS = [
  /\btest drive\b/i,
  /\bappointment\b/i,
  /\bschedule\b/i,
  /\bbook\b/i,
  /\bcome in\b/i,
  /\bvisit\b/i,
  /\bwhen can i\b/i,
];

const PRICE_PATTERNS = [
  /\bprice\b/i,
  /\bcost\b/i,
  /\bdeal\b/i,
  /\bdiscount\b/i,
  /\bcheapest\b/i,
  /\bnegotiable\b/i,
  /\btotal\b/i,
  /\bout the door\b/i,
];

const AVAILABILITY_PATTERNS = [
  /\bstill available\b/i,
  /\bstill have\b/i,
  /\bavailable\b/i,
  /\bin stock\b/i,
  /\bon the lot\b/i,
];

const VIN_REGEX = /\b[A-HJ-NPR-Z0-9]{17}\b/i;
const STOCK_REGEX = /\b(?:stock|stk|unit)\s*#?:?\s*([A-Z0-9-]{3,})\b/i;
const PHONE_REGEX = /(?<!\d)\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}(?!\d)|(?<!\d)\d{10}(?!\d)/;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

function detectIntent(message: string): IntentCategory {
  if (COMPLAINT_PATTERNS.some((pattern) => pattern.test(message))) return "complaint";
  if (FINANCE_PATTERNS.some((pattern) => pattern.test(message))) return "financing";
  if (TRADE_PATTERNS.some((pattern) => pattern.test(message))) return "trade";
  if (APPOINTMENT_PATTERNS.some((pattern) => pattern.test(message))) return "appointment";
  if (PRICE_PATTERNS.some((pattern) => pattern.test(message))) return "price";
  if (AVAILABILITY_PATTERNS.some((pattern) => pattern.test(message))) return "availability";
  return "general";
}

function shouldStopAutomation(message: string): boolean {
  const trimmed = message.trim().toLowerCase();
  if (trimmed === "stop" || trimmed === "unsubscribe") return true;
  return STOP_PATTERNS.some((pattern) => pattern.test(message));
}

function extractContactInfo(message: string): ContactInfo {
  const contact: ContactInfo = {};
  const phoneMatch = message.match(PHONE_REGEX);
  if (phoneMatch) {
    contact.phone = phoneMatch[0].replace(/[^\d]/g, "");
  }
  const emailMatch = message.match(EMAIL_REGEX);
  if (emailMatch) {
    contact.email = emailMatch[0].toLowerCase();
  }
  return contact;
}

function extractVehicleIdentifiers(message: string): { vin?: string; stockNumber?: string } {
  const vinMatch = message.match(VIN_REGEX);
  const stockMatch = message.match(STOCK_REGEX);
  return {
    vin: vinMatch?.[0],
    stockNumber: stockMatch?.[1],
  };
}

function formatVehicleLabel(vehicle: Vehicle): string {
  const trim = vehicle.trim ? ` ${vehicle.trim}` : "";
  return `${vehicle.year} ${vehicle.make} ${vehicle.model}${trim}`.trim();
}

function buildAppointmentOptions(timeZone: string): AppointmentOptions {
  const hourFormatter = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hour12: false });
  const localHour = parseInt(hourFormatter.format(new Date()), 10);

  if (Number.isNaN(localHour) || localHour < 14) {
    return { optionA: "Today at 4 PM", optionB: "Tomorrow at 11 AM" };
  }

  return { optionA: "Tomorrow at 11 AM", optionB: "Tomorrow at 3 PM" };
}

function upgradeLeadStatus(currentStatus: string | null | undefined, nextStatus: string): string {
  if (currentStatus === "sold" || currentStatus === "lost") {
    return currentStatus;
  }

  const rank: Record<string, number> = {
    new: 1,
    cold: 2,
    warm: 3,
    hot: 4,
    pending: 5,
    sold: 6,
    lost: 6,
  };

  const currentRank = rank[currentStatus || "new"] ?? 1;
  const nextRank = rank[nextStatus] ?? currentRank;
  return nextRank > currentRank ? nextStatus : currentStatus || nextStatus;
}

function upgradePipelineStage(currentStage: string | null | undefined, nextStage: string): string {
  if (currentStage === "closed") {
    return currentStage;
  }

  const rank: Record<string, number> = {
    inquiry: 1,
    qualified: 2,
    test_drive: 3,
    negotiation: 4,
    closed: 5,
  };

  const currentRank = rank[currentStage || "inquiry"] ?? 1;
  const nextRank = rank[nextStage] ?? currentRank;
  return nextRank > currentRank ? nextStage : currentStage || nextStage;
}

async function getOpenAIClient(dealershipId: number): Promise<{ client: OpenAI | null; source: string }> {
  const apiKeys = await storage.getDealershipApiKeys(dealershipId);

  if (apiKeys?.openaiApiKey && apiKeys.openaiApiKey.length > 20) {
    return {
      client: new OpenAI({ apiKey: apiKeys.openaiApiKey }),
      source: "dealership",
    };
  }

  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY || !process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
    return { client: null, source: "none" };
  }

  return {
    client: new OpenAI({
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    }),
    source: "replit",
  };
}

function enforceReplyGuardrails(params: {
  reply: string;
  intent: IntentCategory;
  contactMissing: boolean;
  appointmentOptions: AppointmentOptions;
  vehicleLabel?: string;
}): string {
  let nextReply = params.reply.trim();
  const replyLower = nextReply.toLowerCase();

  if ((params.intent === "price" || params.intent === "availability") && !/subject to change/i.test(nextReply)) {
    nextReply = `${nextReply} Availability and price are subject to change.`;
  }

  if (params.contactMissing && !/(phone|number|email)/i.test(nextReply)) {
    nextReply = `${nextReply} What's the best number or email to reach you?`;
  }

  if (params.intent === "appointment" && !replyLower.includes(params.appointmentOptions.optionA.toLowerCase())) {
    nextReply = `${nextReply} We have openings ${params.appointmentOptions.optionA} or ${params.appointmentOptions.optionB}.`;
  }

  const questionMarks = (nextReply.match(/\?/g) || []).length;
  if (questionMarks > 1) {
    let seen = 0;
    nextReply = nextReply.replace(/\?/g, () => {
      seen += 1;
      return seen === 1 ? "?" : ".";
    });
  }

  return nextReply.trim();
}

function buildFallbackReply(params: {
  intent: IntentCategory;
  contactMissing: boolean;
  appointmentOptions: AppointmentOptions;
  vehicleLabel?: string;
}): string {
  const vehicleLine = params.vehicleLabel ? ` on the ${params.vehicleLabel}` : "";
  const contactLine = params.contactMissing
    ? " What's the best number or email to reach you?"
    : "";

  switch (params.intent) {
    case "appointment":
      if (params.contactMissing) {
        return `We can set up a visit${vehicleLine}. We have openings ${params.appointmentOptions.optionA} or ${params.appointmentOptions.optionB}.${contactLine}`;
      }
      return `We can set up a visit${vehicleLine}. Does ${params.appointmentOptions.optionA} or ${params.appointmentOptions.optionB} work?`;
    case "price":
      return `Happy to help${vehicleLine}. Availability and price are subject to change.${contactLine || " Which stock number or VIN should I confirm?"}`;
    case "availability":
      return `I can check availability${vehicleLine}. Availability and price are subject to change.${contactLine || " Which stock number or VIN should I confirm?"}`;
    default:
      return `Thanks for reaching out${vehicleLine}.${contactLine || " Which vehicle are you looking for (stock number or VIN)?"}`;
  }
}

function buildEscalationReply(contactMissing: boolean, vehicleLabel?: string): string {
  const vehicleLine = vehicleLabel ? ` about the ${vehicleLabel}` : "";
  if (contactMissing) {
    return `Thanks for the details${vehicleLine}. I am looping in a specialist now. What's the best number or email to reach you?`;
  }
  return `Thanks for the details${vehicleLine}. I am looping in a specialist now and they will follow up shortly.`;
}

async function generateAiReply(params: {
  dealershipId: number;
  dealershipName: string;
  intent: IntentCategory;
  contactMissing: boolean;
  appointmentOptions: AppointmentOptions;
  vehicleLabel?: string;
  lastCustomerMessage: string;
  messageHistory: string;
  timeZone: string;
}): Promise<string | null> {
  const { client, source } = await getOpenAIClient(params.dealershipId);
  if (!client) return null;

  const model = source === "dealership" ? "gpt-4o-mini" : "gpt-5";
  const vehicleText = params.vehicleLabel ? `Vehicle: ${params.vehicleLabel}` : "Vehicle: unknown";
  const contactText = params.contactMissing ? "Contact info missing (ask for name and phone/email)." : "Contact info captured.";
  const appointmentText = `Appointment options: ${params.appointmentOptions.optionA} or ${params.appointmentOptions.optionB}.`;

  const systemPrompt = `You are a concise automotive sales assistant responding to a Facebook Messenger lead.
Use 1-2 sentences. Ask at most one question.
Never promise availability. If intent is price or availability, include "Availability and price are subject to change."
If intent is appointment, mention the two appointment options and move toward booking.
If contact info is missing, ask for the best phone or email in one question.
If vehicle is unknown, ask for stock number or VIN.
Be polite, direct, and helpful.`;

  const userPrompt = `Dealership: ${params.dealershipName}
Intent: ${params.intent}
${vehicleText}
${contactText}
${appointmentText}
Time zone: ${params.timeZone}
Conversation context:
${params.messageHistory}

Latest customer message: "${params.lastCustomerMessage}"`;

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_completion_tokens: 220,
      temperature: 0.6,
    });

    const content = response.choices[0]?.message?.content?.trim();
    return content || null;
  } catch (error) {
    logWarn("Messenger AI reply generation failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function handleMessengerNurture(params: {
  dealershipId: number;
  conversationId: number;
  messageText: string;
  senderId: string;
}): Promise<void> {
  try {
    const { dealershipId, conversationId, messageText } = params;
    const conversation = await storage.getMessengerConversationById(conversationId, dealershipId);

    if (!conversation) {
      return;
    }

    if (!conversation.pageAccessToken) {
      logWarn("Messenger nurture skipped - missing page token", { dealershipId, conversationId });
      return;
    }

    if (!conversation.aiEnabled || conversation.aiWatchMode) {
      return;
    }

    const lastInboundAt = await storage.getLastInboundMessageAt(dealershipId, conversationId);
    if (!lastInboundAt || (Date.now() - lastInboundAt.getTime()) > 24 * 60 * 60 * 1000) {
      return;
    }

    if (shouldStopAutomation(messageText)) {
      await storage.updateMessengerConversation(conversationId, dealershipId, {
        aiEnabled: false,
        aiDisabledReason: "stop_request",
        aiDisabledAt: new Date(),
      });

      const stopReply = "Understood. We will not send additional messages.";
      const stopResult = await facebookService.sendMessengerMessage(
        conversation.pageAccessToken,
        conversation.participantId,
        stopReply,
        { messagingType: "RESPONSE" }
      );

      await storage.createMessengerMessage({
        dealershipId,
        conversationId,
        facebookMessageId: stopResult.messageId,
        senderId: "dealership",
        senderName: "Sales Team",
        isFromCustomer: false,
        content: stopReply,
        isRead: true,
        sentAt: new Date(),
        syncSource: "lotview",
        aiGenerated: true,
        aiPromptUsed: "auto-stop",
      });

      await storage.updateMessengerConversation(conversationId, dealershipId, {
        lastMessage: `You: ${stopReply.substring(0, 200)}`,
        lastMessageAt: new Date(),
      });

      try {
        await completeMessengerResponseTasks({ dealershipId, conversationId });
      } catch (slaError) {
        logWarn("Messenger SLA completion failed", {
          dealershipId,
          conversationId,
          error: slaError instanceof Error ? slaError.message : String(slaError),
        });
      }

      return;
    }

    const intent = detectIntent(messageText);
    const shouldEscalate = ["trade", "financing", "complaint"].includes(intent);
    const contactInfo = extractContactInfo(messageText);

    const updates: Partial<InsertMessengerConversation> = {};
    const hadContactInfo = !!conversation.customerPhone || !!conversation.customerEmail;
    if (contactInfo.phone && !conversation.customerPhone) {
      updates.customerPhone = contactInfo.phone;
    }
    if (contactInfo.email && !conversation.customerEmail) {
      updates.customerEmail = contactInfo.email;
    }

    const { vin, stockNumber } = extractVehicleIdentifiers(messageText);
    let vehicle: Vehicle | undefined;
    if (vin) {
      vehicle = await storage.getVehicleByVin(vin, dealershipId);
    }
    if (!vehicle && stockNumber) {
      vehicle = await storage.getVehicleByStockNumber(stockNumber, dealershipId);
    }

    if (vehicle && !conversation.vehicleOfInterest) {
      updates.vehicleOfInterest = formatVehicleLabel(vehicle);
    }

    const contactMissing = !(
      (conversation.customerPhone || updates.customerPhone) ||
      (conversation.customerEmail || updates.customerEmail)
    );

    if (intent === "appointment") {
      updates.pipelineStage = upgradePipelineStage(conversation.pipelineStage, "test_drive");
      updates.leadStatus = upgradeLeadStatus(conversation.leadStatus, "hot");
    } else if (intent === "price" || intent === "availability") {
      updates.pipelineStage = upgradePipelineStage(conversation.pipelineStage, "qualified");
      updates.leadStatus = upgradeLeadStatus(conversation.leadStatus, "warm");
    }

    if (shouldEscalate) {
      updates.aiWatchMode = true;
      updates.aiWatchModeAt = new Date();
    }

    if (Object.keys(updates).length > 0) {
      await storage.updateMessengerConversation(conversationId, dealershipId, updates);
    }

    const dealership = await storage.getDealership(dealershipId);
    const timeZone = dealership?.timezone || "America/Vancouver";
    const appointmentOptions = buildAppointmentOptions(timeZone);
    const vehicleLabel = updates.vehicleOfInterest || conversation.vehicleOfInterest || (vehicle ? formatVehicleLabel(vehicle) : undefined);
    const messages = await storage.getMessengerMessages(dealershipId, conversationId);
    const historySlice = messages.slice(-10);

    const maybeSyncLeadToGhl = async () => {
      if (hadContactInfo || contactMissing) return;
      const ghlClient = await GHLClient.getInstanceForDealership(dealershipId);
      if (!ghlClient) return;

      const ghlResult = await ghlClient.autoSyncChatLead({
        phone: updates.customerPhone || conversation.customerPhone || undefined,
        email: updates.customerEmail || conversation.customerEmail || undefined,
        name: conversation.participantName || undefined,
        category: intent === "appointment" ? "test-drive" : "general",
        vehicleName: vehicleLabel,
        vehicleId: vehicle?.id,
        source: "messenger",
        messages: historySlice.map((msg) => ({
          role: msg.isFromCustomer ? "user" : "assistant",
          content: msg.content,
        })),
        dealershipName: dealership?.name,
      });

      if (ghlResult.success) {
        await storage.updateMessengerConversation(conversationId, dealershipId, {
          ghlContactId: ghlResult.contactId || conversation.ghlContactId,
          ghlConversationId: ghlResult.conversationId || conversation.ghlConversationId,
        });
        logInfo("Messenger lead synced to GHL", {
          dealershipId,
          conversationId,
          ghlContactId: ghlResult.contactId,
        });
      }
    };

    if (shouldEscalate) {
      const escalationReply = buildEscalationReply(contactMissing, vehicleLabel);
      const sendResult = await facebookService.sendMessengerMessage(
        conversation.pageAccessToken,
        conversation.participantId,
        escalationReply,
        { messagingType: "RESPONSE" }
      );

      await storage.createMessengerMessage({
        dealershipId,
        conversationId,
        facebookMessageId: sendResult.messageId,
        senderId: "dealership",
        senderName: "Sales Team",
        isFromCustomer: false,
        content: escalationReply,
        isRead: true,
        sentAt: new Date(),
        syncSource: "lotview",
        aiGenerated: true,
        aiPromptUsed: "escalation",
      });

      await storage.updateMessengerConversation(conversationId, dealershipId, {
        lastMessage: `You: ${escalationReply.substring(0, 200)}`,
        lastMessageAt: new Date(),
      });

      await maybeSyncLeadToGhl();
      return;
    }

    const messageHistory = historySlice
      .map((msg) => `${msg.isFromCustomer ? "Customer" : "Dealership"}: ${msg.content}`)
      .join("\n");

    const aiReply = await generateAiReply({
      dealershipId,
      dealershipName: dealership?.name || "the dealership",
      intent,
      contactMissing,
      appointmentOptions,
      vehicleLabel,
      lastCustomerMessage: messageText,
      messageHistory,
      timeZone,
    });

    const reply = enforceReplyGuardrails({
      reply: aiReply || buildFallbackReply({ intent, contactMissing, appointmentOptions, vehicleLabel }),
      intent,
      contactMissing,
      appointmentOptions,
      vehicleLabel,
    });

    const sendResult = await facebookService.sendMessengerMessage(
      conversation.pageAccessToken,
      conversation.participantId,
      reply,
      { messagingType: "RESPONSE" }
    );

    await storage.createMessengerMessage({
      dealershipId,
      conversationId,
      facebookMessageId: sendResult.messageId,
      senderId: "dealership",
      senderName: "Sales Team",
      isFromCustomer: false,
      content: reply,
      isRead: true,
      sentAt: new Date(),
      syncSource: "lotview",
      aiGenerated: true,
      aiPromptUsed: aiReply ? "messenger-nurture" : "fallback",
    });

    await storage.updateMessengerConversation(conversationId, dealershipId, {
      lastMessage: `You: ${reply.substring(0, 200)}`,
      lastMessageAt: new Date(),
    });

    try {
      await completeMessengerResponseTasks({ dealershipId, conversationId });
    } catch (slaError) {
      logWarn("Messenger SLA completion failed", {
        dealershipId,
        conversationId,
        error: slaError instanceof Error ? slaError.message : String(slaError),
      });
    }

    await maybeSyncLeadToGhl();
  } catch (error) {
    logError("Messenger nurture failed", error instanceof Error ? error : new Error(String(error)), {
      route: "messenger-nurture",
      conversationId: params.conversationId,
    });
  }
}
