/**
 * Section Mutator
 *
 * Validates, merges, and persists section-level mutations to S3.
 * Increments the MongoDB version counter.
 */

const { SECTION_SCHEMAS, SECTION_JSON_KEYS } = require('../../schemas/sectionSchemas');
const s3Service = require('../storage/s3');
const { deriveDeliveryPlan, ensureDeliveryPlan } = require('./deliveryPlanService');
const { upsertEmbeddedProposalVersion } = require('./proposalAccess');

/**
 * Parse and validate the LLM's mutation output against the section's Zod schema.
 *
 * @param {string} rawOutput - Raw JSON string from the LLM
 * @param {string} targetSection - The section being mutated
 * @returns {Object} Validated section data
 * @throws {Error} If parsing or validation fails
 */
function validateSectionOutput(rawOutput, targetSection) {
  const schema = SECTION_SCHEMAS[targetSection];

  if (!schema) {
    throw new Error(`SCHEMA_INVALID: No schema found for section "${targetSection}"`);
  }

  // Strip code fences if present
  let cleaned = rawOutput.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

  // Try to extract the relevant JSON structure
  let parsed;

  try {
    parsed = JSON.parse(cleaned);
  } catch (_parseError) {
    // Try extracting JSON object or array from the string
    const objectStart = cleaned.indexOf('{');
    const arrayStart = cleaned.indexOf('[');
    const start = Math.min(
      objectStart === -1 ? Infinity : objectStart,
      arrayStart === -1 ? Infinity : arrayStart
    );

    if (start === Infinity) {
      throw new Error('SCHEMA_INVALID: No valid JSON found in mutation output');
    }

    const isArray = start === arrayStart;
    const end = isArray ? cleaned.lastIndexOf(']') : cleaned.lastIndexOf('}');

    if (end <= start) {
      throw new Error('SCHEMA_INVALID: Incomplete JSON in mutation output');
    }

    parsed = JSON.parse(cleaned.slice(start, end + 1));
  }

  // For summary, the LLM may return { project_summary: "..." } — extract the string
  if (targetSection === 'summary') {
    if (typeof parsed === 'object' && parsed.project_summary) {
      parsed = parsed.project_summary;
    } else if (typeof parsed !== 'string') {
      throw new Error('SCHEMA_INVALID: Summary mutation must return a string');
    }
  }

  // Validate against Zod schema
  return schema.parse(parsed);
}

/**
 * Merge the validated new section data into the full proposal JSON.
 *
 * @param {Object} proposalJSON - Current full proposal JSON
 * @param {string} targetSection - The section to replace
 * @param {*} newSectionData - Validated new section data
 * @returns {Object} Updated proposal JSON
 */
function mergeSectionUpdate(proposalJSON, targetSection, newSectionData) {
  const jsonKey = SECTION_JSON_KEYS[targetSection] || targetSection;
  const merged = {
    ...proposalJSON,
    [jsonKey]: newSectionData,
  };

  if (targetSection === 'timeline') {
    const refreshed = deriveDeliveryPlan({
      ...merged,
      delivery_plan: {
        ...(merged.delivery_plan || {}),
        notificationDefaults: merged.delivery_plan?.notificationDefaults,
      },
    });

    return {
      ...merged,
      delivery_plan: refreshed,
    };
  }

  return ensureDeliveryPlan(merged);
}

/**
 * Persist the mutated proposal as a new version to S3 and update MongoDB.
 *
 * @param {string} userId
 * @param {string} proposalId
 * @param {Object} mergedProposal - The full proposal JSON with the mutation applied
 * @param {Object} proposalRecord - The Mongoose document
 * @returns {Promise<{ newVersion: number, s3Key: string }>}
 */
async function persistMutation(userId, proposalId, mergedProposal, proposalRecord) {
  const newVersion = proposalRecord.versionCount + 1;

  const s3Key = await s3Service.uploadProposalJSON(
    userId,
    proposalId,
    newVersion,
    mergedProposal
  );

  proposalRecord.set({
    s3Key,
    versionCount: newVersion,
    status: 'complete',
  });
  upsertEmbeddedProposalVersion(proposalRecord, newVersion, mergedProposal, s3Key);
  await proposalRecord.save();

  return { newVersion, s3Key };
}

module.exports = {
  validateSectionOutput,
  mergeSectionUpdate,
  persistMutation,
};
