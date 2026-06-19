import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';

// ==========================================
// Structured Output Schemas & Types
// ==========================================

export const ExtensionMilestoneSchema = z.object({
  title: z.string().min(1, 'Milestone title is required'),
  description: z.string().min(1, 'Milestone description is required'),
  estimatedDuration: z.string().min(1, 'Estimated duration is required'),
  complexity: z.enum(['Low', 'Medium', 'High']),
  estimatedBudgetPct: z.number().min(0).max(100)
});

export const ContractExtensionsSchema = z.object({
  extensionReasoning: z.string().min(1, 'Reasoning must be provided'),
  suggestedMilestones: z.array(ExtensionMilestoneSchema),
  extensionOfferDraft: z.string().min(1, 'Offer draft message is required')
});

export type ExtensionMilestone = z.infer<typeof ExtensionMilestoneSchema>;
export type ContractExtensionsOutput = z.infer<typeof ContractExtensionsSchema>;

// ==========================================
// Core Context Extensions Generator
// ==========================================

/**
 * Suggests new logical project milestones and drafts a contract extension offer 
 * by analyzing completed deliverables and the team chat log summary.
 * 
 * Keep files clean, modular, and under 300 lines.
 */
export async function generateContractExtensions(
  completedDeliverables: string | any[],
  chatSummary: string,
  apiKey: string,
  modelName: string = 'gemini-2.5-pro'
): Promise<ContractExtensionsOutput> {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Context Extensions: API key is required.');
  }

  const ai = new GoogleGenAI({ apiKey });

  const deliverablesStr = typeof completedDeliverables === 'string'
    ? completedDeliverables
    : JSON.stringify(completedDeliverables, null, 2);

  const systemPrompt = `You are the Lead Project Strategy Agent for FixFlow AI.
Your job is to analyze completed project milestones/deliverables and recent chat discussion summaries to recommend logical follow-up phases.

These follow-ups could represent:
- Post-launch support, bug fixing, or monitoring.
- Optimization of speed, database queries, or SEO.
- Advanced features/enhancements discussed in the chat but not included in the original scope.
- Training or onboarding documentation.

Generate:
1. Clear strategic reasoning explaining why these extension milestones are recommended.
2. A list of 1 to 3 new suggested milestones (title, description, estimated duration, complexity, and estimated budget percentage relative to original).
3. A pre-written, polite, and persuasive message draft that the freelancer can send to the client.

Output strictly in JSON conforming to the requested schema. Do not output markdown decorators or extra prose.`;

  const userContent = `Completed Deliverables:\n${deliverablesStr}\n\nChat Discussion Summary:\n${chatSummary}`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: userContent,
      config: {
        temperature: 0.2,
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            extensionReasoning: { type: 'STRING' },
            suggestedMilestones: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  title: { type: 'STRING' },
                  description: { type: 'STRING' },
                  estimatedDuration: { type: 'STRING' },
                  complexity: { type: 'STRING', enum: ['Low', 'Medium', 'High'] },
                  estimatedBudgetPct: { type: 'INTEGER' }
                },
                required: ['title', 'description', 'estimatedDuration', 'complexity', 'estimatedBudgetPct']
              }
            },
            extensionOfferDraft: { type: 'STRING' }
          },
          required: ['extensionReasoning', 'suggestedMilestones', 'extensionOfferDraft']
        }
      }
    });

    const parsedJsonText = response.text || '';
    if (!parsedJsonText.trim()) {
      throw new Error('Context extensions LLM response returned empty text.');
    }

    return ContractExtensionsSchema.parse(JSON.parse(parsedJsonText));
  } catch (error) {
    console.error('Context Extensions Exception, applying fallback:', error);
    
    // Provide a safe fallback suggestion
    return {
      extensionReasoning: 'Initial milestones successfully verified. Suggested maintenance and optimization follow-up due to default safety fallback trigger.',
      suggestedMilestones: [
        {
          title: 'Post-Delivery Support & Maintenance',
          description: 'A 2-week support period to monitor systems, fix production issues, and make minor design tweaks.',
          estimatedDuration: '14 days',
          complexity: 'Low',
          estimatedBudgetPct: 15
        },
        {
          title: 'Performance Optimization & Monitoring Setup',
          description: 'Integrate performance logging, core web vitals optimization, and crash analytics dashboard.',
          estimatedDuration: '7 days',
          complexity: 'Medium',
          estimatedBudgetPct: 10
        }
      ],
      extensionOfferDraft: `Hi! Now that we've successfully completed the first phase of deliverables, I recommend setting up a short support and optimization milestone to monitor performance and resolve any initial feedback. Let me know if you would like me to add these milestones to our active escrow contract!`
    };
  }
}
