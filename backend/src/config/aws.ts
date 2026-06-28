import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

/**
 * Centralized AWS configuration + a single DynamoDB document client.
 *
 * The client is created once at module load (module scope) so warm Lambda
 * invocations reuse the same connection pool — this is the performance pattern
 * from the serverless migration plan (§3.5). Never create a client per request.
 */

export const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';
export const DDB_TABLE_PREFIX = process.env.DDB_TABLE_PREFIX || 'fixflow';
const DDB_ENDPOINT = process.env.DDB_ENDPOINT || undefined; // for DynamoDB Local

/** Build a fully-qualified table name from its suffix, e.g. table('users'). */
export function table(suffix: string): string {
  return `${DDB_TABLE_PREFIX}_${suffix}`;
}

const baseClient = new DynamoDBClient({
  region: AWS_REGION,
  ...(DDB_ENDPOINT ? { endpoint: DDB_ENDPOINT } : {}),
});

export const ddb = DynamoDBDocumentClient.from(baseClient, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: false,
  },
});

/** True when the app is configured to use DynamoDB-backed repositories. */
export function isDynamoConfigured(): boolean {
  return (process.env.PERSISTENCE_PROVIDER || '').toLowerCase() === 'dynamodb';
}
