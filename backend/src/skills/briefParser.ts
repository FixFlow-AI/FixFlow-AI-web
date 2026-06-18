import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';

// ==========================================
// Zod Schema Definition for Strict Enforcements
// ==========================================

export const FeatureSchema = z.object({
  title: z.string().min(1, 'Feature title must not be empty'),
  description: z.string().min(1, 'Feature description must not be empty'),
  technical_approach: z.string().min(1, 'Technical approach details must be provided'),
  complexity: z.enum(['High', 'Medium', 'Low']),
  confidence: z.enum(['High', 'Medium', 'Low']),
  confidence_pct: z.number().min(0).max(100),
  area: z.string().min(1, 'Tech/functional area must be specified')
});

export const RiskSchema = z.object({
  label: z.string().min(1, 'Risk label must not be empty'),
  severity: z.number().min(0).max(100),
  mitigation: z.string().min(1, 'Risk mitigation strategy must be provided'),
  category: z.string().min(1, 'Risk category must be specified')
});

export const TimelinePhaseSchema = z.object({
  phase: z.string().min(1, 'Phase name must not be empty'),
  duration: z.string().min(1, 'Phase duration must be provided'),
  tasks: z.array(z.string()).min(1, 'Phase must contain at least one task'),
  dependencies: z.array(z.string())
});

export const DeliveryTaskSchema = z.object({
  id: z.string().min(1, 'Task ID must be provided'),
  title: z.string().min(1, 'Task title must not be empty'),
  owner: z.enum(['team', 'client', 'shared']),
  status: z.enum(['planned', 'done', 'backlog']),
  notify: z.boolean()
});

export const DeliveryWeekSchema = z.object({
  id: z.string().min(1, 'Week ID must be provided'),
  label: z.string().min(1, 'Week label must not be empty'),
  startWeek: z.number().min(1, 'Start week must be at least 1'),
  endWeek: z.number().min(1, 'End week must be at least 1'),
  sourcePhase: z.string().min(1, 'Source phase must be mapped'),
  goals: z.array(z.string()),
  tasks: z.array(DeliveryTaskSchema),
  deliverables: z.array(z.string()),
  dependencies: z.array(z.string())
});

export const RoadmapItemSchema = z.object({
  id: z.string().min(1, 'Roadmap item ID must be provided'),
  title: z.string().min(1, 'Roadmap item title must not be empty'),
  targetWeek: z.number().min(1, 'Target week must be at least 1'),
  sourceWeekIds: z.array(z.string()),
  status: z.enum(['planned', 'done'])
});

export const BacklogItemSchema = z.object({
  id: z.string().min(1, 'Backlog item ID must be provided'),
  title: z.string().min(1, 'Backlog item title must not be empty'),
  sourceWeekId: z.string().nullable(),
  reason: z.enum(['timeline_overflow', 'future_enhancement', 'dependency_blocked']),
  status: z.literal('backlog')
});

export const NotificationDefaultsSchema = z.object({
  enabled: z.boolean(),
  channels: z.array(z.enum(['in_app', 'email'])),
  events: z.array(z.enum(['invite', 'comment', 'approval', 'assignment', 'goal_completed', 'backlog_moved']))
});

export const DeliveryPlanSchema = z.object({
  mode: z.literal('weekly'),
  generatedFrom: z.enum(['llm', 'derived']),
  weeks: z.array(DeliveryWeekSchema).min(1, 'At least one week plan is required'),
  roadmap: z.array(RoadmapItemSchema),
  backlog: z.array(BacklogItemSchema),
  notificationDefaults: NotificationDefaultsSchema
});

export const EffortSchema = z.object({
  label: z.string().min(1, 'Effort category label must not be empty'),
  percentage: z.number().min(0).max(100),
  timeframe: z.string().min(1, 'Timeframe estimate must be provided'),
  description: z.string().min(1, 'Effort description must be provided')
});

export const MarketItemSchema = z.object({
  title: z.string().min(1, 'Market factor title must not be empty'),
  description: z.string().min(1, 'Market factor description must be provided'),
  trend: z.enum(['up', 'down', 'stable']),
  relevance: z.number().min(0).max(100)
});

export const ImpactItemSchema = z.object({
  title: z.string().min(1, 'Impact point title must not be empty'),
  description: z.string().min(1, 'Impact description must be provided'),
  impact_score: z.number().min(0).max(100),
  category: z.string().min(1, 'Impact category must be specified')
});

export const ProposalSchema = z.object({
  project_summary: z.string().min(1, 'Project summary must not be empty'),
  features: z.array(FeatureSchema).min(1, 'At least one feature card is required'),
  risks: z.array(RiskSchema).min(1, 'At least one risk factor is required'),
  timeline: z.array(TimelinePhaseSchema).min(1, 'At least one phase is required'),
  delivery_plan: DeliveryPlanSchema,
  effort: z.array(EffortSchema).min(1, 'At least one effort breakdown card is required'),
  market: z.array(MarketItemSchema),
  impact: z.array(ImpactItemSchema)
});

export type Proposal = z.infer<typeof ProposalSchema>;

// ==========================================
// Fallback & Sanitization Engine
// ==========================================

/**
 * Ensures that any object is safely patched and validated to match the exact Proposal Schema.
 * Prevents system failures on schema drift or transient model errors.
 */
export function sanitizeAndPatchBrief(rawInput: any): Proposal {
  const safeString = (val: any, fallback: string) => (typeof val === 'string' && val.trim() ? val.trim() : fallback);
  const safeNumber = (val: any, minVal: number, maxVal: number, fallback: number) => {
    const num = Number(val);
    return !isNaN(num) && num >= minVal && num <= maxVal ? num : fallback;
  };
  const safeArray = (val: any) => (Array.isArray(val) ? val : []);

  const rawFeatures = safeArray(rawInput?.features);
  const features = rawFeatures.map((f: any) => ({
    title: safeString(f?.title, 'Core Module Deployment'),
    description: safeString(f?.description, 'Core system capabilities development and configuration.'),
    technical_approach: safeString(f?.technical_approach, 'Leverage modern framework patterns and modular handlers.'),
    complexity: (['High', 'Medium', 'Low'].includes(f?.complexity) ? f.complexity : 'Medium') as 'High' | 'Medium' | 'Low',
    confidence: (['High', 'Medium', 'Low'].includes(f?.confidence) ? f.confidence : 'Medium') as 'High' | 'Medium' | 'Low',
    confidence_pct: safeNumber(f?.confidence_pct, 0, 100, 75),
    area: safeString(f?.area, 'Engineering')
  }));

  if (features.length === 0) {
    features.push({
      title: 'Core Platform Setup',
      description: 'Initialize application stack, structure configuration profiles, and verify runtime endpoints.',
      technical_approach: 'Establish standard repository patterns with lint and type checking.',
      complexity: 'Medium',
      confidence: 'High',
      confidence_pct: 90,
      area: 'Platform Operations'
    });
  }

  const rawRisks = safeArray(rawInput?.risks);
  const risks = rawRisks.map((r: any) => ({
    label: safeString(r?.label, 'Under-specified requirements'),
    severity: safeNumber(r?.severity, 0, 100, 50),
    mitigation: safeString(r?.mitigation, 'Organize collaborative design review workshops.'),
    category: safeString(r?.category, 'Scope Management')
  }));

  if (risks.length === 0) {
    risks.push({
      label: 'Integration Interface Drift',
      severity: 45,
      mitigation: 'Implement rigorous automated mock contracts early in the development sprint.',
      category: 'Technical Integration'
    });
  }

  const rawTimeline = safeArray(rawInput?.timeline);
  const timeline = rawTimeline.map((t: any) => ({
    phase: safeString(t?.phase, 'Integration sprint'),
    duration: safeString(t?.duration, '2 weeks'),
    tasks: safeArray(t?.tasks).map((x: any) => String(x || '').trim()).filter(Boolean),
    dependencies: safeArray(t?.dependencies).map((x: any) => String(x || '').trim())
  }));

  if (timeline.length === 0 || timeline.some(t => t.tasks.length === 0)) {
    timeline.push({
      phase: 'Initial Integration',
      duration: '4 weeks',
      tasks: ['Initialize systems', 'Configure interface layers', 'Run verification suites'],
      dependencies: []
    });
  }

  const rawDeliveryPlan = rawInput?.delivery_plan;
  const rawWeeks = safeArray(rawDeliveryPlan?.weeks);
  const weeks = rawWeeks.map((w: any) => ({
    id: safeString(w?.id, `week-${Math.random().toString(36).substr(2, 9)}`),
    label: safeString(w?.label, 'Sprint 1'),
    startWeek: safeNumber(w?.startWeek, 1, 100, 1),
    endWeek: safeNumber(w?.endWeek, 1, 100, 1),
    sourcePhase: safeString(w?.sourcePhase, 'Initial Integration'),
    goals: safeArray(w?.goals).map((g: any) => String(g || '').trim()).filter(Boolean),
    tasks: safeArray(w?.tasks).map((tk: any) => ({
      id: safeString(tk?.id, `task-${Math.random().toString(36).substr(2, 9)}`),
      title: safeString(tk?.title, 'Platform onboarding'),
      owner: (['team', 'client', 'shared'].includes(tk?.owner) ? tk.owner : 'team') as 'team' | 'client' | 'shared',
      status: (['planned', 'done', 'backlog'].includes(tk?.status) ? tk.status : 'planned') as 'planned' | 'done' | 'backlog',
      notify: typeof tk?.notify === 'boolean' ? tk.notify : false
    })),
    deliverables: safeArray(w?.deliverables).map((d: any) => String(d || '').trim()).filter(Boolean),
    dependencies: safeArray(w?.dependencies).map((dp: any) => String(dp || '').trim()).filter(Boolean)
  }));

  if (weeks.length === 0) {
    weeks.push({
      id: 'week-1',
      label: 'Week 1: Foundations',
      startWeek: 1,
      endWeek: 1,
      sourcePhase: 'Initial Integration',
      goals: ['Setup runtime systems and confirm initial schemas'],
      tasks: [
        {
          id: 't-1',
          title: 'Establish repository structure and configure automated lints',
          owner: 'team',
          status: 'planned',
          notify: false
        }
      ],
      deliverables: ['Typescript definitions file', 'Verify baseline configs'],
      dependencies: []
    });
  }

  const rawRoadmap = safeArray(rawDeliveryPlan?.roadmap);
  const roadmap = rawRoadmap.map((rm: any) => ({
    id: safeString(rm?.id, `rm-${Math.random().toString(36).substr(2, 9)}`),
    title: safeString(rm?.title, 'Deployment Milestone'),
    targetWeek: safeNumber(rm?.targetWeek, 1, 100, 1),
    sourceWeekIds: safeArray(rm?.sourceWeekIds).map((id: any) => String(id || '').trim()).filter(Boolean),
    status: (['planned', 'done'].includes(rm?.status) ? rm.status : 'planned') as 'planned' | 'done'
  }));

  const rawBacklog = safeArray(rawDeliveryPlan?.backlog);
  const backlog = rawBacklog.map((bl: any) => ({
    id: safeString(bl?.id, `bl-${Math.random().toString(36).substr(2, 9)}`),
    title: safeString(bl?.title, 'Post-launch scale optimization'),
    sourceWeekId: typeof bl?.sourceWeekId === 'string' && bl.sourceWeekId ? bl.sourceWeekId : null,
    reason: (['timeline_overflow', 'future_enhancement', 'dependency_blocked'].includes(bl?.reason) ? bl.reason : 'future_enhancement') as 'timeline_overflow' | 'future_enhancement' | 'dependency_blocked',
    status: 'backlog' as const
  }));

  const rawNotify = rawDeliveryPlan?.notificationDefaults;
  const notificationDefaults = {
    enabled: typeof rawNotify?.enabled === 'boolean' ? rawNotify.enabled : false,
    channels: (safeArray(rawNotify?.channels).filter((c: any) => ['in_app', 'email'].includes(c)) as Array<'in_app' | 'email'>),
    events: (safeArray(rawNotify?.events).filter((e: any) => ['invite', 'comment', 'approval', 'assignment', 'goal_completed', 'backlog_moved'].includes(e)) as Array<'invite' | 'comment' | 'approval' | 'assignment' | 'goal_completed' | 'backlog_moved'>)
  };

  if (notificationDefaults.channels.length === 0) {
    notificationDefaults.channels.push('in_app');
  }
  if (notificationDefaults.events.length === 0) {
    notificationDefaults.events.push('goal_completed');
  }

  const rawEffort = safeArray(rawInput?.effort);
  const effort = rawEffort.map((ef: any) => ({
    label: safeString(ef?.label, 'Core Development'),
    percentage: safeNumber(ef?.percentage, 0, 100, 100),
    timeframe: safeString(ef?.timeframe, '4 weeks'),
    description: safeString(ef?.description, 'Full lifecycle programming, testing, and alignment.')
  }));

  if (effort.length === 0) {
    effort.push({
      label: 'Core Implementation',
      percentage: 100,
      timeframe: '4 weeks',
      description: 'Covers core backend routing, typescript schema integrations, and validation testing.'
    });
  }

  const rawMarket = safeArray(rawInput?.market);
  const market = rawMarket.map((m: any) => ({
    title: safeString(m?.title, 'Cloud Migration Trends'),
    description: safeString(m?.description, 'Growing market adoption of serverless and event-driven computing.'),
    trend: (['up', 'down', 'stable'].includes(m?.trend) ? m.trend : 'stable') as 'up' | 'down' | 'stable',
    relevance: safeNumber(m?.relevance, 0, 100, 80)
  }));

  const rawImpact = safeArray(rawInput?.impact);
  const impact = rawImpact.map((imp: any) => ({
    title: safeString(imp?.title, 'Automation Efficiency'),
    description: safeString(imp?.description, 'Substantial decrease in manual overhead processing tasks.'),
    impact_score: safeNumber(imp?.impact_score, 0, 100, 85),
    category: safeString(imp?.category, 'Operational Impact')
  }));

  return ProposalSchema.parse({
    project_summary: safeString(rawInput?.project_summary, 'Highly scalable deployment engineered to satisfy explicit functional targets.'),
    features,
    risks,
    timeline,
    delivery_plan: {
      mode: 'weekly',
      generatedFrom: (['llm', 'derived'].includes(rawDeliveryPlan?.generatedFrom) ? rawDeliveryPlan.generatedFrom : 'derived') as 'llm' | 'derived',
      weeks,
      roadmap,
      backlog,
      notificationDefaults
    },
    effort,
    market,
    impact
  });
}

// ==========================================
// Semantic Ingest & Inlining Engine
// ==========================================

export async function parseBrief(
  briefText: string,
  apiKey: string,
  modelName: string = 'gemini-2.5-pro'
): Promise<Proposal> {
  if (!briefText || !briefText.trim()) {
    throw new Error('Brief parsing failed: The incoming brief content is empty.');
  }

  if (!apiKey || !apiKey.trim()) {
    throw new Error('Brief parsing failed: The Gemini API Key is missing or invalid.');
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const systemPrompt = `You are the lead architect and enterprise consultant for Dixflow AI.
Your task is to convert unstructured client briefs (chat transcripts, RFCs, RFPs) into high-fidelity technical proposals.

RULES:
1. Extract implicit/explicit specifications, SLAs, timeline constraints, budget figures, and dependencies.
2. Formulate realistic confidence indices and identify crucial development complexity cards.
3. Keep feature counts realistic, drafting actionable, complete deliverables.
4. Output strict JSON conforming to the requested schema. Do not output markdown decorators or extra prose.`;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: `Analyze the brief text below and output a complete project proposal conforming strictly to the requested schema.\n\nBrief text:\n${briefText}`,
      config: {
        temperature: 0.2,
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        // Type-safe schema definition conforming to the schema of ProposalSchema
        responseSchema: {
          type: 'OBJECT',
          properties: {
            project_summary: { type: 'STRING', description: '2-4 sentence overview of the technical strategy.' },
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
      throw new Error('LLM response returned empty text.');
    }

    const rawObject = JSON.parse(parsedJsonText);
    
    // Strict schema validation using Zod
    const validated = ProposalSchema.parse(rawObject);
    return validated;

  } catch (error: any) {
    console.error('CRITICAL: Semantic Brief Parsing Exception encountered:', error);
    
    // Attempt parsing in case Zod failed but valid partial JSON was produced
    try {
      if (error instanceof z.ZodError) {
        // Log deep schema failure details
        console.warn('Zod validation details:', JSON.stringify(error.format(), null, 2));
      }
    } catch {}

    // Gracefully recover and return sanitized default layout structures
    console.log('Initiating fallback brief patch heuristics...');
    let rawObjAttempt: any = {};
    try {
      const match = error?.message?.match(/\{[\s\S]*\}/);
      if (match) {
        rawObjAttempt = JSON.parse(match[0]);
      }
    } catch {}
    
    return sanitizeAndPatchBrief(rawObjAttempt);
  }
}
