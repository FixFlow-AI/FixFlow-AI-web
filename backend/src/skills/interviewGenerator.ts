import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';

// ==========================================
// Structured Output Schemas & Types
// ==========================================

export const InterviewQuestionSchema = z.object({
  question: z.string().min(1, 'Question text is required'),
  rationale: z.string().min(1, 'Rationale is required'),
  expectedKeywords: z.array(z.string()),
  idealAnswerSummary: z.string().min(1, 'Ideal answer summary is required')
});

export const InterviewOutputSchema = z.object({
  questions: z.array(InterviewQuestionSchema)
});

export type InterviewQuestion = z.infer<typeof InterviewQuestionSchema>;
export type InterviewOutput = z.infer<typeof InterviewOutputSchema>;

// ==========================================
// Core Interview Generator Function
// ==========================================

/**
 * Generates 3-5 customized technical interview questions using Gemini,
 * analyzing the project brief, candidate's GitHub scan, and skills gap.
 * 
 * Keep files clean, modular, and under 300 lines.
 */
export async function generateInterviewQuestions(
  briefText: string,
  githubScan: string | Record<string, any>,
  missingSkills: string[],
  apiKey: string,
  modelName: string = 'gemini-2.5-pro'
): Promise<InterviewOutput> {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Interview Generator: API key is required.');
  }

  const ai = new GoogleGenAI({ apiKey });

  const githubScanStr = typeof githubScan === 'string'
    ? githubScan
    : JSON.stringify(githubScan, null, 2);

  const missingSkillsStr = Array.isArray(missingSkills)
    ? missingSkills.join(', ')
    : 'None';

  const systemPrompt = `You are the Lead Technical Interview Architect Agent for FixFlow AI.
Your job is to generate 3 to 5 highly targeted technical screening questions for a freelancer applying for a project.

You will be provided with:
1. The project description/brief.
2. The candidate's GitHub scan summary (used to see their strengths, repository topics, and languages).
3. A list of missing skills (skills required by the project brief that weren't detected in their GitHub scan).

Generate custom questions to address:
- How they plan to handle the technical aspects requiring their missing skills.
- Specific architectural or tool choices from the project brief.
- Relevant experience from their GitHub profile that maps to the project.

Output strictly in JSON conforming to the requested schema. Do not output markdown decorators or extra prose.`;

  const userContent = `Project Brief:\n${briefText}\n\nCandidate GitHub Scan:\n${githubScanStr}\n\nMissing Skills:\n${missingSkillsStr}`;

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
            questions: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  question: { type: 'STRING' },
                  rationale: { type: 'STRING' },
                  expectedKeywords: { type: 'ARRAY', items: { type: 'STRING' } },
                  idealAnswerSummary: { type: 'STRING' }
                },
                required: ['question', 'rationale', 'expectedKeywords', 'idealAnswerSummary']
              }
            }
          },
          required: ['questions']
        }
      }
    });

    const parsedJsonText = response.text || '';
    if (!parsedJsonText.trim()) {
      throw new Error('Interview generator LLM response returned empty text.');
    }

    return InterviewOutputSchema.parse(JSON.parse(parsedJsonText));
  } catch (error) {
    console.error('Interview Generator Exception, applying fallback:', error);
    
    // Provide a safe fallback question set based on inputs
    const fallbackQuestions: InterviewQuestion[] = [];

    if (Array.isArray(missingSkills) && missingSkills.length > 0) {
      missingSkills.slice(0, 3).forEach(skill => {
        fallbackQuestions.push({
          question: `The project requirements mention ${skill}, which wasn't prominent in your recent public repositories. Can you describe your familiarity with ${skill} and how you would ramp up for this project?`,
          rationale: `Addresses detected skills gap for critical requirement: ${skill}`,
          expectedKeywords: [skill, 'experience', 'learning curve', 'architecture'],
          idealAnswerSummary: `Candidate discusses their conceptual understanding, any private project experience, and a plan to quickly master the skill.`
        });
      });
    }

    // Add generic project delivery and GitHub related questions if needed
    if (fallbackQuestions.length < 3) {
      fallbackQuestions.push({
        question: "Based on the project brief, how would you structure the milestones and testing strategy to ensure stable deliveries?",
        rationale: "Evaluates project planning, architectural strategy, and milestones setup.",
        expectedKeywords: ['milestone', 'deliverables', 'testing', 'CI/CD', 'verification'],
        idealAnswerSummary: "Candidate provides a structured phased approach containing unit tests and delivery feedback loops."
      });
    }

    if (fallbackQuestions.length < 3) {
      fallbackQuestions.push({
        question: "How do your previous projects on GitHub prepare you for the technical stack requested in this brief?",
        rationale: "Maps candidate's self-reported experience/GitHub footprint to the project.",
        expectedKeywords: ['repositories', 'development', 'stack', 'frameworks'],
        idealAnswerSummary: "Candidate connects specific public repos or commits to tasks required in the brief."
      });
    }

    return {
      questions: fallbackQuestions.slice(0, 5)
    };
  }
}
