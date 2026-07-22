<#
.SYNOPSIS
  Creates all FixFlowAI DynamoDB tables (idempotent, on-demand billing).

.DESCRIPTION
  Reads no secrets. Uses your already-configured AWS CLI credentials
  (run `aws configure` first). Safe to re-run: existing tables are skipped.

.PARAMETER Region
  AWS region. Defaults to $env:AWS_REGION, then us-east-1.

.PARAMETER Prefix
  Table name prefix. Defaults to $env:DDB_TABLE_PREFIX, then "fixflow".
  Final names look like "<prefix>_users".

.PARAMETER Endpoint
  Optional DynamoDB endpoint URL. Set to http://localhost:8000 to target
  DynamoDB Local instead of real AWS.

.EXAMPLE
  ./create-tables.ps1
  ./create-tables.ps1 -Region ap-south-1 -Prefix fixflow_prod
  ./create-tables.ps1 -Endpoint http://localhost:8000   # DynamoDB Local
#>
param(
  [string]$Region = $(if ($env:AWS_REGION) { $env:AWS_REGION } else { $cfgRegion = (aws configure get region 2>$null); if ($cfgRegion) { $cfgRegion } else { "ap-south-1" } }),
  [string]$Prefix = $(if ($env:DDB_TABLE_PREFIX) { $env:DDB_TABLE_PREFIX } else { "fixflow" }),
  [string]$Endpoint = ""
)

$ErrorActionPreference = "Stop"

# --- sanity check: is the AWS CLI installed? ---
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
  Write-Error "AWS CLI not found. Install it: https://aws.amazon.com/cli/  then run 'aws configure'."
  exit 1
}

$endpointArg = @()
if ($Endpoint -ne "") { $endpointArg = @("--endpoint-url", $Endpoint) }

# Each entry: suffix + the create-table JSON (TableName is overridden at call time).
$tables = @{
  # 1) Users — login identities. Query by id (PK), by Google subject (GSI),
  #    and by GitHub user id (GSI) for GitHub-only freelancer login.
  "users" = @'
{
  "AttributeDefinitions": [
    { "AttributeName": "userId", "AttributeType": "S" },
    { "AttributeName": "googleSub", "AttributeType": "S" },
    { "AttributeName": "githubUserId", "AttributeType": "S" }
  ],
  "KeySchema": [ { "AttributeName": "userId", "KeyType": "HASH" } ],
  "GlobalSecondaryIndexes": [
    {
      "IndexName": "GoogleSubIndex",
      "KeySchema": [ { "AttributeName": "googleSub", "KeyType": "HASH" } ],
      "Projection": { "ProjectionType": "ALL" }
    },
    {
      "IndexName": "GithubUserIndex",
      "KeySchema": [ { "AttributeName": "githubUserId", "KeyType": "HASH" } ],
      "Projection": { "ProjectionType": "ALL" }
    }
  ],
  "BillingMode": "PAY_PER_REQUEST"
}
'@

  # 2) Freelancers — match roster. Query by id; full scans for matching are fine at MVP scale.
  "freelancers" = @'
{
  "AttributeDefinitions": [
    { "AttributeName": "freelancerId", "AttributeType": "S" }
  ],
  "KeySchema": [ { "AttributeName": "freelancerId", "KeyType": "HASH" } ],
  "BillingMode": "PAY_PER_REQUEST"
}
'@

  # 3) Proposals — parsed briefs. Query by id; list a user's proposals via GSI.
  "proposals" = @'
{
  "AttributeDefinitions": [
    { "AttributeName": "proposalId", "AttributeType": "S" },
    { "AttributeName": "userId", "AttributeType": "S" },
    { "AttributeName": "createdAt", "AttributeType": "S" }
  ],
  "KeySchema": [ { "AttributeName": "proposalId", "KeyType": "HASH" } ],
  "GlobalSecondaryIndexes": [
    {
      "IndexName": "UserProposalsIndex",
      "KeySchema": [
        { "AttributeName": "userId", "KeyType": "HASH" },
        { "AttributeName": "createdAt", "KeyType": "RANGE" }
      ],
      "Projection": { "ProjectionType": "ALL" }
    }
  ],
  "BillingMode": "PAY_PER_REQUEST"
}
'@

  # 4) Milestones — escrow FSM rows. Query by id; list a proposal's milestones via GSI.
  "milestones" = @'
{
  "AttributeDefinitions": [
    { "AttributeName": "milestoneId", "AttributeType": "S" },
    { "AttributeName": "proposalId", "AttributeType": "S" }
  ],
  "KeySchema": [ { "AttributeName": "milestoneId", "KeyType": "HASH" } ],
  "GlobalSecondaryIndexes": [
    {
      "IndexName": "ProposalMilestonesIndex",
      "KeySchema": [ { "AttributeName": "proposalId", "KeyType": "HASH" } ],
      "Projection": { "ProjectionType": "ALL" }
    }
  ],
  "BillingMode": "PAY_PER_REQUEST"
}
'@

  # 5) Audit blocks — the cryptographic chain. Composite key (milestone + block index)
  #    returns the chain in order with a single Query.
  "audit_blocks" = @'
{
  "AttributeDefinitions": [
    { "AttributeName": "milestoneId", "AttributeType": "S" },
    { "AttributeName": "blockIndex", "AttributeType": "N" }
  ],
  "KeySchema": [
    { "AttributeName": "milestoneId", "KeyType": "HASH" },
    { "AttributeName": "blockIndex", "KeyType": "RANGE" }
  ],
  "BillingMode": "PAY_PER_REQUEST"
}
'@

  # 6) Opportunities — AI-005 scored leads. Query by id; dedupe lookups via urlHash GSI.
  "opportunities" = @'
{
  "AttributeDefinitions": [
    { "AttributeName": "opportunityId", "AttributeType": "S" },
    { "AttributeName": "urlHash", "AttributeType": "S" }
  ],
  "KeySchema": [ { "AttributeName": "opportunityId", "KeyType": "HASH" } ],
  "GlobalSecondaryIndexes": [
    {
      "IndexName": "UrlHashIndex",
      "KeySchema": [ { "AttributeName": "urlHash", "KeyType": "HASH" } ],
      "Projection": { "ProjectionType": "ALL" }
    }
  ],
  "BillingMode": "PAY_PER_REQUEST"
}
'@

  # 7) Raw posts — AI-005 ingestion cache, keyed by URL hash for fast dedupe.
  "raw_posts" = @'
{
  "AttributeDefinitions": [
    { "AttributeName": "urlHash", "AttributeType": "S" }
  ],
  "KeySchema": [ { "AttributeName": "urlHash", "KeyType": "HASH" } ],
  "BillingMode": "PAY_PER_REQUEST"
}
'@

  # ────────────────────────────────────────────────────────────────────────
  # ROLE-BASED PLATFORM (docs/specifications/roles) — freelancer + developer
  # ────────────────────────────────────────────────────────────────────────

  # 8) GitHub scan jobs — tracks a freelancer's deep-scan run + per-segment state.
  #    Query by jobId (PK); list a freelancer's scans via GSI.
  "github_scan_jobs" = @'
{
  "AttributeDefinitions": [
    { "AttributeName": "jobId", "AttributeType": "S" },
    { "AttributeName": "freelancerId", "AttributeType": "S" },
    { "AttributeName": "createdAt", "AttributeType": "S" }
  ],
  "KeySchema": [ { "AttributeName": "jobId", "KeyType": "HASH" } ],
  "GlobalSecondaryIndexes": [
    {
      "IndexName": "FreelancerScansIndex",
      "KeySchema": [
        { "AttributeName": "freelancerId", "KeyType": "HASH" },
        { "AttributeName": "createdAt", "KeyType": "RANGE" }
      ],
      "Projection": { "ProjectionType": "ALL" }
    }
  ],
  "BillingMode": "PAY_PER_REQUEST"
}
'@

  # 9) Freelancer skills — AI-verified, read-only. Composite key returns all a
  #    freelancer's skills in one Query. `editable` is always false.
  "freelancer_skills" = @'
{
  "AttributeDefinitions": [
    { "AttributeName": "freelancerId", "AttributeType": "S" },
    { "AttributeName": "skillName", "AttributeType": "S" }
  ],
  "KeySchema": [
    { "AttributeName": "freelancerId", "KeyType": "HASH" },
    { "AttributeName": "skillName", "KeyType": "RANGE" }
  ],
  "BillingMode": "PAY_PER_REQUEST"
}
'@

  # 10) Freelancer projects — verified top repos / work experience.
  "freelancer_projects" = @'
{
  "AttributeDefinitions": [
    { "AttributeName": "freelancerId", "AttributeType": "S" },
    { "AttributeName": "projectId", "AttributeType": "S" }
  ],
  "KeySchema": [
    { "AttributeName": "freelancerId", "KeyType": "HASH" },
    { "AttributeName": "projectId", "KeyType": "RANGE" }
  ],
  "BillingMode": "PAY_PER_REQUEST"
}
'@

  # 11) Profile confidence — latest score + band per freelancer.
  "profile_confidence" = @'
{
  "AttributeDefinitions": [
    { "AttributeName": "freelancerId", "AttributeType": "S" }
  ],
  "KeySchema": [ { "AttributeName": "freelancerId", "KeyType": "HASH" } ],
  "BillingMode": "PAY_PER_REQUEST"
}
'@

  # 12) Growth plans — AI improvement plan (items embedded as a JSON list).
  # 12b) Profile snapshots — bio, readme, repos context for AI scanning
  "profile_snapshots" = @'
{
  "AttributeDefinitions": [
    { "AttributeName": "freelancerId", "AttributeType": "S" }
  ],
  "KeySchema": [ { "AttributeName": "freelancerId", "KeyType": "HASH" } ],
  "BillingMode": "PAY_PER_REQUEST"
}
'@
  "growth_plans" = @'
{
  "AttributeDefinitions": [
    { "AttributeName": "planId", "AttributeType": "S" },
    { "AttributeName": "freelancerId", "AttributeType": "S" }
  ],
  "KeySchema": [ { "AttributeName": "planId", "KeyType": "HASH" } ],
  "GlobalSecondaryIndexes": [
    {
      "IndexName": "FreelancerPlansIndex",
      "KeySchema": [ { "AttributeName": "freelancerId", "KeyType": "HASH" } ],
      "Projection": { "ProjectionType": "ALL" }
    }
  ],
  "BillingMode": "PAY_PER_REQUEST"
}
'@

  # 13) Developer projects — a developer's own projects. Query by projectId;
  #     list an owner's projects via GSI.
  "dev_projects" = @'
{
  "AttributeDefinitions": [
    { "AttributeName": "projectId", "AttributeType": "S" },
    { "AttributeName": "ownerId", "AttributeType": "S" },
    { "AttributeName": "createdAt", "AttributeType": "S" }
  ],
  "KeySchema": [ { "AttributeName": "projectId", "KeyType": "HASH" } ],
  "GlobalSecondaryIndexes": [
    {
      "IndexName": "OwnerProjectsIndex",
      "KeySchema": [
        { "AttributeName": "ownerId", "KeyType": "HASH" },
        { "AttributeName": "createdAt", "KeyType": "RANGE" }
      ],
      "Projection": { "ProjectionType": "ALL" }
    }
  ],
  "BillingMode": "PAY_PER_REQUEST"
}
'@

  # 14) Developer tasks — task board per project. Composite key returns a
  #     project's tasks in one Query.
  "dev_tasks" = @'
{
  "AttributeDefinitions": [
    { "AttributeName": "projectId", "AttributeType": "S" },
    { "AttributeName": "taskId", "AttributeType": "S" }
  ],
  "KeySchema": [
    { "AttributeName": "projectId", "KeyType": "HASH" },
    { "AttributeName": "taskId", "KeyType": "RANGE" }
  ],
  "BillingMode": "PAY_PER_REQUEST"
}
'@

  # 15) Developer project members — team membership per project.
  "dev_project_members" = @'
{
  "AttributeDefinitions": [
    { "AttributeName": "projectId", "AttributeType": "S" },
    { "AttributeName": "userId", "AttributeType": "S" }
  ],
  "KeySchema": [
    { "AttributeName": "projectId", "KeyType": "HASH" },
    { "AttributeName": "userId", "KeyType": "RANGE" }
  ],
  "BillingMode": "PAY_PER_REQUEST"
}
'@

  # 16) Interview question sets — client-authored screening questions per job.
  "interview_question_sets" = @'
{
  "AttributeDefinitions": [ { "AttributeName": "jobId", "AttributeType": "S" } ],
  "KeySchema": [ { "AttributeName": "jobId", "KeyType": "HASH" } ],
  "BillingMode": "PAY_PER_REQUEST"
}
'@

  # 17) Job applications — freelancer application lifecycle + ban flag.
  "job_applications" = @'
{
  "AttributeDefinitions": [
    { "AttributeName": "jobId", "AttributeType": "S" },
    { "AttributeName": "freelancerId", "AttributeType": "S" },
    { "AttributeName": "createdAt", "AttributeType": "S" }
  ],
  "KeySchema": [
    { "AttributeName": "jobId", "KeyType": "HASH" },
    { "AttributeName": "freelancerId", "KeyType": "RANGE" }
  ],
  "GlobalSecondaryIndexes": [
    {
      "IndexName": "FreelancerApplicationsIndex",
      "KeySchema": [
        { "AttributeName": "freelancerId", "KeyType": "HASH" },
        { "AttributeName": "createdAt", "KeyType": "RANGE" }
      ],
      "Projection": { "ProjectionType": "ALL" }
    }
  ],
  "BillingMode": "PAY_PER_REQUEST"
}
'@

  # 18) Interview sessions — proctored session state, answers, scores, media keys.
  "interview_sessions" = @'
{
  "AttributeDefinitions": [
    { "AttributeName": "sessionId", "AttributeType": "S" },
    { "AttributeName": "applicationId", "AttributeType": "S" },
    { "AttributeName": "startedAt", "AttributeType": "S" }
  ],
  "KeySchema": [ { "AttributeName": "sessionId", "KeyType": "HASH" } ],
  "GlobalSecondaryIndexes": [
    {
      "IndexName": "ApplicationSessionsIndex",
      "KeySchema": [
        { "AttributeName": "applicationId", "KeyType": "HASH" },
        { "AttributeName": "startedAt", "KeyType": "RANGE" }
      ],
      "Projection": { "ProjectionType": "ALL" }
    }
  ],
  "BillingMode": "PAY_PER_REQUEST"
}
'@

  # 19) Interview events — append-only proctoring log per session.
  "interview_events" = @'
{
  "AttributeDefinitions": [
    { "AttributeName": "sessionId", "AttributeType": "S" },
    { "AttributeName": "eventSeq", "AttributeType": "N" }
  ],
  "KeySchema": [
    { "AttributeName": "sessionId", "KeyType": "HASH" },
    { "AttributeName": "eventSeq", "KeyType": "RANGE" }
  ],
  "BillingMode": "PAY_PER_REQUEST"
}
'@
}

# Deterministic order so dependent reads are predictable in logs.
$order = @(
  "users", "freelancers", "proposals", "milestones", "audit_blocks",
  "opportunities", "raw_posts",
  "github_scan_jobs", "freelancer_skills", "freelancer_projects",
  "profile_confidence", "profile_snapshots", "growth_plans",
  "dev_projects", "dev_tasks", "dev_project_members",
  "interview_question_sets", "job_applications", "interview_sessions", "interview_events"
)

Write-Host "Region : $Region"
Write-Host "Prefix : $Prefix"
if ($Endpoint -ne "") { Write-Host "Endpoint: $Endpoint (local)" }
Write-Host ""

$tmpDir = Join-Path $env:TEMP "fixflow-ddb"
New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null

foreach ($suffix in $order) {
  $tableName = "${Prefix}_${suffix}"

  # Skip if it already exists (idempotent re-runs).
  $exists = $false
  $oldEAP = $ErrorActionPreference
  $ErrorActionPreference = "SilentlyContinue"
  aws dynamodb describe-table --table-name $tableName --region $Region @endpointArg *> $null
  if ($LASTEXITCODE -eq 0) { $exists = $true }
  $ErrorActionPreference = $oldEAP

  if ($exists) {
    Write-Host "[skip]   $tableName already exists"
    continue
  }

  $tmpFile = Join-Path $tmpDir "$suffix.json"
  # Write UTF-8 WITHOUT a BOM — the AWS CLI JSON parser rejects a leading BOM.
  [System.IO.File]::WriteAllText($tmpFile, $tables[$suffix], (New-Object System.Text.UTF8Encoding($false)))

  Write-Host "[create] $tableName ..."
  aws dynamodb create-table `
    --cli-input-json "file://$tmpFile" `
    --table-name $tableName `
    --region $Region `
    @endpointArg | Out-Null

  if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to create $tableName"
    exit 1
  }

  # Wait until ACTIVE before moving on.
  aws dynamodb wait table-exists --table-name $tableName --region $Region @endpointArg
  Write-Host "[ready]  $tableName"
}

Remove-Item -Recurse -Force $tmpDir -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Done. Set these in backend/.env:"
Write-Host "  AWS_REGION=$Region"
Write-Host "  DDB_TABLE_PREFIX=$Prefix"
