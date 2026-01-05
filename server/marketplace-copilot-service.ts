import OpenAI from "openai";
import type { Vehicle } from "@shared/schema";
import { logError, logWarn } from "./error-utils";
import { storage } from "./storage";

type IntentCategory = "availability" | "price" | "appointment" | "financing" | "trade" | "complaint" | "general";

type AppointmentOptions = {
  optionA: string;
  optionB: string;
};

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

function hasContactInfo(message: string): boolean {
  return PHONE_REGEX.test(message) || EMAIL_REGEX.test(message);
}

function formatVehicleLabel(vehicle?: Vehicle | null): string | undefined {
  if (!vehicle) return undefined;
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

function enforceGuardrails(params: {
  reply: string;
  intent: IntentCategory;
  contactMissing: boolean;
  appointmentOptions: AppointmentOptions;
}): string {
  let nextReply = params.reply.trim();
  const lower = nextReply.toLowerCase();

  if ((params.intent === "price" || params.intent === "availability") && !/subject to change/i.test(nextReply)) {
    nextReply = `${nextReply} Availability and price are subject to change.`;
  }

  if (params.intent === "appointment" && !lower.includes(params.appointmentOptions.optionA.toLowerCase())) {
    nextReply = `${nextReply} We have openings ${params.appointmentOptions.optionA} or ${params.appointmentOptions.optionB}.`;
  }

  if (params.contactMissing && !/(phone|number|email)/i.test(nextReply)) {
    nextReply = `${nextReply} What's the best number or email to reach you?`;
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
  const contactLine = params.contactMissing ? " What's the best number or email to reach you?" : "";

  switch (params.intent) {
    case "appointment":
      return `Happy to help with a visit${vehicleLine}. We have openings ${params.appointmentOptions.optionA} or ${params.appointmentOptions.optionB}.${contactLine}`;
    case "price":
      return `I can confirm pricing${vehicleLine}. Availability and price are subject to change.${contactLine || " Which stock number or VIN should I confirm?"}`;
    case "availability":
      return `I can check availability${vehicleLine}. Availability and price are subject to change.${contactLine || " Which stock number or VIN should I confirm?"}`;
    case "financing":
    case "trade":
    case "complaint":
      return `Thanks for the details${vehicleLine}. I am looping in a specialist now.${contactLine}`;
    default:
      return `Thanks for reaching out${vehicleLine}.${contactLine || " Which vehicle are you looking for (stock number or VIN)?"}`;
  }
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

async function generateAiReply(params: {
  dealershipId: number;
  dealershipName: string;
  intent: IntentCategory;
  contactMissing: boolean;
  appointmentOptions: AppointmentOptions;
  vehicleLabel?: string;
  buyerMessage: string;
}): Promise<string | null> {
  const { client, source } = await getOpenAIClient(params.dealershipId);
  if (!client) return null;

  const replitDefaultModel = process.env.OPENAI_DEFAULT_MODEL || "gpt-4o";
  const model = source === "dealership" ? "gpt-4o-mini" : replitDefaultModel;
  const vehicleText = params.vehicleLabel ? `Vehicle: ${params.vehicleLabel}` : "Vehicle: unknown";
  const contactText = params.contactMissing ? "Contact info missing (ask for phone or email)." : "Contact info captured.";
  const appointmentText = `Appointment options: ${params.appointmentOptions.optionA} or ${params.appointmentOptions.optionB}.`;

  const systemPrompt = `You are a concise automotive sales assistant helping draft a Facebook Marketplace reply.
Use 1-2 sentences. Ask at most one question.
Never promise availability. If intent is price or availability, include "Availability and price are subject to change."
If intent is appointment, mention the two appointment options and move toward booking.
If contact info is missing, ask for the best phone or email in one question.
If vehicle is unknown, ask for stock number or VIN.
Be professional and direct.`;

  const userPrompt = `Dealership: ${params.dealershipName}
Intent: ${params.intent}
${vehicleText}
${contactText}
${appointmentText}
Buyer message: "${params.buyerMessage}"`;

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
    logWarn("Marketplace copilot AI reply failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function suggestMarketplaceReply(params: {
  dealershipId: number;
  buyerMessage: string;
  dealershipName?: string;
  timeZone?: string;
  vehicle?: Vehicle | null;
}): Promise<{ reply: string; intent: IntentCategory }> {
  try {
    const intent = detectIntent(params.buyerMessage);
    const vehicleLabel = formatVehicleLabel(params.vehicle);
    const contactMissing = !hasContactInfo(params.buyerMessage);
    const timeZone = params.timeZone || "America/Vancouver";
    const appointmentOptions = buildAppointmentOptions(timeZone);

    const aiReply = await generateAiReply({
      dealershipId: params.dealershipId,
      dealershipName: params.dealershipName || "the dealership",
      intent,
      contactMissing,
      appointmentOptions,
      vehicleLabel,
      buyerMessage: params.buyerMessage,
    });

    const reply = enforceGuardrails({
      reply: aiReply || buildFallbackReply({ intent, contactMissing, appointmentOptions, vehicleLabel }),
      intent,
      contactMissing,
      appointmentOptions,
    });

    return { reply, intent };
  } catch (error) {
    logError("Marketplace copilot failed", error instanceof Error ? error : new Error(String(error)), {
      route: "marketplace-copilot",
    });

    const fallbackReply = buildFallbackReply({
      intent: "general",
      contactMissing: true,
      appointmentOptions: { optionA: "Today at 4 PM", optionB: "Tomorrow at 11 AM" },
    });

    return { reply: fallbackReply, intent: "general" };
  }
}
