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

start();

module.exports = app;
