import OpenAI from "openai";
import { db } from "./db";
import { aiPromptTemplates, dealershipApiKeys } from "@shared/schema";
import { eq } from "drizzle-orm";
import { storage } from "./storage";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

async function getOpenAIClient(dealershipId: number): Promise<OpenAI> {
  // Try to get dealership-specific API key
  const apiKeys = await storage.getDealershipApiKeys(dealershipId);
  
  if (apiKeys?.openaiApiKey) {
    // Use dealership's own OpenAI API key
    return new OpenAI({
      apiKey: apiKeys.openaiApiKey
    });
  }
  
  // Fallback to Replit's AI Integrations service
  return new OpenAI({
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
  });
}

export async function generateChatResponse(
  messages: ChatMessage[],
  dealershipId: number,
  scenario: string = 'general',
  vehicleContext?: string
): Promise<string> {
  try {
    // Load the active prompt for this dealership and scenario
    const promptData = await storage.getActivePromptForScenario(dealershipId, scenario);
    
    // If no custom prompt, use a default system message
    let systemContent = `You are an expert car sales consultant. You are professional, friendly, and focused on helping customers find their perfect vehicle.

${vehicleContext ? `Current vehicle being discussed: ${vehicleContext}` : ""}

Your goals:
- Answer questions about vehicles, financing, and dealership services
- Help schedule test drives and appointments
- Explain vehicle features and benefits
- Assist with trade-in valuations
- Guide customers through the financing process
- Provide information about warranties and service plans

Always be helpful, concise, and action-oriented. If you don't have specific information, offer to connect the customer with a sales representative.`;

    if (promptData) {
      // Use the database prompt with vehicle context if available
      systemContent = promptData.systemPrompt;
      if (vehicleContext) {
        systemContent += `\n\nCurrent vehicle being discussed: ${vehicleContext}`;
      }
    }

    const systemMessage: ChatMessage = {
      role: "system",
      content: systemContent
    };

    // Get the appropriate OpenAI client (dealership-specific or fallback)
    const openai = await getOpenAIClient(dealershipId);

    const response = await openai.chat.completions.create({
      model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      messages: [systemMessage, ...messages],
      max_completion_tokens: 500,
      temperature: 1,
    });

    return response.choices[0]?.message?.content || "I apologize, but I'm having trouble responding right now. Please try again or contact our sales team directly.";
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw new Error("Failed to generate chat response");
  }
}

export function getInitialChatMessage(action: string | null, vehicleName: string): string {
  switch (action) {
    case 'test-drive':
      return `Perfect! You want to book a test drive for the ${vehicleName}. I can help you schedule that right away. What day works best for you this week?`;
    
    case 'reserve':
      return `Great choice! You're interested in reserving the ${vehicleName}. To secure this vehicle, I'll need a few quick details. Would you like to proceed with a $500 refundable deposit?`;
    
    default:
      return `Hi there! I see you're looking at the ${vehicleName}. It's a great choice! Would you like to see the CarFax report or schedule a test drive?`;
  }
}

interface VehicleData {
  year: number;
  make: string;
  model: string;
  trim: string;
  type: string;
  price: number;
  odometer: number;
  badges: string[];
  dealership: string;
  location: string;
  rawDescription?: string;
  fullPageContent?: string;
}

async function getActivePromptTemplate(): Promise<string> {
  try {
    const template = await db.query.aiPromptTemplates.findFirst({
      where: eq(aiPromptTemplates.isActive, true),
    });
    
    if (template) {
      return template.promptText;
    }
  } catch (error) {
    console.error("Error fetching prompt template:", error);
  }
  
  // Default fallback prompt
  return `Create a compelling, professional vehicle description for a Canadian automotive dealership (Olympic Auto Group in Vancouver, BC).

Vehicle Details:
- {{YEAR}} {{MAKE}} {{MODEL}} {{TRIM}}
- Type: {{TYPE}}
- Price: ${{PRICE}} CAD
- Odometer: {{ODOMETER}} km
- Badges/Features: {{BADGES}}
- Location: {{DEALERSHIP}}, {{LOCATION}}
{{FULL_CONTENT}}

Requirements:
- Write 2-3 compelling paragraphs (150-200 words total)
- Highlight key features, benefits, and value proposition
- Use Canadian automotive market language and terminology
- Emphasize quality, reliability, and value
- Include emotional appeal and lifestyle benefits
- Mention financing availability and dealership reputation
- Use professional, enthusiastic tone
- Focus on what makes THIS vehicle special
- DO NOT use placeholder text or generic templates
- DO NOT mention things not in the vehicle details

Write the description now:`;
}

export async function generateVehicleDescription(vehicle: VehicleData, dealershipId: number = 1): Promise<string> {
  try {
    const badgesText = vehicle.badges.length > 0 ? vehicle.badges.join(', ') : 'none';
    const fullContentSection = vehicle.fullPageContent 
      ? `\n\nAdditional information from listing:\n${vehicle.fullPageContent.slice(0, 3000)}`
      : vehicle.rawDescription 
      ? `\nOriginal listing info: ${vehicle.rawDescription}`
      : '';
    
    // Get customizable prompt template
    const promptTemplate = await getActivePromptTemplate();
    
    // Replace template variables
    const prompt = promptTemplate
      .replace(/\{\{YEAR\}\}/g, vehicle.year.toString())
      .replace(/\{\{MAKE\}\}/g, vehicle.make)
      .replace(/\{\{MODEL\}\}/g, vehicle.model)
      .replace(/\{\{TRIM\}\}/g, vehicle.trim)
      .replace(/\{\{TYPE\}\}/g, vehicle.type)
      .replace(/\{\{PRICE\}\}/g, vehicle.price.toLocaleString())
      .replace(/\{\{ODOMETER\}\}/g, vehicle.odometer.toLocaleString())
      .replace(/\{\{BADGES\}\}/g, badgesText)
      .replace(/\{\{DEALERSHIP\}\}/g, vehicle.dealership)
      .replace(/\{\{LOCATION\}\}/g, vehicle.location)
      .replace(/\{\{FULL_CONTENT\}\}/g, fullContentSection);

    // Get the appropriate OpenAI client
    const openaiClient = await getOpenAIClient(dealershipId);

    const response = await openaiClient.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are an expert automotive copywriter specializing in Canadian car dealership marketing. Write compelling, specific vehicle descriptions that sell vehicles."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_completion_tokens: 400,
      temperature: 0.8,
    });

    const description = response.choices[0]?.message?.content?.trim();
    
    if (!description || description.length < 50) {
      // Fallback to basic description
      return `This ${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim} is an exceptional ${vehicle.type.toLowerCase()} available at ${vehicle.dealership}. With ${vehicle.odometer.toLocaleString()} km on the odometer and priced at $${vehicle.price.toLocaleString()}, it represents outstanding value in today's market. ${vehicle.badges.length > 0 ? `Features include: ${vehicle.badges.join(', ')}.` : ''} Visit us in ${vehicle.location} to experience this vehicle firsthand and explore our flexible financing options.`;
    }
    
    return description;
  } catch (error) {
    console.error("Error generating vehicle description:", error);
    // Fallback description
    return `This ${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim} is an exceptional ${vehicle.type.toLowerCase()} available at ${vehicle.dealership}. With ${vehicle.odometer.toLocaleString()} km on the odometer and priced at $${vehicle.price.toLocaleString()}, it represents outstanding value in today's market. ${vehicle.badges.length > 0 ? `Features include: ${vehicle.badges.join(', ')}.` : ''} Visit us in ${vehicle.location} to experience this vehicle firsthand and explore our flexible financing options.`;
  }
}
