import OpenAI from "openai";
import { storage } from "./storage";
import type { CallRecording, CallAnalysisCriteria } from "@shared/schema";

interface CallAnalysisResult {
  overallScore: number;
  criteriaScores: Record<number, number>;
  sentiment: 'positive' | 'neutral' | 'negative';
  keyInsights: string[];
  coachingRecommendations: string[];
  actionItems: string[];
  leadQualification: 'hot' | 'warm' | 'cold' | 'not_qualified';
  needsReview: boolean;
  reviewReason?: string;
}

export class CallAnalysisService {
  private openai: OpenAI | null = null;
  private dealershipId: number;

  constructor(dealershipId: number) {
    this.dealershipId = dealershipId;
  }

  private async getOpenAIClient(): Promise<OpenAI | null> {
    if (this.openai) return this.openai;

    const apiKeys = await storage.getDealershipApiKeys(this.dealershipId);
    const apiKey = apiKeys?.openaiApiKey || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      console.error(`No OpenAI API key configured for dealership ${this.dealershipId}`);
      return null;
    }

    this.openai = new OpenAI({ apiKey });
    return this.openai;
  }

  async analyzeCall(recording: CallRecording): Promise<CallAnalysisResult | null> {
    if (!recording.transcription) {
      console.log(`No transcription available for call ${recording.id}`);
      return null;
    }

    const openai = await this.getOpenAIClient();
    if (!openai) {
      return null;
    }

    const criteria = await storage.getActiveCallAnalysisCriteria(this.dealershipId);
    
    const criteriaPrompt = criteria.length > 0
      ? criteria.map(c => `- ${c.name} (${c.category}): ${c.description || 'Evaluate this aspect of the call'}${c.promptGuidance ? ` Additional guidance: ${c.promptGuidance}` : ''}`).join('\n')
      : `- Professionalism: Was the salesperson professional and courteous?
- Script Adherence: Did they follow proper sales protocols?
- Customer Engagement: Did they actively listen and respond to customer needs?
- Product Knowledge: Did they demonstrate knowledge about vehicles?
- Closing Technique: Did they attempt to close or schedule next steps?`;

    const prompt = `You are an expert automotive sales call analyst. Analyze the following phone call transcription between a car dealership employee and a customer.

CALL DETAILS:
- Direction: ${recording.direction}
- Duration: ${Math.floor(recording.duration / 60)} minutes ${recording.duration % 60} seconds
- Caller: ${recording.callerName || recording.callerPhone}
- Salesperson: ${recording.salespersonName || 'Unknown'}

TRANSCRIPTION:
${recording.transcription}

EVALUATION CRITERIA:
${criteriaPrompt}

Please analyze this call and provide your assessment in the following JSON format:
{
  "overallScore": <0-100 overall performance score>,
  "criteriaScores": {
    ${criteria.map(c => `"${c.id}": <0-100 score for ${c.name}>`).join(',\n    ') || '"professionalism": <0-100>, "script_adherence": <0-100>, "customer_engagement": <0-100>, "product_knowledge": <0-100>, "closing_technique": <0-100>'}
  },
  "sentiment": "<positive|neutral|negative - overall customer sentiment>",
  "keyInsights": [
    "<key insight 1>",
    "<key insight 2>",
    "<key insight 3>"
  ],
  "coachingRecommendations": [
    "<specific actionable recommendation 1>",
    "<specific actionable recommendation 2>"
  ],
  "actionItems": [
    "<follow-up action item 1>",
    "<follow-up action item 2>"
  ],
  "leadQualification": "<hot|warm|cold|not_qualified>",
  "needsReview": <true if this call needs manager attention, false otherwise>,
  "reviewReason": "<if needsReview is true, explain why>"
}

SCORING GUIDELINES:
- 90-100: Exceptional performance
- 70-89: Good performance with minor improvements needed
- 50-69: Average, needs coaching
- 30-49: Below expectations, significant improvement needed
- 0-29: Poor performance, requires immediate attention

Flag for review if:
- Overall score below 50
- Customer expressed frustration or dissatisfaction
- Salesperson made factual errors
- Compliance issues detected
- High-value lead was mishandled

Respond ONLY with valid JSON, no additional text.`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are an expert automotive sales call analyst. Respond only with valid JSON." },
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("Empty response from OpenAI");
      }

      const result = JSON.parse(content) as CallAnalysisResult;
      return result;

    } catch (error) {
      console.error(`Error analyzing call ${recording.id}:`, error);
      return null;
    }
  }

  async processCallRecording(recordingId: number): Promise<boolean> {
    const recording = await storage.getCallRecordingById(recordingId, this.dealershipId);
    if (!recording) {
      console.error(`Call recording ${recordingId} not found`);
      return false;
    }

    if (recording.analysisStatus === 'completed') {
      console.log(`Call ${recordingId} already analyzed`);
      return true;
    }

    if (!recording.transcription) {
      await storage.updateCallRecording(recordingId, this.dealershipId, {
        analysisStatus: 'skipped',
        analysisError: 'No transcription available'
      });
      return false;
    }

    await storage.updateCallRecording(recordingId, this.dealershipId, {
      analysisStatus: 'processing'
    });

    try {
      const result = await this.analyzeCall(recording);

      if (!result) {
        await storage.updateCallRecording(recordingId, this.dealershipId, {
          analysisStatus: 'failed',
          analysisError: 'Analysis returned no results'
        });
        return false;
      }

      await storage.updateCallRecording(recordingId, this.dealershipId, {
        analysisStatus: 'completed',
        analyzedAt: new Date(),
        overallScore: result.overallScore,
        criteriaScores: JSON.stringify(result.criteriaScores),
        sentiment: result.sentiment,
        keyInsights: JSON.stringify(result.keyInsights),
        coachingRecommendations: JSON.stringify(result.coachingRecommendations),
        actionItems: JSON.stringify(result.actionItems),
        leadQualification: result.leadQualification,
        needsReview: result.needsReview,
        analysisError: null
      });

      return true;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await storage.updateCallRecording(recordingId, this.dealershipId, {
        analysisStatus: 'failed',
        analysisError: errorMessage
      });
      return false;
    }
  }

  async processPendingCalls(limit: number = 5): Promise<{ processed: number; failed: number }> {
    const pendingCalls = await storage.getPendingCallRecordings(this.dealershipId, limit);
    
    let processed = 0;
    let failed = 0;

    for (const call of pendingCalls) {
      const success = await this.processCallRecording(call.id);
      if (success) {
        processed++;
      } else {
        failed++;
      }
    }

    return { processed, failed };
  }
}

const serviceCache = new Map<number, CallAnalysisService>();

export function getCallAnalysisService(dealershipId: number): CallAnalysisService {
  if (!serviceCache.has(dealershipId)) {
    serviceCache.set(dealershipId, new CallAnalysisService(dealershipId));
  }
  return serviceCache.get(dealershipId)!;
}

export async function seedDefaultCriteria(dealershipId: number): Promise<void> {
  const existing = await storage.getCallAnalysisCriteria(dealershipId);
  if (existing.length > 0) return;

  const defaultCriteria = [
    {
      dealershipId,
      name: "Professional Greeting",
      description: "Did the salesperson greet the customer warmly and professionally, introducing themselves and the dealership?",
      category: "greeting",
      weight: 2,
      isActive: true
    },
    {
      dealershipId,
      name: "Needs Discovery",
      description: "Did the salesperson ask probing questions to understand the customer's needs, preferences, budget, and timeline?",
      category: "qualification",
      weight: 3,
      isActive: true
    },
    {
      dealershipId,
      name: "Product Knowledge",
      description: "Did the salesperson demonstrate accurate knowledge about vehicles, features, pricing, and inventory?",
      category: "general",
      weight: 2,
      isActive: true
    },
    {
      dealershipId,
      name: "Objection Handling",
      description: "Did the salesperson address customer concerns and objections professionally and effectively?",
      category: "objection_handling",
      weight: 3,
      isActive: true
    },
    {
      dealershipId,
      name: "Closing & Next Steps",
      description: "Did the salesperson attempt to schedule an appointment, test drive, or move the sale forward?",
      category: "closing",
      weight: 3,
      isActive: true
    },
    {
      dealershipId,
      name: "Active Listening",
      description: "Did the salesperson actively listen, avoid interrupting, and respond appropriately to customer statements?",
      category: "general",
      weight: 2,
      isActive: true
    },
    {
      dealershipId,
      name: "Value Proposition",
      description: "Did the salesperson clearly communicate the dealership's unique value and why the customer should choose them?",
      category: "general",
      weight: 2,
      isActive: true
    }
  ];

  for (const criteria of defaultCriteria) {
    await storage.createCallAnalysisCriteria(criteria);
  }
}
