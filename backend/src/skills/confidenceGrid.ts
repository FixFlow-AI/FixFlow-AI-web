import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';
import { Proposal, parseBrief, ProposalSchema } from './briefParser.js';

// ==========================================
// Evaluation Schemas & Interfaces
// ==========================================

export const AuditorEvaluationSchema = z.object({
  budget_alignment_score: z.number().min(0).max(100),
  deliverable_coverage_score: z.number().min(0).max(100),
  issues: z.array(z.string()),
  findings: z.string().min(1, 'Findings details must be provided')
});

export type AuditorEvaluation = z.infer<typeof AuditorEvaluationSchema>;

export const FeasibilityEvaluationSchema = z.object({
  technical_feasibility_score: z.number().min(0).max(100),
  timeline_realism_score: z.number().min(0).max(100),
  issues: z.array(z.string()),
  findings: z.string().min(1, 'Findings details must be provided')
});

export type FeasibilityEvaluation = z.infer<typeof FeasibilityEvaluationSchema>;

export interface ConfidenceGridResult {
  auditor: AuditorEvaluation;
  feasibility: FeasibilityEvaluation;
  confidenceIndex: number; // Mean of the 4 individual scores
  optimized: boolean;
  finalProposal: Proposal;
}

// ==========================================
// Parallel Multi-Agent Orchestrator
// ==========================================

/**
 * Runs the Auditor persona agent to evaluate budget alignment and deliverables coverage.
 */
export async function runAuditorAgent(
  briefText: string,
  proposal: Proposal,
  apiKey: string,
  modelName: string = 'gemini-2.5-pro'
): Promise<AuditorEvaluation> {
  const ai = new GoogleGenAI({ apiKey });
  const systemPrompt = `You are the Lead Auditor Agent for Dixflow AI.
Your task is to analyze a client brief and a generated technical proposal to evaluate:
1. Budget Alignment: Check if the features/costs conform to any explicitly stated or implicit budget constraints in the brief.
2. Deliverable Coverage: Check if all requested deliverables, functional features, and milestones in the brief are fully accounted for.

Provide a numeric score (0-100) for each, along with a list of specific issues and detailed findings.
Output strictly in JSON conforming to the requested schema. Do not output markdown decorators or extra prose.`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: `Brief:\n${briefText}\n\nProposal JSON:\n${JSON.stringify(proposal, null, 2)}`,
      config: {
        temperature: 0.1,
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            budget_alignment_score: { type: 'INTEGER' },
            deliverable_coverage_score: { type: 'INTEGER' },
            issues: { type: 'ARRAY', items: { type: 'STRING' } },
            findings: { type: 'STRING' }
          },
          required: ['budget_alignment_score', 'deliverable_coverage_score', 'issues', 'findings']
        }
      }
    });

    const parsedJsonText = response.text || '';
    if (!parsedJsonText.trim()) {
      throw new Error('Auditor LLM response returned empty text.');
    }

    return AuditorEvaluationSchema.parse(JSON.parse(parsedJsonText));
  } catch (error) {
    console.error('Auditor Agent Evaluation Exception:', error);
    // Safe fallback output
    return {
      budget_alignment_score: 70,
      deliverable_coverage_score: 70,
      issues: ['Auditor agent failed to complete review, fallback applied.'],
      findings: `An error occurred during auditor evaluation: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Runs the Feasibility persona agent to evaluate technical feasibility and timeline realism.
 */
export async function runFeasibilityAgent(
  briefText: string,
  proposal: Proposal,
  apiKey: string,
  modelName: string = 'gemini-2.5-pro'
): Promise<FeasibilityEvaluation> {
  const ai = new GoogleGenAI({ apiKey });
  const systemPrompt = `You are the Lead Technical Feasibility Agent for Dixflow AI.
Your task is to analyze a client brief and a generated technical proposal to evaluate:
1. Technical Feasibility: Check if the recommended stack and technical approaches are realistic, appropriate, and achievable.
2. Timeline Realism: Verify that durations, tasks, dependencies, and weekly delivery plans are realistic and logical.

Provide a numeric score (0-100) for each, along with a list of specific issues and detailed findings.
Output strictly in JSON conforming to the requested schema. Do not output markdown decorators or extra prose.`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: `Brief:\n${briefText}\n\nProposal JSON:\n${JSON.stringify(proposal, null, 2)}`,
      config: {
        temperature: 0.1,
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            technical_feasibility_score: { type: 'INTEGER' },
            timeline_realism_score: { type: 'INTEGER' },
            issues: { type: 'ARRAY', items: { type: 'STRING' } },
            findings: { type: 'STRING' }
          },
          required: ['technical_feasibility_score', 'timeline_realism_score', 'issues', 'findings']
        }
      }
    });

    const parsedJsonText = response.text || '';
    if (!parsedJsonText.trim()) {
      throw new Error('Feasibility LLM response returned empty text.');
    }

    return FeasibilityEvaluationSchema.parse(JSON.parse(parsedJsonText));
  } catch (error) {
    console.error('Feasibility Agent Evaluation Exception:', error);
    // Safe fallback output
    return {
      technical_feasibility_score: 70,
      timeline_realism_score: 70,
      issues: ['Feasibility agent failed to complete review, fallback applied.'],
      findings: `An error occurred during feasibility evaluation: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

// ==========================================
// Autonomous Self-Correction Engine
// ==========================================

/**
 * Optimizes the proposal by feeding the audit issues and original proposal back to the LLM.
 */
export async function optimizeProposal(
  briefText: string,
  proposal: Proposal,
  issues: string[],
  apiKey: string,
  modelName: string = 'gemini-2.5-pro'
): Promise<Proposal> {
  console.log(`Initiating self-correction optimization for proposal. Correcting ${issues.length} flagged issues.`);
  
  const ai = new GoogleGenAI({ apiKey });
  const systemPrompt = `You are the Lead Optimization Agent for Dixflow AI.
Your job is to revise a technical project proposal based on feedback from audit and feasibility agents.
You will be provided with:
1. The original brief text.
2. The current proposal JSON draft.
3. A list of critical issues that must be fixed.

Ensure you correct the proposal details:
- Align deliverables with the budget.
- Refine technical approaches for better feasibility.
- Re-align timeline durations and week schedules.
- Correct overlapping or missing week task mappings.

Output strictly in JSON conforming to the original Proposal Schema. Do not output markdown decorators or extra prose.`;

  const userContent = `Original Brief:\n${briefText}\n\nProposal Draft JSON:\n${JSON.stringify(proposal, null, 2)}\n\nIssues to Resolve:\n${JSON.stringify(issues, null, 2)}`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: userContent,
      config: {
        temperature: 0.2,
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        // Type-safe schema definition conforming to the schema of ProposalSchema
        responseSchema: {
          type: 'OBJECT',
          properties: {
            project_summary: { type: 'STRING' },
            features: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  title: { type: 'STRING' },
                  description: { type: 'STRING' },
                  technical_approach: { type: 'STRING' },
                  complexity: { type: 'STRING', enum: ['Low', 'Medium', 'High'] },
                  confidence: { type: 'STRING', enum: ['Low', 'Medium', 'High'] },
                  confidence_pct: { type: 'INTEGER' },
                  area: { type: 'STRING' }
                },
                required: ['title', 'description', 'technical_approach', 'complexity', 'confidence', 'confidence_pct', 'area']
              }
            },
            risks: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  label: { type: 'STRING' },
                  severity: { type: 'INTEGER' },
                  mitigation: { type: 'STRING' },
                  category: { type: 'STRING' }
                },
                required: ['label', 'severity', 'mitigation', 'category']
              }
            },
            timeline: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  phase: { type: 'STRING' },
                  duration: { type: 'STRING' },
                  tasks: { type: 'ARRAY', items: { type: 'STRING' } },
                  dependencies: { type: 'ARRAY', items: { type: 'STRING' } }
                },
                required: ['phase', 'duration', 'tasks', 'dependencies']
              }
            },
            delivery_plan: {
              type: 'OBJECT',
              properties: {
                mode: { type: 'STRING', enum: ['weekly'] },
                generatedFrom: { type: 'STRING', enum: ['llm', 'derived'] },
                weeks: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      id: { type: 'STRING' },
                      label: { type: 'STRING' },
                      startWeek: { type: 'INTEGER' },
                      endWeek: { type: 'INTEGER' },
                      sourcePhase: { type: 'STRING' },
                      goals: { type: 'ARRAY', items: { type: 'STRING' } },
                      tasks: {
                        type: 'ARRAY',
                        items: {
                          type: 'OBJECT',
                          properties: {
                            id: { type: 'STRING' },
                            title: { type: 'STRING' },
                            owner: { type: 'STRING', enum: ['team', 'client', 'shared'] },
                            status: { type: 'STRING', enum: ['planned', 'done', 'backlog'] },
                            notify: { type: 'BOOLEAN' }
                          },
                          required: ['id', 'title', 'owner', 'status', 'notify']
                        }
                      },
                      deliverables: { type: 'ARRAY', items: { type: 'STRING' } },
                      dependencies: { type: 'ARRAY', items: { type: 'STRING' } }
                    },
                    required: ['id', 'label', 'startWeek', 'endWeek', 'sourcePhase', 'goals', 'tasks', 'deliverables', 'dependencies']
                  }
                },
                roadmap: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      id: { type: 'STRING' },
                      title: { type: 'STRING' },
                      targetWeek: { type: 'INTEGER' },
                      sourceWeekIds: { type: 'ARRAY', items: { type: 'STRING' } },
                      status: { type: 'STRING', enum: ['planned', 'done'] }
                    },
                    required: ['id', 'title', 'targetWeek', 'sourceWeekIds', 'status']
                  }
                },
                backlog: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      id: { type: 'STRING' },
                      title: { type: 'STRING' },
                      sourceWeekId: { type: 'STRING' },
                      reason: { type: 'STRING', enum: ['timeline_overflow', 'future_enhancement', 'dependency_blocked'] },
                      status: { type: 'STRING', enum: ['backlog'] }
                    },
                    required: ['id', 'title', 'sourceWeekId', 'reason', 'status']
                  }
                },
                notificationDefaults: {
                  type: 'OBJECT',
                  properties: {
                    enabled: { type: 'BOOLEAN' },
                    channels: { type: 'ARRAY', items: { type: 'STRING', enum: ['in_app', 'email'] } },
                    events: { type: 'ARRAY', items: { type: 'STRING', enum: ['invite', 'comment', 'approval', 'assignment', 'goal_completed', 'backlog_moved'] } }
                  },
                  required: ['enabled', 'channels', 'events']
                }
              },
              required: ['mode', 'generatedFrom', 'weeks', 'roadmap', 'backlog', 'notificationDefaults']
            },
            effort: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  label: { type: 'STRING' },
                  percentage: { type: 'INTEGER' },
                  timeframe: { type: 'STRING' },
                  description: { type: 'STRING' }
                },
                required: ['label', 'percentage', 'timeframe', 'description']
              }
            },
            market: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  title: { type: 'STRING' },
                  description: { type: 'STRING' },
                  trend: { type: 'STRING', enum: ['up', 'down', 'stable'] },
                  relevance: { type: 'INTEGER' }
                },
                required: ['title', 'description', 'trend', 'relevance']
              }
            },
            impact: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  title: { type: 'STRING' },
                  description: { type: 'STRING' },
                  impact_score: { type: 'INTEGER' },
                  category: { type: 'STRING' }
                },
                required: ['title', 'description', 'impact_score', 'category']
              }
            }
          },
          required: ['project_summary', 'features', 'risks', 'timeline', 'delivery_plan', 'effort', 'market', 'impact']
        }
      }
    });

    const parsedJsonText = response.text || '';
    if (!parsedJsonText.trim()) {
      throw new Error('Optimizer response returned empty content.');
    }

    return ProposalSchema.parse(JSON.parse(parsedJsonText));
  } catch (error) {
    console.error('Failed to autonomously optimize proposal:', error);
    // If optimization fails, fallback to parsing with heuristics or return draft
    return proposal;
  }
}

/**
 * Main Orchestration function to evaluate proposals and enforce self-correction diagnostics.
 */
export async function processConfidenceGrid(
  briefText: string,
  proposal: Proposal,
  apiKey: string,
  modelName: string = 'gemini-2.5-pro',
  maxCorrectionCycles: number = 1
): Promise<ConfidenceGridResult> {
  if (!briefText || !briefText.trim()) {
    throw new Error('Confidence Grid processing failed: Brief text is empty.');
  }

  let currentProposal = proposal;
  let cycle = 0;
  let auditorEval!: AuditorEvaluation;
  let feasibilityEval!: FeasibilityEvaluation;
  let confidenceIndex = 0;
  let optimized = false;

  while (cycle <= maxCorrectionCycles) {
    // Run evaluation in parallel pipelines
    const [auditorResult, feasibilityResult] = await Promise.all([
      runAuditorAgent(briefText, currentProposal, apiKey, modelName),
      runFeasibilityAgent(briefText, currentProposal, apiKey, modelName)
    ]);

    auditorEval = auditorResult;
    feasibilityEval = feasibilityResult;

    // Mathematical consensus: mean of all 4 scores
    confidenceIndex = Math.round(
      (auditorEval.budget_alignment_score +
        auditorEval.deliverable_coverage_score +
        feasibilityEval.technical_feasibility_score +
        feasibilityEval.timeline_realism_score) /
        4
    );

    console.log(`Confidence Grid Cycle ${cycle} completed. Consensual Confidence Index: ${confidenceIndex}`);

    // Self-correction boundary validation
    if (confidenceIndex >= 75 || cycle === maxCorrectionCycles) {
      break;
    }

    // Collect all issues across personas
    const combinedIssues = [...auditorEval.issues, ...feasibilityEval.issues];
    
    if (combinedIssues.length === 0) {
      // If index is low but no issues listed, generate a generic prompt issue
      combinedIssues.push('Scores indicate overall misalignment across deliverables and timelines.');
    }

    // Trigger correction optimization
    currentProposal = await optimizeProposal(briefText, currentProposal, combinedIssues, apiKey, modelName);
    optimized = true;
    cycle++;
  }

  return {
    auditor: auditorEval,
    feasibility: feasibilityEval,
    confidenceIndex,
    optimized,
    finalProposal: currentProposal
  };
}
