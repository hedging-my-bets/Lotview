import OpenAI from "openai";

// This is using Replit's AI Integrations service, which provides OpenAI-compatible API access without requiring your own OpenAI API key.
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function generateChatResponse(
  messages: ChatMessage[],
  vehicleContext?: string
): Promise<string> {
  try {
    const systemMessage: ChatMessage = {
      role: "system",
      content: `You are an expert car sales consultant for Olympic Auto Group, which operates three dealerships in Vancouver: Olympic Hyundai Vancouver, Boundary Hyundai Vancouver, and Kia Vancouver. You are professional, friendly, and focused on helping customers find their perfect vehicle.

${vehicleContext ? `Current vehicle being discussed: ${vehicleContext}` : ""}

Your goals:
- Answer questions about vehicles, financing, and dealership services
- Help schedule test drives and appointments
- Explain vehicle features and benefits
- Assist with trade-in valuations
- Guide customers through the financing process
- Provide information about warranties and service plans

Always be helpful, concise, and action-oriented. If you don't have specific information, offer to connect the customer with a sales representative.`
    };

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
}

export async function generateVehicleDescription(vehicle: VehicleData): Promise<string> {
  try {
    const badgesText = vehicle.badges.length > 0 ? vehicle.badges.join(', ') : 'none';
    
    const prompt = `Create a compelling, professional vehicle description for a Canadian automotive dealership (Olympic Auto Group in Vancouver, BC).

Vehicle Details:
- ${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim}
- Type: ${vehicle.type}
- Price: $${vehicle.price.toLocaleString()} CAD
- Odometer: ${vehicle.odometer.toLocaleString()} km
- Badges/Features: ${badgesText}
- Location: ${vehicle.dealership}, ${vehicle.location}
${vehicle.rawDescription ? `\nOriginal listing info: ${vehicle.rawDescription}` : ''}

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

    const response = await openai.chat.completions.create({
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
