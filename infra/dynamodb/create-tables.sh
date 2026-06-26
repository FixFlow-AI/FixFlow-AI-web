#!/usr/bin/env bash
#
# Creates all FixFlowAI DynamoDB tables (idempotent, on-demand billing).
# Uses your configured AWS CLI credentials (run `aws configure` first).
# Safe to re-run: existing tables are skipped.
#
# Usage:
#   ./create-tables.sh
#   AWS_REGION=ap-south-1 DDB_TABLE_PREFIX=fixflow_prod ./create-tables.sh
#   DDB_ENDPOINT=http://localhost:8000 ./create-tables.sh   # DynamoDB Local
#
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
PREFIX="${DDB_TABLE_PREFIX:-fixflow}"
ENDPOINT_ARG=()
if [[ -n "${DDB_ENDPOINT:-}" ]]; then
  ENDPOINT_ARG=(--endpoint-url "${DDB_ENDPOINT}")
fi

command -v aws >/dev/null 2>&1 || { echo "AWS CLI not found. Install it and run 'aws configure'."; exit 1; }

echo "Region : ${REGION}"
echo "Prefix : ${PREFIX}"
[[ -n "${DDB_ENDPOINT:-}" ]] && echo "Endpoint: ${DDB_ENDPOINT} (local)"
echo

create() {
  local suffix="$1"; shift
  local json="$1"; shift
  local table="${PREFIX}_${suffix}"

  if aws dynamodb describe-table --table-name "${table}" --region "${REGION}" "${ENDPOINT_ARG[@]}" >/dev/null 2>&1; then
    echo "[skip]   ${table} already exists"
    return
  fi

  echo "[create] ${table} ..."
  aws dynamodb create-table \
    --cli-input-json "${json}" \
    --table-name "${table}" \
    --region "${REGION}" \
    "${ENDPOINT_ARG[@]}" >/dev/null

  aws dynamodb wait table-exists --table-name "${table}" --region "${REGION}" "${ENDPOINT_ARG[@]}"
  echo "[ready]  ${table}"
}

create users '{
  "AttributeDefinitions":[
    {"AttributeName":"userId","AttributeType":"S"},
    {"AttributeName":"googleSub","AttributeType":"S"}],
  "KeySchema":[{"AttributeName":"userId","KeyType":"HASH"}],
  "GlobalSecondaryIndexes":[{"IndexName":"GoogleSubIndex",
    "KeySchema":[{"AttributeName":"googleSub","KeyType":"HASH"}],
    "Projection":{"ProjectionType":"ALL"}}],
  "BillingMode":"PAY_PER_REQUEST"}'

create freelancers '{
  "AttributeDefinitions":[{"AttributeName":"freelancerId","AttributeType":"S"}],
  "KeySchema":[{"AttributeName":"freelancerId","KeyType":"HASH"}],
  "BillingMode":"PAY_PER_REQUEST"}'

create proposals '{
  "AttributeDefinitions":[
    {"AttributeName":"proposalId","AttributeType":"S"},
    {"AttributeName":"userId","AttributeType":"S"},
    {"AttributeName":"createdAt","AttributeType":"S"}],
  "KeySchema":[{"AttributeName":"proposalId","KeyType":"HASH"}],
  "GlobalSecondaryIndexes":[{"IndexName":"UserProposalsIndex",
    "KeySchema":[
      {"AttributeName":"userId","KeyType":"HASH"},
      {"AttributeName":"createdAt","KeyType":"RANGE"}],
    "Projection":{"ProjectionType":"ALL"}}],
  "BillingMode":"PAY_PER_REQUEST"}'

create milestones '{
  "AttributeDefinitions":[
    {"AttributeName":"milestoneId","AttributeType":"S"},
    {"AttributeName":"proposalId","AttributeType":"S"}],
  "KeySchema":[{"AttributeName":"milestoneId","KeyType":"HASH"}],
  "GlobalSecondaryIndexes":[{"IndexName":"ProposalMilestonesIndex",
    "KeySchema":[{"AttributeName":"proposalId","KeyType":"HASH"}],
    "Projection":{"ProjectionType":"ALL"}}],
  "BillingMode":"PAY_PER_REQUEST"}'

create audit_blocks '{
  "AttributeDefinitions":[
    {"AttributeName":"milestoneId","AttributeType":"S"},
    {"AttributeName":"blockIndex","AttributeType":"N"}],
  "KeySchema":[
    {"AttributeName":"milestoneId","KeyType":"HASH"},
    {"AttributeName":"blockIndex","KeyType":"RANGE"}],
  "BillingMode":"PAY_PER_REQUEST"}'

create opportunities '{
  "AttributeDefinitions":[
    {"AttributeName":"opportunityId","AttributeType":"S"},
    {"AttributeName":"urlHash","AttributeType":"S"}],
  "KeySchema":[{"AttributeName":"opportunityId","KeyType":"HASH"}],
  "GlobalSecondaryIndexes":[{"IndexName":"UrlHashIndex",
    "KeySchema":[{"AttributeName":"urlHash","KeyType":"HASH"}],
    "Projection":{"ProjectionType":"ALL"}}],
  "BillingMode":"PAY_PER_REQUEST"}'

create raw_posts '{
  "AttributeDefinitions":[{"AttributeName":"urlHash","AttributeType":"S"}],
  "KeySchema":[{"AttributeName":"urlHash","KeyType":"HASH"}],
  "BillingMode":"PAY_PER_REQUEST"}'

echo
echo "Done. Set these in backend/.env:"
echo "  AWS_REGION=${REGION}"
echo "  DDB_TABLE_PREFIX=${PREFIX}"
