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
    {"AttributeName":"googleSub","AttributeType":"S"},
    {"AttributeName":"githubUserId","AttributeType":"S"}],
  "KeySchema":[{"AttributeName":"userId","KeyType":"HASH"}],
  "GlobalSecondaryIndexes":[
    {"IndexName":"GoogleSubIndex",
      "KeySchema":[{"AttributeName":"googleSub","KeyType":"HASH"}],
      "Projection":{"ProjectionType":"ALL"}},
    {"IndexName":"GithubUserIndex",
      "KeySchema":[{"AttributeName":"githubUserId","KeyType":"HASH"}],
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

# ── Role-based platform (docs/specifications/roles) ──────────────────────────

create github_scan_jobs '{
  "AttributeDefinitions":[
    {"AttributeName":"jobId","AttributeType":"S"},
    {"AttributeName":"freelancerId","AttributeType":"S"},
    {"AttributeName":"createdAt","AttributeType":"S"}],
  "KeySchema":[{"AttributeName":"jobId","KeyType":"HASH"}],
  "GlobalSecondaryIndexes":[{"IndexName":"FreelancerScansIndex",
    "KeySchema":[
      {"AttributeName":"freelancerId","KeyType":"HASH"},
      {"AttributeName":"createdAt","KeyType":"RANGE"}],
    "Projection":{"ProjectionType":"ALL"}}],
  "BillingMode":"PAY_PER_REQUEST"}'

create freelancer_skills '{
  "AttributeDefinitions":[
    {"AttributeName":"freelancerId","AttributeType":"S"},
    {"AttributeName":"skillName","AttributeType":"S"}],
  "KeySchema":[
    {"AttributeName":"freelancerId","KeyType":"HASH"},
    {"AttributeName":"skillName","KeyType":"RANGE"}],
  "BillingMode":"PAY_PER_REQUEST"}'

create freelancer_projects '{
  "AttributeDefinitions":[
    {"AttributeName":"freelancerId","AttributeType":"S"},
    {"AttributeName":"projectId","AttributeType":"S"}],
  "KeySchema":[
    {"AttributeName":"freelancerId","KeyType":"HASH"},
    {"AttributeName":"projectId","KeyType":"RANGE"}],
  "BillingMode":"PAY_PER_REQUEST"}'

create profile_confidence '{
  "AttributeDefinitions":[{"AttributeName":"freelancerId","AttributeType":"S"}],
  "KeySchema":[{"AttributeName":"freelancerId","KeyType":"HASH"}],
  "BillingMode":"PAY_PER_REQUEST"}'

create growth_plans '{
  "AttributeDefinitions":[
    {"AttributeName":"planId","AttributeType":"S"},
    {"AttributeName":"freelancerId","AttributeType":"S"}],
  "KeySchema":[{"AttributeName":"planId","KeyType":"HASH"}],
  "GlobalSecondaryIndexes":[{"IndexName":"FreelancerPlansIndex",
    "KeySchema":[{"AttributeName":"freelancerId","KeyType":"HASH"}],
    "Projection":{"ProjectionType":"ALL"}}],
  "BillingMode":"PAY_PER_REQUEST"}'

create dev_projects '{
  "AttributeDefinitions":[
    {"AttributeName":"projectId","AttributeType":"S"},
    {"AttributeName":"ownerId","AttributeType":"S"},
    {"AttributeName":"createdAt","AttributeType":"S"}],
  "KeySchema":[{"AttributeName":"projectId","KeyType":"HASH"}],
  "GlobalSecondaryIndexes":[{"IndexName":"OwnerProjectsIndex",
    "KeySchema":[
      {"AttributeName":"ownerId","KeyType":"HASH"},
      {"AttributeName":"createdAt","KeyType":"RANGE"}],
    "Projection":{"ProjectionType":"ALL"}}],
  "BillingMode":"PAY_PER_REQUEST"}'

create dev_tasks '{
  "AttributeDefinitions":[
    {"AttributeName":"projectId","AttributeType":"S"},
    {"AttributeName":"taskId","AttributeType":"S"}],
  "KeySchema":[
    {"AttributeName":"projectId","KeyType":"HASH"},
    {"AttributeName":"taskId","KeyType":"RANGE"}],
  "BillingMode":"PAY_PER_REQUEST"}'

create dev_project_members '{
  "AttributeDefinitions":[
    {"AttributeName":"projectId","AttributeType":"S"},
    {"AttributeName":"userId","AttributeType":"S"}],
  "KeySchema":[
    {"AttributeName":"projectId","KeyType":"HASH"},
    {"AttributeName":"userId","KeyType":"RANGE"}],
  "BillingMode":"PAY_PER_REQUEST"}'

# ── Proctored interview gate (freelancer application screening) ──────────────

create interview_question_sets '{
  "AttributeDefinitions":[{"AttributeName":"jobId","AttributeType":"S"}],
  "KeySchema":[{"AttributeName":"jobId","KeyType":"HASH"}],
  "BillingMode":"PAY_PER_REQUEST"}'

create job_applications '{
  "AttributeDefinitions":[
    {"AttributeName":"jobId","AttributeType":"S"},
    {"AttributeName":"freelancerId","AttributeType":"S"},
    {"AttributeName":"createdAt","AttributeType":"S"}],
  "KeySchema":[
    {"AttributeName":"jobId","KeyType":"HASH"},
    {"AttributeName":"freelancerId","KeyType":"RANGE"}],
  "GlobalSecondaryIndexes":[{"IndexName":"FreelancerApplicationsIndex",
    "KeySchema":[
      {"AttributeName":"freelancerId","KeyType":"HASH"},
      {"AttributeName":"createdAt","KeyType":"RANGE"}],
    "Projection":{"ProjectionType":"ALL"}}],
  "BillingMode":"PAY_PER_REQUEST"}'

create interview_sessions '{
  "AttributeDefinitions":[
    {"AttributeName":"sessionId","AttributeType":"S"},
    {"AttributeName":"applicationId","AttributeType":"S"},
    {"AttributeName":"startedAt","AttributeType":"S"}],
  "KeySchema":[{"AttributeName":"sessionId","KeyType":"HASH"}],
  "GlobalSecondaryIndexes":[{"IndexName":"ApplicationSessionsIndex",
    "KeySchema":[
      {"AttributeName":"applicationId","KeyType":"HASH"},
      {"AttributeName":"startedAt","KeyType":"RANGE"}],
    "Projection":{"ProjectionType":"ALL"}}],
  "BillingMode":"PAY_PER_REQUEST"}'

create interview_events '{
  "AttributeDefinitions":[
    {"AttributeName":"sessionId","AttributeType":"S"},
    {"AttributeName":"eventSeq","AttributeType":"N"}],
  "KeySchema":[
    {"AttributeName":"sessionId","KeyType":"HASH"},
    {"AttributeName":"eventSeq","KeyType":"RANGE"}],
  "BillingMode":"PAY_PER_REQUEST"}'

echo
echo "Done. Set these in backend/.env:"
echo "  AWS_REGION=${REGION}"
echo "  DDB_TABLE_PREFIX=${PREFIX}"
