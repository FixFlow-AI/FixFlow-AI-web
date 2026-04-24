/**
 * ProposalChat Route Handler
 *
 * POST /api/proposal/:id/chat
 *
 * Handles both Q&A (question) and mutation (mutate) intents.
 * Streams responses via SSE using the same pattern as /generate.
 */

const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { proposalChatSchema } = require('../models/schemas');
const { fetchProposalContext, buildChatPrompt } = require('../services/proposal/proposalChatService');
const { validateSectionOutput, mergeSectionUpdate, persistMutation } = require('../services/proposal/sectionMutator');
const { shouldReclassifyAsMutation, classifyIntent } = require('../services/proposal/intentClassifier');
const { VALID_SECTIONS } = require('../schemas/sectionSchemas');
const { env } = require('../config/env');
const { ForbiddenError } = require('../utils/errors');
const {
  createGeminiGuard,
  isGeminiAuthError,
  isGeminiModelError,
  isGeminiQuotaError,
  getGeminiAuthErrorMessage,
  getGeminiModelCandidates,
} = require('../services/llm/geminiGuard');
const { geminiModelCoordinator } = require('../services/llm/modelCoordinator');
const { getGeminiClient } = require('../services/llm/provider');
const { recordChatTiming } = require('../services/eta/etaService');

const router = express.Router();
const geminiGuard = createGeminiGuard({ cooldownMs: env.GEMINI_KEY_GUARD_MS });

/**
 * Stream from Gemini for chat responses.
 *
 * @param {string} system - System prompt
 * @param {string} userMessage - User message
 * @param {Object} options - { temperature, jsonMode }
 */
async function* streamGeminiChat(system, userMessage, options = {}) {
  const { temperature = 0.3, jsonMode = false } = options;
  const models = getGeminiModelCandidates(
    env.GEMINI_MODEL,
    env.GEMINI_FALLBACK_MODEL,
    env.GEMINI_MODEL_FALLBACKS
  );
  let lastError = null;
  let waitCycles = 0;

  while (waitCycles <= models.length) {
    let attemptedModel = false;

    for (let index = 0; index < models.length; index += 1) {
      const model = models[index];
      const reservation = await geminiModelCoordinator.acquire(model);

      if (!reservation.ok) {
        continue;
      }

      attemptedModel = true;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), env.STREAM_TIMEOUT_MS);

      if (reservation.waitMs > 0) {
        console.log(
          JSON.stringify({
            event: 'LLM_MODEL_WAIT',
            model,
            waitMs: reservation.waitMs,
          })
        );
      }

      try {
        const gemini = getGeminiClient();

        const config = {
          temperature,
          maxOutputTokens: 8000,
          systemInstruction: system,
        };

        if (jsonMode) {
          config.responseMimeType = 'application/json';
        }

        const stream = await gemini.models.generateContentStream({
          model,
          contents: userMessage,
          config: { ...config, abortSignal: controller.signal },
        });

        for await (const chunk of stream) {
          if (chunk.text) {
            yield chunk.text;
          }
        }

        clearTimeout(timeout);
        return;
      } catch (error) {
        clearTimeout(timeout);
        lastError = error;

        if (error?.name === 'AbortError') {
          throw new Error('LLM_TIMEOUT: Chat request timed out.');
        }
        if (isGeminiAuthError(error)) {
          geminiGuard.markHardFailure(error);
          throw new Error(`GEMINI_AUTH_ERROR: ${getGeminiAuthErrorMessage(error, { model })}`);
        }

        if (isGeminiQuotaError(error)) {
          const retryMs = geminiModelCoordinator.markQuotaError(model, error);
          console.log(
            JSON.stringify({
              event: 'LLM_MODEL_COOLDOWN',
              model,
              retryMs,
            })
          );
        }

        if (index < models.length - 1 && (isGeminiQuotaError(error) || isGeminiModelError(error))) {
          console.log(
            JSON.stringify({
              event: 'LLM_MODEL_FALLBACK',
              from: model,
              to: models[index + 1],
              reason: error.message,
            })
          );
          continue;
        }

        throw error;
      }
    }

    if (!attemptedModel) {
      const waitMs = geminiModelCoordinator.getEarliestAvailabilityDelayMs(models);
      if (waitMs > 0 && waitMs <= env.GEMINI_MAX_QUEUE_WAIT_MS) {
        console.log(
          JSON.stringify({
            event: 'LLM_GLOBAL_WAIT',
            waitMs,
            models,
          })
        );
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        waitCycles += 1;
        continue;
      }
    }

    break;
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error(
    `STREAM_ERROR: All configured Gemini models are currently rate-limited beyond the local queue window (${env.GEMINI_MAX_QUEUE_WAIT_MS}ms).`
  );
}

/**
 * Generate a mock Q&A response for fake LLM mode.
 */
async function* streamMockQuestion(message) {
  const response = `Based on the proposal, here's my analysis:

The proposal addresses your query about "${message.slice(0, 80)}..." comprehensively.

**Key Points:**
- The current approach balances thoroughness with delivery speed
- Risk mitigation strategies are built into each phase
- The confidence scores reflect realistic assessments based on the project scope
- Timeline estimates include buffer for unexpected complexity

The architecture decisions were made to optimize for maintainability and scalability while keeping the initial delivery timeline practical. Each phase builds on the previous one's deliverables, creating a natural progression that reduces integration risk.

Would you like me to elaborate on any specific aspect?`;

  for (let i = 0; i < response.length; i += 40) {
    await new Promise((resolve) => setTimeout(resolve, 30));
    yield response.slice(i, i + 40);
  }
}

/**
 * Generate a mock mutation response for fake LLM mode.
 */
async function* streamMockMutation(targetSection, proposalJSON) {
  // Return a slightly modified version of the existing section data
  const { SECTION_JSON_KEYS } = require('../schemas/sectionSchemas');
  const jsonKey = SECTION_JSON_KEYS[targetSection] || targetSection;
  const currentData = proposalJSON[jsonKey];

  let mutatedData;

  if (targetSection === 'summary') {
    mutatedData = JSON.stringify({
      project_summary: (currentData || '') + ' [Updated based on negotiation feedback — scope refined for faster delivery.]',
    });
  } else if (Array.isArray(currentData)) {
    mutatedData = JSON.stringify(currentData, null, 2);
  } else {
    mutatedData = JSON.stringify(currentData || {}, null, 2);
  }

  for (let i = 0; i < mutatedData.length; i += 80) {
    await new Promise((resolve) => setTimeout(resolve, 25));
    yield mutatedData.slice(i, i + 80);
  }
}

// ── Main Route Handler ─────────────────────────────────────────────────────

router.post('/:id/chat', authMiddleware, async (req, res, next) => {
  try {
    const payload = proposalChatSchema.parse(req.body);
    let { intent, targetSection } = payload;
    const { message, history } = payload;
    const proposalId = req.params.id;

    // Validate targetSection if provided
    if (targetSection && !VALID_SECTIONS.includes(targetSection)) {
      targetSection = null;
    }

    // If intent is mutate but no section specified, try to extract one
    if (intent === 'mutate' && !targetSection) {
      const classified = classifyIntent(message);
      targetSection = classified.targetSection;

      // If still no section, fall back to question mode
      if (!targetSection) {
        intent = 'question';
      }
    }

    // Fetch proposal context
    const { proposal, proposalJSON, role } = await fetchProposalContext(
      req.user.userId,
      proposalId
    );

    if (intent === 'mutate' && !['owner', 'editor'].includes(role)) {
      throw new ForbiddenError('Your workspace role does not allow proposal mutations.');
    }

    // Build prompt
    const { system, user } = buildChatPrompt(
      proposalJSON,
      message,
      history || [],
      intent,
      targetSection
    );

    // Set up SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders?.();

    const keepAlive = setInterval(() => res.write(': keepalive\n\n'), 20000);
    const startTime = Date.now();

    const sendEvent = (event, data = {}) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      let fullBuffer = '';

      // Choose stream source based on LLM mode
      const streamSource = env.USE_FAKE_LLM
        ? (intent === 'mutate'
            ? streamMockMutation(targetSection, proposalJSON)
            : streamMockQuestion(message))
        : streamGeminiChat(system, user, {
            temperature: intent === 'mutate' ? 0.2 : 0.3,
            jsonMode: intent === 'mutate',
          });

      for await (const chunk of streamSource) {
        fullBuffer += chunk;

        if (intent === 'mutate') {
          sendEvent('token', { chunk });
        } else {
          sendEvent('token', { text: chunk });
        }

        // Server-side reclassification check (first ~100 chars)
        if (intent === 'question' && fullBuffer.length <= 120 && shouldReclassifyAsMutation(fullBuffer)) {
          // Auto-reclassify — continue streaming but note the reclassification
          console.log(JSON.stringify({
            event: 'CHAT_RECLASSIFY',
            proposalId,
            from: 'question',
            to: 'mutate',
          }));
        }
      }

      // Handle mutation path: validate, merge, persist
      if (intent === 'mutate' && targetSection) {
        try {
          const validatedSection = validateSectionOutput(fullBuffer, targetSection);
          const mergedProposal = mergeSectionUpdate(proposalJSON, targetSection, validatedSection);
          const { newVersion } = await persistMutation(
            req.user.userId,
            proposalId,
            mergedProposal,
            proposal
          );

          sendEvent('section_update', {
            section: targetSection,
            payload: validatedSection,
            newVersion,
            summary: `${targetSection.charAt(0).toUpperCase() + targetSection.slice(1)} section updated based on your request.`,
          });

          console.log(JSON.stringify({
            event: 'CHAT_MUTATION_COMPLETE',
            proposalId,
            userId: req.user.userId,
            section: targetSection,
            newVersion,
          }));

          await recordChatTiming({
            proposal,
            intent,
            targetSection,
            durationMs: Date.now() - startTime,
          }).catch(() => null);
        } catch (validationError) {
          sendEvent('error', {
            code: 'SCHEMA_INVALID',
            message: `Mutation validation failed: ${validationError.message}`,
          });
        }
      } else {
        await recordChatTiming({
          proposal,
          intent,
          durationMs: Date.now() - startTime,
        }).catch(() => null);
      }

      sendEvent('done', { fullResponse: intent === 'question' ? fullBuffer : undefined });
    } catch (streamError) {
      const code = streamError.message.includes('TIMEOUT') ? 'LLM_TIMEOUT'
        : streamError.message.includes('AUTH') ? 'GEMINI_AUTH_ERROR'
        : 'STREAM_ERROR';

      sendEvent('error', {
        code,
        message: streamError.message || 'Chat streaming failed.',
      });

      console.log(JSON.stringify({
        event: 'CHAT_ERROR',
        proposalId,
        userId: req.user.userId,
        error: streamError.message,
      }));
    } finally {
      clearInterval(keepAlive);
      res.end();
    }
  } catch (error) {
    // If headers haven't been sent yet, use the normal error handler
    if (!res.headersSent) {
      return next(error);
    }
    res.end();
  }
});

module.exports = router;
