const { env } = require('../../config/env');
const { safeFetch } = require('../../utils/safeFetch');

function trimTrailingSlash(value = '') {
  return String(value || '').replace(/\/+$/, '');
}

function buildProviderError(provider, response, bodyText = '') {
  let message = bodyText;
  try {
    const parsed = JSON.parse(bodyText);
    message = parsed.error?.message || parsed.message || bodyText;
  } catch {
    // Keep the raw provider response.
  }

  const error = new Error(`${provider.label || provider.id} request failed (${response.status}): ${message || response.statusText}`);
  error.status = response.status;
  error.provider = provider.id;
  error.headers = Object.fromEntries(response.headers.entries());
  return error;
}

function isRetryableProviderError(error) {
  const status = Number(error?.status ?? error?.response?.status ?? NaN);
  return [408, 409, 425, 429, 500, 502, 503, 504].includes(status);
}

function isAuthProviderError(error) {
  const status = Number(error?.status ?? error?.response?.status ?? NaN);
  return [401, 403].includes(status) || /api key|unauthorized|forbidden|not enabled|billing/i.test(error?.message || '');
}

async function fetchWithTimeout(url, options = {}, timeoutMs = env.STREAM_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await safeFetch(url, {
      ...options,
      signal: controller.signal,
    }, { timeoutMs, maxBytes: 20 * 1024 * 1024 });
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error(`LLM request timed out after ${timeoutMs}ms.`);
      timeoutError.status = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function getOpenAiHeaders(provider) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${provider.apiKey}`,
    ...(provider.headers || {}),
  };
}

function buildOpenAiMessages(system, user) {
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

function extractOpenAiContent(payload) {
  const content = payload?.choices?.[0]?.message?.content;

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => part?.text || part?.content || '')
      .filter(Boolean)
      .join('');
  }

  return String(payload?.choices?.[0]?.text || '').trim();
}

async function completeOpenAiCompatibleProvider(provider, {
  system,
  user,
  temperature = 0.2,
  maxOutputTokens = 4000,
  jsonMode = false,
}) {
  const response = await fetchWithTimeout(`${trimTrailingSlash(provider.baseUrl)}/chat/completions`, {
    method: 'POST',
    headers: getOpenAiHeaders(provider),
    body: JSON.stringify({
      model: provider.model || provider.primaryModel,
      messages: buildOpenAiMessages(system, user),
      temperature,
      max_tokens: maxOutputTokens,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  const bodyText = await response.text();
  if (!response.ok) {
    throw buildProviderError(provider, response, bodyText);
  }

  return extractOpenAiContent(JSON.parse(bodyText));
}

async function* streamOpenAiCompatibleProvider(provider, {
  system,
  user,
  temperature = 0.3,
  maxOutputTokens = 8000,
  jsonMode = false,
}) {
  const response = await fetchWithTimeout(`${trimTrailingSlash(provider.baseUrl)}/chat/completions`, {
    method: 'POST',
    headers: getOpenAiHeaders(provider),
    body: JSON.stringify({
      model: provider.model || provider.primaryModel,
      messages: buildOpenAiMessages(system, user),
      temperature,
      max_tokens: maxOutputTokens,
      stream: true,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  if (!response.ok) {
    throw buildProviderError(provider, response, await response.text());
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error(`${provider.label || provider.id} did not return a readable stream.`);
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';

    for (const event of events) {
      const dataLines = event
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.replace(/^data:\s*/, ''));

      for (const dataLine of dataLines) {
        if (!dataLine || dataLine === '[DONE]') {
          continue;
        }

        const payload = JSON.parse(dataLine);
        const rawContent = payload?.choices?.[0]?.delta?.content || payload?.choices?.[0]?.message?.content || '';
        const content = Array.isArray(rawContent)
          ? rawContent.map((part) => part?.text || part?.content || '').join('')
          : rawContent;
        if (content) {
          yield content;
        }
      }
    }
  }
}

function getOllamaHeaders(provider) {
  return {
    'Content-Type': 'application/json',
    ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}),
  };
}

async function completeOllamaProvider(provider, {
  system,
  user,
  temperature = 0.2,
  jsonMode = false,
}) {
  const response = await fetchWithTimeout(`${trimTrailingSlash(provider.baseUrl)}/api/chat`, {
    method: 'POST',
    headers: getOllamaHeaders(provider),
    body: JSON.stringify({
      model: provider.model || provider.primaryModel,
      messages: buildOpenAiMessages(system, user),
      stream: false,
      options: { temperature },
      ...(jsonMode ? { format: 'json' } : {}),
    }),
  });

  const bodyText = await response.text();
  if (!response.ok) {
    throw buildProviderError(provider, response, bodyText);
  }

  const payload = JSON.parse(bodyText);
  return payload?.message?.content || payload?.response || '';
}

async function* streamOllamaProvider(provider, {
  system,
  user,
  temperature = 0.3,
  jsonMode = false,
}) {
  const response = await fetchWithTimeout(`${trimTrailingSlash(provider.baseUrl)}/api/chat`, {
    method: 'POST',
    headers: getOllamaHeaders(provider),
    body: JSON.stringify({
      model: provider.model || provider.primaryModel,
      messages: buildOpenAiMessages(system, user),
      stream: true,
      options: { temperature },
      ...(jsonMode ? { format: 'json' } : {}),
    }),
  });

  if (!response.ok) {
    throw buildProviderError(provider, response, await response.text());
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error(`${provider.label || provider.id} did not return a readable stream.`);
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      const payload = JSON.parse(line);
      const content = payload?.message?.content || payload?.response || '';
      if (content) {
        yield content;
      }
    }
  }
}

module.exports = {
  completeOllamaProvider,
  completeOpenAiCompatibleProvider,
  isAuthProviderError,
  isRetryableProviderError,
  streamOllamaProvider,
  streamOpenAiCompatibleProvider,
};
