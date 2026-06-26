# FixFlowAI — DynamoDB Tables

Scripts to provision all DynamoDB tables for FixFlowAI. On-demand billing
(`PAY_PER_REQUEST`) — no capacity planning, you pay only per request, ~$0 at rest.

## Prerequisites

1. **AWS CLI installed** — https://aws.amazon.com/cli/
2. **Credentials configured** — run `aws configure` (access key, secret, region) or use an SSO profile.
3. Confirm identity: `aws sts get-caller-identity` should print your account.

## Run it

**Windows (PowerShell):**
```powershell
cd infra/dynamodb
./create-tables.ps1                                   # region us-east-1, prefix "fixflow"
./create-tables.ps1 -Region ap-south-1 -Prefix fixflow_prod
```

**Mac / Linux / CI (bash):**
```bash
cd infra/dynamodb
chmod +x create-tables.sh
./create-tables.sh
AWS_REGION=ap-south-1 DDB_TABLE_PREFIX=fixflow_prod ./create-tables.sh
```

Both scripts are **idempotent** — re-running skips tables that already exist.

## Local development without AWS (optional)

Run [DynamoDB Local](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.html) in Docker, then point the script at it — no cloud account needed:

```bash
docker run -p 8000:8000 amazon/dynamodb-local
# then:
DDB_ENDPOINT=http://localhost:8000 ./create-tables.sh
# or PowerShell:
./create-tables.ps1 -Endpoint http://localhost:8000
```

## After running — wire it into the backend

Add to `backend/.env`:
```dotenv
AWS_REGION=us-east-1
DDB_TABLE_PREFIX=fixflow
# For local DynamoDB only:
# DDB_ENDPOINT=http://localhost:8000
```

Then implement the DynamoDB-backed repositories (`DynamoDbUserRepository`,
`DynamoDbFreelancerRepository`, etc.) against the existing interfaces and select
them via the `*_PROVIDER` env vars. No other code changes — the repository
pattern is already the swap seam.

## Tables created

| Table (`<prefix>_…`) | Partition key | Sort key | GSI | Holds |
|:---|:---|:---|:---|:---|
| `users` | `userId` (S) | — | `GoogleSubIndex` (googleSub) | Login identities, roles, refresh-token hashes |
| `freelancers` | `freelancerId` (S) | — | — | Match roster (skills, GitHub, rates, reputation) |
| `proposals` | `proposalId` (S) | — | `UserProposalsIndex` (userId, createdAt) | Parsed briefs / generated proposals |
| `milestones` | `milestoneId` (S) | — | `ProposalMilestonesIndex` (proposalId) | Escrow FSM milestone state |
| `audit_blocks` | `milestoneId` (S) | `blockIndex` (N) | — | Cryptographic audit chain (ordered by index) |
| `opportunities` | `opportunityId` (S) | — | `UrlHashIndex` (urlHash) | AI-005 scored leads |
| `raw_posts` | `urlHash` (S) | — | — | AI-005 ingestion/dedupe cache |

### Why these shapes

- **`audit_blocks`** uses a composite key so one `Query` on `milestoneId` returns
  the whole chain already ordered by `blockIndex` — exactly what chain verification needs.
- **GSIs** exist only where a non-key access pattern is required (find user by Google
  sub, list a user's proposals, list a proposal's milestones, dedupe by URL hash).
- **`freelancers`** has no GSI yet — matching loads the roster, which is fine at MVP
  scale. Add a GSI when you need server-side filtering.

## Tear down (danger)

`delete-tables.ps1` / `.sh` remove **all** these tables and their data. Irreversible.
Only run against a dev/staging prefix.

```powershell
./delete-tables.ps1 -Prefix fixflow
```
```bash
DDB_TABLE_PREFIX=fixflow ./delete-tables.sh
```
