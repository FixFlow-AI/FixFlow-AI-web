const { DynamoDBClient, ListTablesCommand } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const { env } = require('../config/env');

let client;
let docClient;

function buildClient() {
  const config = {
    region: env.AWS_REGION,
  };

  if (env.DYNAMODB_ENDPOINT) {
    config.endpoint = env.DYNAMODB_ENDPOINT;
  }

  if (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) {
    config.credentials = {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      sessionToken: env.AWS_SESSION_TOKEN || undefined,
    };
  }

  return new DynamoDBClient(config);
}

function getClient() {
  if (!client) {
    client = buildClient();
  }
  return client;
}

function getDocClient() {
  if (!docClient) {
    docClient = DynamoDBDocumentClient.from(getClient(), {
      marshallOptions: {
        removeUndefinedValues: true,
        convertClassInstanceToMap: true,
      },
      unmarshallOptions: {
        wrapNumbers: false,
      },
    });
  }
  return docClient;
}

async function connectDB() {
  try {
    await getClient().send(new ListTablesCommand({ Limit: 1 }));
    console.log('✅ DynamoDB client ready');
  } catch (error) {
    console.error('❌ DynamoDB connection error:', error.message);
    process.exit(1);
  }
}

module.exports = {
  connectDB,
  getClient,
  getDocClient,
};
