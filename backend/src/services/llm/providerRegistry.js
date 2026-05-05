const { env } = require('../../config/env');
const { getGeminiModelCandidates } = require('./geminiGuard');

function parseList(...sources) {
  return [
    ...new Set(
      sources
        .flatMap((source) => String(source || '').split(','))
        .map((item) => item.trim())
        .filter(Boolean)
    ),
  ];
}

function orderFromEnv(raw, fallback) {
  const order = parseList(raw);
  return order.length ? order : fallback;
}

function buildProvider({
  id,
  label,
  kind = 'openai-compatible',
  apiKey,
  baseUrl,
  primaryModel,
  fallbackModels,
  headers = {},
}) {
  const models = parseList(primaryModel, fallbackModels);
  return {
    id,
    label,
    kind,
    configured: Boolean(apiKey),
    apiKey,
    baseUrl,
    models,
    primaryModel: models[0] || '',
    headers,
  };
}

function getProviderMap() {
  return {
    gemini: buildProvider({
      id: 'gemini',
      label: 'Google Gemini',
      kind: 'gemini',
      apiKey: env.GEMINI_API_KEY,
      primaryModel: env.GEMINI_MODEL,
      fallbackModels: parseList(env.GEMINI_FALLBACK_MODEL, env.GEMINI_MODEL_FALLBACKS).join(','),
    }),
    openrouter: buildProvider({
      id: 'openrouter',
      label: 'OpenRouter',
      apiKey: env.OPENROUTER_API_KEY,
      baseUrl: env.OPENROUTER_BASE_URL,
      primaryModel: env.OPENROUTER_MODEL,
      fallbackModels: env.OPENROUTER_MODEL_FALLBACKS,
      headers: {
        'HTTP-Referer': env.OPENROUTER_SITE_URL,
        'X-Title': env.OPENROUTER_APP_NAME,
      },
    }),
    xai: buildProvider({
      id: 'xai',
      label: 'xAI Grok',
      apiKey: env.XAI_API_KEY,
      baseUrl: env.XAI_BASE_URL,
      primaryModel: env.XAI_MODEL,
      fallbackModels: env.XAI_MODEL_FALLBACKS,
    }),
    ollama: buildProvider({
      id: 'ollama',
      label: 'Ollama Cloud',
      kind: 'ollama',
      apiKey: env.OLLAMA_API_KEY,
      baseUrl: env.OLLAMA_BASE_URL,
      primaryModel: env.OLLAMA_MODEL,
      fallbackModels: env.OLLAMA_MODEL_FALLBACKS,
    }),
  };
}

function getConfiguredLlmProviders({ includeUnconfigured = false } = {}) {
  const providerMap = getProviderMap();
  const order = orderFromEnv(env.LLM_PROVIDER_ORDER, ['gemini', 'openrouter', 'xai', 'ollama']);

  return order
    .map((id) => providerMap[id])
    .filter(Boolean)
    .map((provider) => {
      if (provider.id !== 'gemini') {
        return provider;
      }

      return {
        ...provider,
        models: getGeminiModelCandidates(
          env.GEMINI_MODEL,
          env.GEMINI_FALLBACK_MODEL,
          env.GEMINI_MODEL_FALLBACKS
        ),
        primaryModel: env.GEMINI_MODEL,
      };
    })
    .filter((provider) => includeUnconfigured || provider.configured);
}

function getLlmProviderStatus() {
  return getConfiguredLlmProviders({ includeUnconfigured: true }).map((provider, index) => ({
    id: provider.id,
    label: provider.label,
    configured: provider.configured,
    order: index + 1,
    primaryModel: provider.primaryModel,
    fallbackModels: provider.models.slice(1),
  }));
}

module.exports = {
  getConfiguredLlmProviders,
  getLlmProviderStatus,
  parseList,
};
