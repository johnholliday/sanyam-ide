/**
 * Models Routes
 *
 * Grammar-agnostic CRUD endpoints for workspace model files.
 * Lists, reads, creates, updates, and deletes models across all grammars.
 *
 * @packageDocumentation
 */

import { Hono } from 'hono';
import { URI } from 'langium';
import type { LangiumSharedCoreServices, LangiumDocument } from 'langium';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { LanguageRegistry } from '../../language-registry.js';
import { ModelConverter } from '../../model/model-converter.js';
import { createLogger } from '@sanyam/logger';
import type { HonoEnv } from '../types.js';

const logger = createLogger({ name: 'ModelsRoutes' });

/**
 * Dependencies for models routes.
 */
export interface ModelsRouteDeps {
  /** Langium shared core services for workspace access */
  sharedServices: LangiumSharedCoreServices;
  /** Language registry for metadata lookups */
  languageRegistry: LanguageRegistry;
  /** Workspace root directory for file operations */
  workspaceRoot: string;
}

/**
 * Summary of a model in the workspace.
 */
interface ModelSummary {
  uri: string;
  languageId: string;
  displayName: string;
  version: number;
  hasErrors: boolean;
  diagnosticCount: number;
}

/**
 * Detailed model with content and AST.
 */
interface ModelDetail extends ModelSummary {
  content: string;
  ast: unknown;
  diagnostics: Array<{ severity: number; message: string; range: unknown }>;
}

/**
 * Request body for creating a model.
 */
interface CreateModelBody {
  languageId: string;
  name: string;
  content?: string;
  rootType?: string;
}

/**
 * Request body for updating a model.
 */
interface UpdateModelBody {
  content: string;
}

/**
 * Sanitize a model name to prevent directory traversal attacks.
 *
 * @param name - The name to validate
 * @returns true if the name is safe
 */
function isValidModelName(name: string): boolean {
  if (!name || name.length === 0 || name.length > 255) {
    return false;
  }
  // Reject path separators and parent directory traversal
  if (name.includes('/') || name.includes('\\') || name.includes('..')) {
    return false;
  }
  // Reject control characters
  if (/[\x00-\x1f\x7f]/.test(name)) {
    return false;
  }
  return true;
}

/**
 * Extract display name from a document URI.
 *
 * @param uri - The document URI string
 * @returns The file name portion
 */
function getDisplayName(uri: string): string {
  const parsed = URI.parse(uri);
  const segments = parsed.path.split('/');
  return segments[segments.length - 1] ?? uri;
}

/**
 * Build a model summary from a Langium document.
 *
 * @param doc - The Langium document
 * @param languageId - The language ID for this document
 * @returns Model summary object
 */
function buildModelSummary(doc: LangiumDocument, languageId: string): ModelSummary {
  const diagnostics = doc.diagnostics ?? [];
  const errorCount = diagnostics.filter(d => d.severity === 1).length;

  return {
    uri: doc.uri.toString(),
    languageId,
    displayName: getDisplayName(doc.uri.toString()),
    version: doc.textDocument.version,
    hasErrors: errorCount > 0,
    diagnosticCount: diagnostics.length,
  };
}

/**
 * Build a detailed model response from a Langium document.
 *
 * @param doc - The Langium document
 * @param languageId - The language ID for this document
 * @returns Model detail object
 */
function buildModelDetail(doc: LangiumDocument, languageId: string): ModelDetail {
  const summary = buildModelSummary(doc, languageId);
  const converter = new ModelConverter();
  const astResult = converter.convert(doc.parseResult.value);
  const diagnostics = (doc.diagnostics ?? []).map(d => ({
    severity: d.severity ?? 1,
    message: d.message,
    range: d.range,
  }));

  return {
    ...summary,
    content: doc.textDocument.getText(),
    ast: astResult.data,
    diagnostics,
  };
}

/**
 * Create models CRUD routes.
 *
 * @param deps - Route dependencies
 * @returns Hono router for /models endpoints
 */
export function createModelsRoutes(deps: ModelsRouteDeps): Hono<HonoEnv> {
  const router = new Hono<HonoEnv>();
  const { sharedServices, languageRegistry, workspaceRoot } = deps;

  /**
   * GET /models
   *
   * Without `uri` query param: list all workspace models.
   * With `uri` query param: get single model detail.
   * Optional `language` query param to filter by language ID.
   */
  router.get('/models', (c) => {
    const correlationId = c.get('correlationId') ?? 'unknown';
    const uriParam = c.req.query('uri');

    // Single model detail mode
    if (uriParam) {
      try {
        const parsedUri = URI.parse(uriParam);
        const doc = sharedServices.workspace.LangiumDocuments.getDocument(parsedUri);

        if (!doc) {
          return c.json(
            { success: false, error: `Model not found: ${uriParam}`, correlationId },
            404
          );
        }

        const registered = languageRegistry.getByUri(uriParam);
        if (!registered) {
          return c.json(
            { success: false, error: `No language registered for URI: ${uriParam}`, correlationId },
            404
          );
        }

        const detail = buildModelDetail(doc, registered.contribution.languageId);
        return c.json({ success: true, data: detail, correlationId });
      } catch (err) {
        logger.error({ err, uri: uriParam }, 'Error fetching model detail');
        return c.json(
          { success: false, error: 'Failed to fetch model detail', correlationId },
          500
        );
      }
    }

    // List mode
    try {
      const languageFilter = c.req.query('language');
      const models: ModelSummary[] = [];

      for (const doc of sharedServices.workspace.LangiumDocuments.all) {
        // Only include file:// scheme documents (skip inmemory:// ephemeral docs)
        if (doc.uri.scheme !== 'file') {
          continue;
        }

        const registered = languageRegistry.getByUri(doc.uri.toString());
        if (!registered) {
          continue; // Not a grammar-managed document
        }

        const langId = registered.contribution.languageId;

        // Apply optional language filter
        if (languageFilter && langId !== languageFilter) {
          continue;
        }

        models.push(buildModelSummary(doc, langId));
      }

      return c.json({
        success: true,
        data: { models, total: models.length },
        correlationId,
      });
    } catch (err) {
      logger.error({ err }, 'Error listing models');
      return c.json(
        { success: false, error: 'Failed to list models', correlationId },
        500
      );
    }
  });

  /**
   * POST /models
   *
   * Create a new model file in the workspace.
   * Body: { languageId, name, content?, rootType? }
   */
  router.post('/models', async (c) => {
    const correlationId = c.get('correlationId') ?? 'unknown';

    let body: CreateModelBody;
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        { success: false, error: 'Invalid JSON body', correlationId },
        400
      );
    }

    // Validate required fields
    if (!body.languageId) {
      return c.json(
        { success: false, error: 'Missing required field: languageId', correlationId },
        400
      );
    }
    if (!body.name) {
      return c.json(
        { success: false, error: 'Missing required field: name', correlationId },
        400
      );
    }

    // Sanitize name
    if (!isValidModelName(body.name)) {
      return c.json(
        { success: false, error: 'Invalid model name. Must not contain path separators, "..", or control characters.', correlationId },
        400
      );
    }

    // Look up grammar
    const registered = languageRegistry.getByLanguageId(body.languageId);
    if (!registered) {
      return c.json(
        { success: false, error: `Language not found: ${body.languageId}`, correlationId },
        404
      );
    }

    const manifest = registered.contribution.manifest;

    // Find root type configuration
    let rootTypeConfig = manifest.rootTypes[0]; // Default: first entry
    if (body.rootType) {
      const found = manifest.rootTypes.find(
        rt => rt.astType === body.rootType || rt.displayName === body.rootType
      );
      if (!found) {
        return c.json(
          {
            success: false,
            error: `Root type not found: ${body.rootType}. Available: ${manifest.rootTypes.map(rt => rt.astType).join(', ')}`,
            correlationId,
          },
          400
        );
      }
      rootTypeConfig = found;
    }

    if (!rootTypeConfig) {
      return c.json(
        { success: false, error: `No root types configured for language: ${body.languageId}`, correlationId },
        400
      );
    }

    // Compute file path
    const fileName = body.name + rootTypeConfig.fileSuffix + manifest.baseExtension;
    const dir = path.join(workspaceRoot, rootTypeConfig.folder);
    const filePath = path.join(dir, fileName);

    // Determine content
    const content = body.content ?? rootTypeConfig.template.replaceAll('${name}', body.name);

    try {
      // Ensure directory exists
      await fs.mkdir(dir, { recursive: true });

      // Check if file already exists
      try {
        await fs.access(filePath);
        return c.json(
          { success: false, error: `File already exists: ${fileName}`, correlationId },
          409
        );
      } catch {
        // File doesn't exist — proceed
      }

      // Write file
      await fs.writeFile(filePath, content, 'utf-8');

      // Register with Langium workspace
      const fileUri = URI.file(filePath);
      const doc = await sharedServices.workspace.LangiumDocuments.getOrCreateDocument(fileUri);
      await sharedServices.workspace.DocumentBuilder.build([doc]);

      const detail = buildModelDetail(doc, body.languageId);

      logger.info(
        { correlationId, languageId: body.languageId, name: body.name, filePath },
        'Model created'
      );

      return c.json(
        { success: true, data: detail, correlationId },
        201
      );
    } catch (err) {
      logger.error({ err, filePath }, 'Error creating model');
      return c.json(
        { success: false, error: 'Failed to create model file', correlationId },
        500
      );
    }
  });

  /**
   * PUT /models?uri=...
   *
   * Update model content.
   * Body: { content: string }
   */
  router.put('/models', async (c) => {
    const correlationId = c.get('correlationId') ?? 'unknown';
    const uriParam = c.req.query('uri');

    if (!uriParam) {
      return c.json(
        { success: false, error: 'Missing required query parameter: uri', correlationId },
        400
      );
    }

    let body: UpdateModelBody;
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        { success: false, error: 'Invalid JSON body', correlationId },
        400
      );
    }

    if (typeof body.content !== 'string') {
      return c.json(
        { success: false, error: 'Missing required field: content (string)', correlationId },
        400
      );
    }

    try {
      const parsedUri = URI.parse(uriParam);
      const existingDoc = sharedServices.workspace.LangiumDocuments.getDocument(parsedUri);

      if (!existingDoc) {
        return c.json(
          { success: false, error: `Model not found: ${uriParam}`, correlationId },
          404
        );
      }

      const registered = languageRegistry.getByUri(uriParam);
      if (!registered) {
        return c.json(
          { success: false, error: `No language registered for URI: ${uriParam}`, correlationId },
          404
        );
      }

      // Write new content to disk
      const filePath = parsedUri.fsPath;
      await fs.writeFile(filePath, body.content, 'utf-8');

      // Trigger Langium rebuild
      await sharedServices.workspace.DocumentBuilder.update([parsedUri], []);

      // Re-fetch the updated document
      const updatedDoc = sharedServices.workspace.LangiumDocuments.getDocument(parsedUri);
      if (!updatedDoc) {
        return c.json(
          { success: false, error: 'Document disappeared after update', correlationId },
          500
        );
      }

      const detail = buildModelDetail(updatedDoc, registered.contribution.languageId);

      logger.info(
        { correlationId, uri: uriParam, contentLength: body.content.length },
        'Model updated'
      );

      return c.json({ success: true, data: detail, correlationId });
    } catch (err) {
      logger.error({ err, uri: uriParam }, 'Error updating model');
      return c.json(
        { success: false, error: 'Failed to update model', correlationId },
        500
      );
    }
  });

  /**
   * DELETE /models?uri=...
   *
   * Delete a model file from the workspace and Langium documents.
   */
  router.delete('/models', async (c) => {
    const correlationId = c.get('correlationId') ?? 'unknown';
    const uriParam = c.req.query('uri');

    if (!uriParam) {
      return c.json(
        { success: false, error: 'Missing required query parameter: uri', correlationId },
        400
      );
    }

    try {
      const parsedUri = URI.parse(uriParam);
      const existingDoc = sharedServices.workspace.LangiumDocuments.getDocument(parsedUri);

      if (!existingDoc) {
        return c.json(
          { success: false, error: `Model not found: ${uriParam}`, correlationId },
          404
        );
      }

      // Remove from Langium workspace
      sharedServices.workspace.LangiumDocuments.deleteDocument(parsedUri);
      await sharedServices.workspace.DocumentBuilder.update([], [parsedUri]);

      // Delete from disk
      const filePath = parsedUri.fsPath;
      try {
        await fs.unlink(filePath);
      } catch (unlinkErr) {
        // File may have already been deleted; log but don't fail
        logger.warn({ err: unlinkErr, filePath }, 'File already deleted from disk');
      }

      logger.info({ correlationId, uri: uriParam }, 'Model deleted');

      return c.json({
        success: true,
        data: { deleted: true, uri: uriParam },
        correlationId,
      });
    } catch (err) {
      logger.error({ err, uri: uriParam }, 'Error deleting model');
      return c.json(
        { success: false, error: 'Failed to delete model', correlationId },
        500
      );
    }
  });

  return router;
}
