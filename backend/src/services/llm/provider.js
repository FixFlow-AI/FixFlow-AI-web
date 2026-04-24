const { GoogleGenAI } = require('@google/genai');
const { env } = require('../../config/env');

let geminiClient = null;
let hasNormalizedGeminiEnv = false;

function normalizeGeminiEnvironment() {
  if (hasNormalizedGeminiEnv) {
    return;
  }

  // The SDK prefers GOOGLE_API_KEY when both are present, so clear the alias and
  // drive all requests through the explicitly configured key for this backend.
  if (process.env.GEMINI_API_KEY) {
    delete process.env.GOOGLE_API_KEY;
  }

  hasNormalizedGeminiEnv = true;
}

function getGeminiClient() {
  if (!env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }

  normalizeGeminiEnvironment();

  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  }

  return geminiClient;
}

module.exports = {
  getGeminiClient,
};
