const { env } = require('./config/env');
const { connectDB } = require('./db/dynamodb');
const { createApp } = require('./app');

const app = createApp();

async function start() {
  await connectDB();
  app.listen(env.PORT, () => {
    console.log(`🚀 Server running on port ${env.PORT} [${env.NODE_ENV}]`);
  });
}

start().catch((error) => {
  console.error(JSON.stringify({
    level: 'ERROR',
    timestamp: new Date().toISOString(),
    event: 'SERVER_STARTUP_FAILED',
    message: 'Failed to initialize database connection or start Express server listener.',
    error: error.message,
    stack: error.stack,
  }, null, 2));
  process.exit(1);
});

module.exports = app;
