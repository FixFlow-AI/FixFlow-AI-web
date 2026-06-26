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
  [string]$Region = $(if ($env:AWS_REGION) { $env:AWS_REGION } else { "us-east-1" }),
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
  # 1) Users — login identities. Query by id (PK) and by Google subject (GSI).
  "users" = @'
{
  "AttributeDefinitions": [
    { "AttributeName": "userId", "AttributeType": "S" },
    { "AttributeName": "googleSub", "AttributeType": "S" }
  ],
  "KeySchema": [ { "AttributeName": "userId", "KeyType": "HASH" } ],
  "GlobalSecondaryIndexes": [
    {
      "IndexName": "GoogleSubIndex",
      "KeySchema": [ { "AttributeName": "googleSub", "KeyType": "HASH" } ],
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
}

# Deterministic order so dependent reads are predictable in logs.
$order = @("users", "freelancers", "proposals", "milestones", "audit_blocks", "opportunities", "raw_posts")

Write-Host "Region : $Region"
Write-Host "Prefix : $Prefix"
if ($Endpoint -ne "") { Write-Host "Endpoint: $Endpoint (local)" }
Write-Host ""

$tmpDir = Join-Path $env:TEMP "fixflow-ddb"
New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null

foreach ($suffix in $order) {
  $tableName = "${Prefix}_${suffix}"

  # Skip if it already exists (idempotent re-runs).
  $exists = $true
  try {
    aws dynamodb describe-table --table-name $tableName --region $Region @endpointArg *> $null
    if ($LASTEXITCODE -ne 0) { $exists = $false }
  } catch { $exists = $false }

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
