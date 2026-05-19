const { env } = require('../../config/env');
const { BadRequestError } = require('../../utils/errors');
const { buildFrontendUrl } = require('../../utils/frontendOrigin');
const { safeFetch } = require('../../utils/safeFetch');
const { decryptSecret, encryptSecret, signState, verifyState } = require('./secretCrypto');

const SLACK_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

function ensureSlackConfigured() {
  if (!env.SLACK_CLIENT_ID || !env.SLACK_CLIENT_SECRET) {
    throw new BadRequestError('Slack integration is not configured on the server.');
  }
}

function validateSlackState(state, now = Date.now()) {
  const payload = verifyState(state);
  const createdAt = Number(payload.createdAt);
  if (!Number.isFinite(createdAt) || now - createdAt > SLACK_OAUTH_STATE_TTL_MS || createdAt - now > 60 * 1000) {
    throw new BadRequestError('Slack OAuth state expired. Please restart the install.');
  }
  return payload;
}

function buildSlackInstallUrl({ workspaceId, userId }) {
  ensureSlackConfigured();
  const authorizeUrl = new URL('https://slack.com/oauth/v2/authorize');
  authorizeUrl.searchParams.set('client_id', env.SLACK_CLIENT_ID);
  authorizeUrl.searchParams.set('scope', env.SLACK_SCOPES || 'incoming-webhook');
  authorizeUrl.searchParams.set('redirect_uri', env.SLACK_REDIRECT_URI);
  authorizeUrl.searchParams.set('state', signState({
    workspaceId: workspaceId.toString(),
    userId: userId.toString(),
    createdAt: Date.now(),
  }));
  return authorizeUrl.toString();
}

async function exchangeSlackCode(code) {
  ensureSlackConfigured();
  const body = new URLSearchParams({
    code,
    redirect_uri: env.SLACK_REDIRECT_URI,
  });
  const basic = Buffer.from(`${env.SLACK_CLIENT_ID}:${env.SLACK_CLIENT_SECRET}`).toString('base64');

  const response = await safeFetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    throw new BadRequestError('Slack OAuth exchange failed.');
  }

  const payload = await response.json();
  if (!payload.ok) {
    throw new BadRequestError(payload.error || 'Slack OAuth exchange failed.');
  }

  if (!payload.incoming_webhook?.url) {
    throw new BadRequestError('Slack did not return an incoming webhook. Check app scopes.');
  }

  return payload;
}

function buildSlackStatus(workspace) {
  const slack = workspace?.slack || {};
  return {
    connected: slack.status === 'connected' && Boolean(slack.webhookUrlEncrypted),
    status: slack.status || 'disconnected',
    teamId: slack.teamId || '',
    teamName: slack.teamName || '',
    channelId: slack.channelId || '',
    channelName: slack.channelName || '',
    installedAt: slack.installedAt || null,
    lastDeliveryStatus: slack.lastDeliveryStatus || '',
    lastDeliveryAt: slack.lastDeliveryAt || null,
  };
}

function buildSlackMessage({ title, body, metadata = {}, frontendPath = '/workspace' }) {
  const appUrl = buildFrontendUrl(frontendPath);
  const fields = Object.entries(metadata || {})
    .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
    .slice(0, 4)
    .map(([key, value]) => ({
      type: 'mrkdwn',
      text: `*${key}*\n${String(value)}`,
    }));

  return {
    text: `${title}: ${body}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${title}*\n${body}`,
        },
      },
      ...(fields.length ? [{ type: 'section', fields }] : []),
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Open in FixFlowAI',
            },
            url: appUrl,
          },
        ],
      },
    ],
    unfurl_links: false,
    unfurl_media: false,
  };
}

async function sendSlackWebhook(webhookUrl, message) {
  const response = await safeFetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });

  const text = await response.text();
  if (!response.ok || text !== 'ok') {
    throw new Error(text || `Slack webhook failed with HTTP ${response.status}`);
  }

  return 'sent';
}

async function sendWorkspaceSlackNotification({ workspace, title, body, metadata, frontendPath }) {
  if (!workspace?.slack?.webhookUrlEncrypted || workspace.slack.status !== 'connected') {
    return 'disabled';
  }

  const message = buildSlackMessage({ title, body, metadata, frontendPath });

  try {
    const result = await sendSlackWebhook(decryptSecret(workspace.slack.webhookUrlEncrypted), message);
    workspace.slack.lastDeliveryStatus = result;
    workspace.slack.lastDeliveryAt = new Date();
    await workspace.save();
    return result;
  } catch (error) {
    workspace.slack.status = 'error';
    workspace.slack.lastDeliveryStatus = error.message || 'failed';
    workspace.slack.lastDeliveryAt = new Date();
    await workspace.save();
    return 'failed';
  }
}

async function installSlackOnWorkspace({ workspace, installerId, oauthPayload }) {
  const webhook = oauthPayload.incoming_webhook;
  workspace.slack = {
    teamId: oauthPayload.team?.id || '',
    teamName: oauthPayload.team?.name || '',
    channelId: webhook.channel_id || '',
    channelName: webhook.channel || '',
    webhookUrlEncrypted: encryptSecret(webhook.url),
    installedBy: installerId,
    installedAt: new Date(),
    status: 'connected',
    lastDeliveryStatus: '',
    lastDeliveryAt: null,
  };
  await workspace.save();
  return buildSlackStatus(workspace);
}

module.exports = {
  buildSlackInstallUrl,
  buildSlackMessage,
  buildSlackStatus,
  ensureSlackConfigured,
  exchangeSlackCode,
  installSlackOnWorkspace,
  sendSlackWebhook,
  sendWorkspaceSlackNotification,
  validateSlackState,
  verifyState,
};
