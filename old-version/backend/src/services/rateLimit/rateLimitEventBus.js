const { EventEmitter } = require('node:events');

const RATE_LIMIT_EVENT = 'rate_limit_event';

class RateLimitEventBus extends EventEmitter {}

const rateLimitEventBus = new RateLimitEventBus();
rateLimitEventBus.setMaxListeners(0);

function publishRateLimitEvent(payload) {
  rateLimitEventBus.emit(RATE_LIMIT_EVENT, payload);
}

function onRateLimitEvent(handler) {
  rateLimitEventBus.on(RATE_LIMIT_EVENT, handler);
  return () => rateLimitEventBus.off(RATE_LIMIT_EVENT, handler);
}

module.exports = {
  RATE_LIMIT_EVENT,
  rateLimitEventBus,
  publishRateLimitEvent,
  onRateLimitEvent,
};

