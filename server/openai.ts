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
