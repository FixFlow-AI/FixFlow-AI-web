const { GoogleGenAI } = require('@google/genai');
const { env } = require('../../config/env');
const {
  createGeminiGuard,
  getGeminiAuthErrorMessage,
  getGeminiModelCandidates,
  isGeminiAuthError,
  isGeminiModelError,
  isGeminiQuotaError,
} = require('./geminiGuard');

let geminiClient = null;
const geminiGuard = createGeminiGuard({ cooldownMs: env.GEMINI_KEY_GUARD_MS });

function getGeminiClient() {
  if (!env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }

  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  }

  return geminiClient;
}

function extractJsonText(response) {
  if (typeof response?.text === 'string' && response.text.trim()) {
    return response.text.trim();
  }

  return String(response?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
}

async function runStructuredRequest({ model, system, user, jsonSchema, temperature, maxOutputTokens }) {
  const gemini = getGeminiClient();
  const response = await gemini.models.generateContent({
    model,
    contents: user,
    config: {
      temperature,
      maxOutputTokens,
      systemInstruction: system,
      responseMimeType: 'application/json',
      responseJsonSchema: jsonSchema,
    },
  });

  return extractJsonText(response);
}

async function generateStructuredJSON({
  system,
  user,
  jsonSchema,
  temperature = 0.2,
  maxOutputTokens = 4000,
}) {
  geminiGuard.assertAvailable();

  const models = getGeminiModelCandidates(env.GEMINI_MODEL, env.GEMINI_FALLBACK_MODEL);
  let lastError = null;

  for (let index = 0; index < models.length; index += 1) {
    const model = models[index];

    try {
      return await runStructuredRequest({
        model,
        system,
        user,
        jsonSchema,
        temperature,
        maxOutputTokens,
      });
    } catch (error) {
      lastError = error;

      if (isGeminiAuthError(error)) {
        geminiGuard.markHardFailure(error);
        throw new Error(getGeminiAuthErrorMessage(error, { model }));
      }

      if (index < models.length - 1 && (isGeminiQuotaError(error) || isGeminiModelError(error))) {
        continue;
      }

      throw error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error('Structured Gemini generation failed without an explicit error.');
}

module.exports = {
  generateStructuredJSON,
};
