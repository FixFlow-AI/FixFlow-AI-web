const { onRateLimitEvent } = require('./rateLimitEventBus');
const { getRateLimitConfig } = require('./rateLimitThresholds');
const { sendTransactionalMail, isSmtpConfigured } = require('../../utils/mailer');
const { createNotifications } = require('../notifications/notificationService');
const { pushToUser } = require('../notifications/notificationStream');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapEventTypeToNotificationType(eventType) {
  if (eventType === 'near_limit') {
    return 'rate_limit_near';
  }
  if (eventType === 'limit_exceeded') {
    return 'rate_limit_exceeded';
  }
  if (eventType === 'limit_restored') {
    return 'rate_limit_restored';
  }
  return 'rate_limit_exceeded';
}

function buildUserMessage(event) {
  if (event.eventType === 'limit_exceeded') {
    return {
      title: 'Quota reached. Upgrade to continue.',
      body: 'We hit a provider quota limit. Please upgrade or try again later.',
    };
  }
  if (event.eventType === 'near_limit') {
    return {
      title: 'Quota running low',
      body: 'Usage is close to the provider limit. You may experience interruptions soon.',
    };
  }
  return {
    title: 'Service restored. You can continue.',
    body: 'Quota limits have recovered and the service is available again.',
  };
}

function buildAdminMessage(event) {
  const header = `[FixFlowAI] ${event.provider} ${event.eventType}`;
  const lines = [
    `Provider: ${event.provider}`,
    `Event: ${event.eventType}`,
    `User: ${event.userId}`,
    `KeyFingerprint: ${event.apiKeyFingerprint}`,
    event.statusCode ? `Status: ${event.statusCode}` : null,
    event.retryAfterSec ? `RetryAfterSec: ${event.retryAfterSec}` : null,
    event.model ? `Model: ${event.model}` : null,
    event.requestId ? `RequestId: ${event.requestId}` : null,
    event.message ? `Message: ${event.message}` : null,
  ].filter(Boolean);

  return {
    subject: header,
    text: lines.join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; color: #0f172a;">
        <h2 style="margin-bottom: 12px;">${header}</h2>
        <pre style="white-space: pre-wrap; background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 12px;">${lines.join(
          '\n'
        )}</pre>
      </div>
    `,
  };
}

async function sendAdminEmailWithRetry(event) {
  const cfg = getRateLimitConfig();
  if (!cfg.adminRecipients.length || !isSmtpConfigured()) {
    return { ok: false, skipped: true };
  }

  const { subject, text, html } = buildAdminMessage(event);

  let attempt = 0;
  while (attempt <= cfg.adminRetryMaxAttempts) {
    try {
      await sendTransactionalMail({
        to: cfg.adminRecipients.join(','),
        subject,
        text,
        html,
      });
      return { ok: true, attempt };
    } catch (error) {
      attempt += 1;
      if (attempt > cfg.adminRetryMaxAttempts) {
        console.error(
          JSON.stringify({
            event: 'RATE_LIMIT_NOTIFY_FAILURE',
            channel: 'admin_email',
            provider: event.provider,
            eventType: event.eventType,
            userId: event.userId,
            apiKeyFingerprint: event.apiKeyFingerprint,
            attempt,
            error: String(error?.message || error),
          })
        );
        return { ok: false, attempt };
      }

      const delay = cfg.adminRetryBaseDelayMs * Math.pow(2, Math.min(6, attempt - 1));
      await sleep(delay);
    }
  }

  return { ok: false, attempt };
}

async function notifyUser(event) {
  const userId = event.userId;
  if (!userId || userId === 'system') {
    return { ok: false, skipped: true };
  }

  const notificationType = mapEventTypeToNotificationType(event.eventType);
  const { title, body } = buildUserMessage(event);

  const created = await createNotifications({
    userIds: [userId],
    workspace: null,
    proposalId: '',
    type: notificationType,
    title,
    body,
    metadata: {
      provider: event.provider,
      apiKeyFingerprint: event.apiKeyFingerprint,
      retryAfterSec: event.retryAfterSec || null,
      statusCode: event.statusCode || null,
      occurredAt: event.occurredAt,
      ...((event.metadata && typeof event.metadata === 'object') ? event.metadata : {}),
    },
    deliveryDefaults: { enabled: true, channels: ['in_app'], events: [notificationType] },
  });

  pushToUser(userId, {
    kind: 'rate_limit',
    notificationType,
    title,
    body,
    metadata: {
      provider: event.provider,
      retryAfterSec: event.retryAfterSec || null,
      occurredAt: event.occurredAt,
    },
  });

  return { ok: true, createdCount: created?.length || 0 };
}

function initRateLimitNotifier() {
  return onRateLimitEvent(async (event) => {
    try {
      console.log(
        JSON.stringify({
          event: 'RATE_LIMIT_EVENT',
          provider: event.provider,
          eventType: event.eventType,
          userId: event.userId,
          apiKeyFingerprint: event.apiKeyFingerprint,
          statusCode: event.statusCode || null,
          retryAfterSec: event.retryAfterSec || null,
        })
      );

      await Promise.all([
        sendAdminEmailWithRetry(event),
        notifyUser(event),
      ]);
    } catch (error) {
      console.error(
        JSON.stringify({
          event: 'RATE_LIMIT_NOTIFY_FAILURE',
          channel: 'handler',
          provider: event?.provider,
          eventType: event?.eventType,
          userId: event?.userId,
          error: String(error?.message || error),
        })
      );
    }
  });
}

module.exports = {
  initRateLimitNotifier,
};

