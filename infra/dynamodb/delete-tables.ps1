<#
.SYNOPSIS
  Deletes all FixFlowAI DynamoDB tables for a given prefix. IRREVERSIBLE.
.EXAMPLE
  ./delete-tables.ps1 -Prefix fixflow
#>
param(
  [string]$Region = $(if ($env:AWS_REGION) { $env:AWS_REGION } else { "us-east-1" }),
  [string]$Prefix = $(if ($env:DDB_TABLE_PREFIX) { $env:DDB_TABLE_PREFIX } else { "fixflow" }),
  [string]$Endpoint = ""
)
$ErrorActionPreference = "Stop"

$endpointArg = @()
if ($Endpoint -ne "") { $endpointArg = @("--endpoint-url", $Endpoint) }

$suffixes = @("users", "freelancers", "proposals", "milestones", "audit_blocks", "processed_events", "opportunities", "raw_posts")

Write-Host "About to DELETE these tables in region $Region:" -ForegroundColor Yellow
$suffixes | ForEach-Object { Write-Host "  ${Prefix}_$_" }
$confirm = Read-Host "Type the prefix '$Prefix' to confirm"
if ($confirm -ne $Prefix) { Write-Host "Aborted."; exit 1 }

foreach ($suffix in $suffixes) {
  $table = "${Prefix}_${suffix}"
  try {
    aws dynamodb delete-table --table-name $table --region $Region @endpointArg *> $null
    if ($LASTEXITCODE -eq 0) { Write-Host "[deleted] $table" }
    else { Write-Host "[skip]    $table (not found)" }
  } catch { Write-Host "[skip]    $table (not found)" }
}
Write-Host "Done."
