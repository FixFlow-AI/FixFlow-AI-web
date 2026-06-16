# Escrow + Blockchain Launch Implementation Plan

## Completed in this change

1. Added monorepo target folders: `apps/web`, `apps/api`, and `contracts`.
2. Added an escrow lifecycle API surface under `/api/escrows` with create/list/detail/fund/submit/approve/dispute endpoints.
3. Extended escrow persistence model with production lifecycle fields (`state`, `buyerAddress`, `sellerAddress`, `fundedAt`, milestone `deadline`).
4. Added Solidity contract skeleton with role model and state/event definitions for production hardening.

## Next implementation queue

- Wire frontend escrow wizard and escrow details view to new `/api/escrows` endpoints.
- Add chain event indexer worker and reconciliation process.
- Add KYC/KYB provider integration and policy gates before funding/release actions.
- Add CI jobs for contract tests, API tests, and lint/build checks across app folders.
