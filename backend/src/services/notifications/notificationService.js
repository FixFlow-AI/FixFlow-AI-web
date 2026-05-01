const Notification = require('../../models/Notification');
const User = require('../../models/User');
const { isSmtpConfigured, sendTransactionalMail } = require('../../utils/mailer');
const {
  mergeNotificationPreferences,
  hasNotificationChannel,
  hasNotificationEvent,
  normalizeNotificationPreferences,
} = require('./notificationPreferences');
const { sendWorkspaceSlackNotification } = require('../integrations/slackService');

function buildScope(workspaceId = null) {
  return workspaceId ? 'workspace' : 'personal';
}

function dedupeUserIds(userIds = []) {
  return [...new Set((Array.isArray(userIds) ? userIds : []).filter(Boolean).map((value) => value.toString()))];
}

async function sendNotificationEmail({ user, notification }) {
  if (!isSmtpConfigured()) {
    return 'skipped';
  }

  try {
    await sendTransactionalMail({
      to: user.email,
      subject: notification.title,
      text: `${notification.body}\n\nOpen FixFlowAI to review the latest update.`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #0f172a;">
          <h2 style="margin-bottom: 12px;">${notification.title}</h2>
          <p style="margin: 0 0 16px 0;">${notification.body}</p>
          <p style="color: #475569; margin: 0;">Open FixFlowAI to review the latest update.</p>
        </div>
      `,
    });
    return 'sent';
  } catch (_error) {
    return 'failed';
  }
}

async function createNotifications({
  userIds = [],
  workspace = null,
  proposalId = '',
  type,
  title,
  body,
  metadata = {},
  deliveryDefaults = null,
}) {
  const recipientIds = dedupeUserIds(userIds);
  if (!recipientIds.length) {
    return [];
  }

  const users = await User.find({ _id: { $in: recipientIds } });
  const created = [];
  const workspacePreferences = normalizeNotificationPreferences(workspace?.notificationDefaults || {});
  const deliveryPreferences = deliveryDefaults
    ? mergeNotificationPreferences(null, workspacePreferences, deliveryDefaults)
    : workspacePreferences;
  const shouldSendSlack =
    workspace &&
    hasNotificationEvent(deliveryPreferences, type) &&
    hasNotificationChannel(deliveryPreferences, 'slack');

  for (const user of users) {
    const effectivePreferences = mergeNotificationPreferences(
      user.notificationPreferences,
      workspace?.notificationDefaults,
      deliveryDefaults
    );

    if (!hasNotificationEvent(effectivePreferences, type)) {
      continue;
    }

    const shouldCreateInApp = hasNotificationChannel(effectivePreferences, 'in_app');
    const shouldSendEmail = hasNotificationChannel(effectivePreferences, 'email');

    const notification = shouldCreateInApp
      ? await Notification.create({
          userId: user._id,
          workspaceId: workspace?._id || null,
          proposalId,
          scope: buildScope(workspace?._id || null),
          type,
          title,
          body,
          metadata,
          emailStatus: shouldSendEmail ? 'disabled' : 'disabled',
        })
      : null;

    if (shouldSendEmail) {
      const emailStatus = await sendNotificationEmail({
        user,
        notification: { title, body },
      });

      if (notification) {
        notification.emailStatus = emailStatus;
        await notification.save();
      }
    }

    if (notification) {
      created.push(notification);
    }
  }

  if (shouldSendSlack) {
    await sendWorkspaceSlackNotification({
      workspace,
      title,
      body,
      metadata,
      frontendPath: proposalId ? `/proposal/${proposalId}` : '/workspace',
    }).catch(() => null);
  }

  return created;
}

function buildWorkspaceRecipientIds(workspace, excludeUserId = null, fallbackUserId = null) {
  const memberIds = (workspace?.members || []).map((member) => member.userId?.toString()).filter(Boolean);
  const filtered = memberIds.filter((memberId) => memberId !== excludeUserId?.toString());

  if (!filtered.length && fallbackUserId) {
    return [fallbackUserId.toString()];
  }

  return filtered;
}

function buildProposalRecipientIds({ proposal, workspace = null, excludeUserId = null }) {
  if (workspace) {
    return buildWorkspaceRecipientIds(workspace, excludeUserId, proposal.userId);
  }

  return proposal?.userId ? [proposal.userId.toString()] : [];
}

function serializeNotification(notification) {
  return {
    id: notification._id.toString(),
    type: notification.type,
    title: notification.title,
    body: notification.body,
    proposalId: notification.proposalId || '',
    workspaceId: notification.workspaceId ? notification.workspaceId.toString() : null,
    scope: notification.scope,
    metadata: notification.metadata || {},
    readAt: notification.readAt,
    createdAt: notification.createdAt,
    emailStatus: notification.emailStatus || 'disabled',
  };
}

async function listNotificationsForUser(userId, { scope = 'all', limit = 25 } = {}) {
  const query = { userId };
  if (scope === 'personal' || scope === 'workspace') {
    query.scope = scope;
  }

  const notifications = await Notification.find(query)
    .sort({ createdAt: -1 })
    .limit(Math.min(100, Math.max(1, Number(limit) || 25)));
  const unreadCount = await Notification.countDocuments({ userId, readAt: null, ...(query.scope ? { scope: query.scope } : {}) });

  return {
    notifications: notifications.map(serializeNotification),
    unreadCount,
  };
}

async function markNotificationRead({ userId, notificationId }) {
  const notification = await Notification.findOne({ _id: notificationId, userId });
  if (!notification) {
    return null;
  }

  notification.readAt = notification.readAt || new Date();
  await notification.save();
  return serializeNotification(notification);
}

async function markAllNotificationsRead({ userId }) {
  await Notification.updateMany({ userId, readAt: null }, { $set: { readAt: new Date() } });
}

module.exports = {
  createNotifications,
  buildWorkspaceRecipientIds,
  buildProposalRecipientIds,
  listNotificationsForUser,
  markNotificationRead,
  markAllNotificationsRead,
  serializeNotification,
  normalizeNotificationPreferences,
};
