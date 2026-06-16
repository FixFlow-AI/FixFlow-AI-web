const crypto = require('node:crypto');

const clientsByUserId = new Map();

function createClientId() {
  return crypto.randomBytes(8).toString('hex');
}

function registerNotificationStream({ userId, res }) {
  const normalizedUserId = String(userId);
  const clientId = createClientId();

  if (!clientsByUserId.has(normalizedUserId)) {
    clientsByUserId.set(normalizedUserId, new Map());
  }

  const userClients = clientsByUserId.get(normalizedUserId);
  userClients.set(clientId, res);

  res.on('close', () => {
    const map = clientsByUserId.get(normalizedUserId);
    map?.delete(clientId);
    if (map && map.size === 0) {
      clientsByUserId.delete(normalizedUserId);
    }
  });

  return { clientId };
}

function writeSse(res, { event, data }) {
  if (event) {
    res.write(`event: ${event}\n`);
  }
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function pushToUser(userId, payload) {
  const normalizedUserId = String(userId);
  const userClients = clientsByUserId.get(normalizedUserId);
  if (!userClients || userClients.size === 0) {
    return { delivered: 0 };
  }

  let delivered = 0;
  for (const res of userClients.values()) {
    try {
      writeSse(res, { event: 'notification', data: payload });
      delivered += 1;
    } catch {
      // best effort; connection cleanup happens on close
    }
  }

  return { delivered };
}

function pushToMany(userIds = [], payload) {
  let delivered = 0;
  for (const userId of userIds) {
    delivered += pushToUser(userId, payload).delivered;
  }
  return { delivered };
}

module.exports = {
  registerNotificationStream,
  pushToUser,
  pushToMany,
  writeSse,
};

