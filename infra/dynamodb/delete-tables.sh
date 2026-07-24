#!/usr/bin/env bash
#
# Deletes all FixFlowAI DynamoDB tables for a given prefix. IRREVERSIBLE.
# Usage: DDB_TABLE_PREFIX=fixflow ./delete-tables.sh
#
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
PREFIX="${DDB_TABLE_PREFIX:-fixflow}"
ENDPOINT_ARG=()
if [[ -n "${DDB_ENDPOINT:-}" ]]; then
  ENDPOINT_ARG=(--endpoint-url "${DDB_ENDPOINT}")
fi

SUFFIXES=(users freelancers proposals milestones audit_blocks processed_events opportunities raw_posts)

echo "About to DELETE these tables in region ${REGION}:"
for s in "${SUFFIXES[@]}"; do echo "  ${PREFIX}_${s}"; done
read -r -p "Type the prefix '${PREFIX}' to confirm: " confirm
[[ "${confirm}" == "${PREFIX}" ]] || { echo "Aborted."; exit 1; }

for s in "${SUFFIXES[@]}"; do
  table="${PREFIX}_${s}"
  if aws dynamodb delete-table --table-name "${table}" --region "${REGION}" "${ENDPOINT_ARG[@]}" >/dev/null 2>&1; then
    echo "[deleted] ${table}"
  else
    echo "[skip]    ${table} (not found)"
  fi
done
echo "Done."
