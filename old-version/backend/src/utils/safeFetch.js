const { env } = require('../config/env');

const STATIC_ALLOWED_HOSTS = new Set([
  'github.com',
  'api.github.com',
  'accounts.google.com',
  'oauth2.googleapis.com',
  'www.googleapis.com',
  'slack.com',
  'api.slack.com',
  'hooks.slack.com',
  'api.tavily.com',
  'api.search.brave.com',
  'serpapi.com',
  'api.apify.com',
  'api.stripe.com',
]);

function addConfiguredHost(hosts, rawUrl) {
  try {
    if (rawUrl) hosts.add(new URL(rawUrl).hostname);
  } catch {
    // Ignore invalid optional provider URLs; env validation handles required URLs.
  }
}

function buildAllowedHosts(extraHosts = []) {
  const hosts = new Set([...STATIC_ALLOWED_HOSTS, ...extraHosts]);
  addConfiguredHost(hosts, env.OPENROUTER_BASE_URL);
  addConfiguredHost(hosts, env.XAI_BASE_URL);
  addConfiguredHost(hosts, env.OLLAMA_BASE_URL);
  return hosts;
}

function assertAllowedUrl(rawUrl, extraHosts = []) {
  const url = new URL(rawUrl);
  if (!['https:', 'http:'].includes(url.protocol)) {
    throw new Error('Outbound request protocol is not allowed.');
  }
  if (url.protocol === 'http:' && env.NODE_ENV === 'production') {
    throw new Error('Plain HTTP outbound requests are not allowed in production.');
  }
  if (!buildAllowedHosts(extraHosts).has(url.hostname)) {
    throw new Error(`Outbound host is not allowed: ${url.hostname}`);
  }
  return url;
}

async function safeFetch(rawUrl, options = {}, { timeoutMs = 20000, maxBytes = 2 * 1024 * 1024, extraHosts = [] } = {}) {
  try {
    assertAllowedUrl(rawUrl, extraHosts);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(rawUrl, { ...options, signal: controller.signal });
      const contentLength = Number(response.headers.get('content-length') || 0);
      if (contentLength > maxBytes) {
        throw new Error('Outbound response is too large.');
      }
      return response;
    } catch (error) {
      if (error?.name === 'AbortError') {
        const timeoutError = new Error(`Outbound request timed out after ${timeoutMs}ms.`);
        timeoutError.status = 504;
        throw timeoutError;
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      timestamp: new Date().toISOString(),
      event: 'OUTBOUND_HTTP_REQUEST_FAILED',
      url: rawUrl,
      method: options.method || 'GET',
      error: error.message,
      stack: error.stack,
    }, null, 2));
    throw error;
  }
}

module.exports = {
  assertAllowedUrl,
  safeFetch,
};
