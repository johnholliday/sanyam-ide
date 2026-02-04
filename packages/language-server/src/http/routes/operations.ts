/**
 * Operations Routes
 *
 * REST endpoints for grammar operation execution and discovery.
 *
 * @packageDocumentation
 */

import { Hono } from 'hono';
import type { OperationExecutor } from '../../operations/operation-executor.js';
import type { OperationRegistry } from '../../operations/operation-registry.js';
import type { DocumentReference, OperationUser } from '@sanyam/types';
import { createLogger } from '@sanyam/logger';
import type { HonoEnv } from '../types.js';

const logger = createLogger({ name: 'OperationsRoutes' });

/**
 * Request body for operation execution.
 */
interface ExecuteOperationBody {
  /** Document reference (full form) */
  document?: DocumentReference;

  /** Document URI (shorthand) */
  uri?: string;

  /** Inline content (shorthand) */
  content?: string;
  fileName?: string;

  /** Selected element IDs */
  selectedIds?: string[];

  /** Operation-specific input */
  input?: Record<string, unknown>;
}

/**
 * Create operations routes.
 *
 * @param executor - Operation executor
 * @param registry - Operation registry
 * @returns Hono router
 */
export function createOperationsRoutes(
  executor: OperationExecutor,
  registry: OperationRegistry
): Hono<HonoEnv> {
  const router = new Hono<HonoEnv>();

  /**
   * List all languages with operations.
   *
   * GET /api/v1/operations
   */
  router.get('/operations', (c) => {
    const languageIds = registry.getAllLanguageIds();
    const result = languageIds.map((languageId) => ({
      languageId,
      operationCount: registry.getOperationsForLanguage(languageId).length,
    }));

    return c.json({
      success: true,
      data: { languages: result },
    });
  });

  /**
   * List operations for a language.
   *
   * GET /api/v1/:lang/operations
   */
  router.get('/:lang/operations', (c) => {
    const lang = c.req.param('lang');
    const operations = registry.getOperationDeclarations(lang);

    if (operations.length === 0) {
      // Check if language exists at all
      if (!registry.getAllLanguageIds().includes(lang)) {
        return c.json(
          {
            success: false,
            error: `Language not found: ${lang}`,
          },
          404
        );
      }
    }

    return c.json({
      success: true,
      data: { languageId: lang, operations },
    });
  });

  /**
   * Get operation details.
   *
   * GET /api/v1/:lang/operations/:operationId
   */
  router.get('/:lang/operations/:operationId', (c) => {
    const lang = c.req.param('lang');
    const operationId = c.req.param('operationId');

    const operation = registry.getOperation(lang, operationId);
    if (!operation) {
      return c.json(
        {
          success: false,
          error: `Operation not found: ${lang}/${operationId}`,
        },
        404
      );
    }

    return c.json({
      success: true,
      data: { operation: operation.declaration },
    });
  });

  /**
   * Execute an operation.
   *
   * POST /api/v1/:lang/operations/:operationId
   */
  router.post('/:lang/operations/:operationId', async (c) => {
    const lang = c.req.param('lang');
    const operationId = c.req.param('operationId');
    const correlationId = c.get('correlationId') as string;

    // Parse request body
    let body: ExecuteOperationBody;
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        {
          success: false,
          error: 'Invalid JSON body',
          correlationId,
        },
        400
      );
    }

    // Resolve document reference
    let document: DocumentReference;
    if (body.document) {
      document = body.document;
    } else if (body.uri) {
      document = { uri: body.uri };
    } else if (body.content && body.fileName) {
      document = { content: body.content, fileName: body.fileName };
    } else {
      return c.json(
        {
          success: false,
          error: 'Missing document reference. Provide "document", "uri", or "content" with "fileName".',
          correlationId,
        },
        400
      );
    }

    // Get user from context (set by auth middleware)
    const user = c.get('user') as OperationUser | undefined;

    // Execute the operation
    const startTime = Date.now();
    const result = await executor.execute({
      languageId: lang,
      operationId,
      document,
      selectedIds: body.selectedIds,
      input: body.input,
      user,
      correlationId,
    });

    const durationMs = Date.now() - startTime;

    logger.info(
      {
        correlationId,
        languageId: lang,
        operationId,
        success: result.success,
        durationMs,
        hasJobId: !!result.jobId,
      },
      'Operation executed via REST'
    );

    // Return appropriate response
    if (result.success) {
      if (result.jobId) {
        // Async operation - return job ID
        return c.json(
          {
            success: true,
            async: true,
            jobId: result.jobId,
            correlationId,
          },
          202 // Accepted
        );
      }

      // Sync operation - return result
      return c.json({
        success: true,
        data: result.result?.data,
        message: result.result?.message,
        correlationId,
        durationMs,
      });
    }

    // Error response
    return c.json(
      {
        success: false,
        error: result.error,
        correlationId,
        durationMs,
      },
      result.error?.includes('not found') ? 404 : 400
    );
  });

  /**
   * Parse DSL to JSON AST.
   *
   * POST /api/v1/:lang/parse
   */
  router.post('/:lang/parse', async (c) => {
    const lang = c.req.param('lang');
    const correlationId = c.get('correlationId') as string;

    // Parse request body
    let body: { content: string; fileName?: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        {
          success: false,
          error: 'Invalid JSON body',
          correlationId,
        },
        400
      );
    }

    if (!body.content) {
      return c.json(
        {
          success: false,
          error: 'Missing "content" field',
          correlationId,
        },
        400
      );
    }

    // Execute the built-in parse operation
    const result = await executor.execute({
      languageId: lang,
      operationId: '__parse__',
      document: {
        content: body.content,
        fileName: body.fileName ?? `temp.${lang}`,
      },
      correlationId,
    });

    if (result.success && result.result) {
      return c.json({
        success: true,
        data: result.result.data,
        correlationId,
      });
    }

    return c.json(
      {
        success: false,
        error: result.error ?? 'Parse failed',
        correlationId,
      },
      400
    );
  });

  return router;
}
