/**
 * OpenAPI Schema Builder
 *
 * Converts GrammarOperation definitions to OpenAPI 3.1 specification.
 * Used to generate RapiDoc documentation for the REST gateway.
 *
 * @packageDocumentation
 */

import type { GrammarOperation, JSONSchema } from '@sanyam/types';
import type { OperationRegistry } from '../../operations/operation-registry.js';

/**
 * OpenAPI 3.1 Document structure.
 */
export interface OpenAPIDocument {
  readonly openapi: '3.1.0';
  readonly info: OpenAPIInfo;
  readonly servers: readonly OpenAPIServer[];
  readonly tags: readonly OpenAPITag[];
  readonly paths: Record<string, OpenAPIPathItem>;
  readonly components?: OpenAPIComponents;
}

/**
 * OpenAPI info object.
 */
interface OpenAPIInfo {
  readonly title: string;
  readonly version: string;
  readonly description?: string;
}

/**
 * OpenAPI server definition.
 */
interface OpenAPIServer {
  readonly url: string;
  readonly description?: string;
}

/**
 * OpenAPI tag for grouping operations.
 */
interface OpenAPITag {
  readonly name: string;
  readonly description?: string;
}

/**
 * OpenAPI path item containing operations by method.
 */
export interface OpenAPIPathItem {
  readonly get?: OpenAPIOperation;
  readonly post?: OpenAPIOperation;
  readonly put?: OpenAPIOperation;
  readonly delete?: OpenAPIOperation;
}

/**
 * OpenAPI operation definition.
 */
interface OpenAPIOperation {
  readonly operationId: string;
  readonly summary: string;
  readonly description?: string;
  readonly tags?: readonly string[];
  readonly parameters?: readonly OpenAPIParameter[];
  readonly requestBody?: OpenAPIRequestBody;
  readonly responses: Record<string, OpenAPIResponse>;
  readonly 'x-tier'?: string;
  readonly 'x-category'?: string;
  readonly 'x-requires-auth'?: boolean;
}

/**
 * OpenAPI parameter definition.
 */
interface OpenAPIParameter {
  readonly name: string;
  readonly in: 'path' | 'query' | 'header';
  readonly required?: boolean;
  readonly description?: string;
  readonly schema: JSONSchema;
}

/**
 * OpenAPI request body definition.
 */
interface OpenAPIRequestBody {
  readonly description?: string;
  readonly required?: boolean;
  readonly content: Record<string, OpenAPIMediaType>;
}

/**
 * OpenAPI response definition.
 */
interface OpenAPIResponse {
  readonly description: string;
  readonly content?: Record<string, OpenAPIMediaType>;
}

/**
 * OpenAPI media type definition.
 */
interface OpenAPIMediaType {
  readonly schema: JSONSchema;
}

/**
 * OpenAPI components for reusable schemas.
 */
interface OpenAPIComponents {
  readonly schemas?: Record<string, JSONSchema>;
}

/**
 * Build the complete OpenAPI specification from the operation registry.
 *
 * @param registry - Operation registry containing all grammar operations
 * @param serverUrl - Base URL for the server (default: http://localhost:3001)
 * @returns Complete OpenAPI 3.1 document
 */
export function buildOpenAPISpec(
  registry: OperationRegistry,
  serverUrl = 'http://localhost:3001'
): OpenAPIDocument {
  const languageIds = registry.getAllLanguageIds();
  const tags: OpenAPITag[] = [];
  const paths: Record<string, OpenAPIPathItem> = {};

  // Add health tag
  tags.push({
    name: 'health',
    description: 'Health check endpoints',
  });

  // Add health endpoints
  paths['/api/health'] = {
    get: {
      operationId: 'healthCheck',
      summary: 'Liveness check',
      description: 'Returns 200 if the server process is alive.',
      tags: ['health'],
      responses: {
        '200': {
          description: 'Service is alive',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', enum: ['ok'] },
                  timestamp: { type: 'string', description: 'ISO 8601 timestamp' },
                },
              },
            },
          },
        },
      },
    },
  };

  paths['/api/ready'] = {
    get: {
      operationId: 'readyCheck',
      summary: 'Readiness check',
      description: 'Returns 200 if the server is ready to accept requests.',
      tags: ['health'],
      responses: {
        '200': {
          description: 'Server is ready',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', enum: ['ready'] },
                  timestamp: { type: 'string' },
                },
              },
            },
          },
        },
        '503': {
          description: 'Server is still initializing',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', enum: ['not_ready'] },
                  message: { type: 'string' },
                  timestamp: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  };

  // Add models tag
  tags.push({
    name: 'models',
    description: 'Grammar-agnostic CRUD operations for workspace model files',
  });

  // Add models endpoints
  paths['/api/models'] = {
    get: {
      operationId: 'listOrGetModels',
      summary: 'List all workspace models or get a single model',
      description:
        'Without `uri` query param: returns a list of all models in the workspace. ' +
        'With `uri` query param: returns detailed information for a single model including content and AST. ' +
        'Use `language` query param to filter the list by language ID.',
      tags: ['models'],
      parameters: [
        {
          name: 'uri',
          in: 'query',
          required: false,
          description: 'Document URI to fetch a single model detail. If omitted, lists all models.',
          schema: { type: 'string' },
        },
        {
          name: 'language',
          in: 'query',
          required: false,
          description: 'Filter models by language ID (e.g., "ecml"). Only applies to list mode.',
          schema: { type: 'string' },
        },
      ],
      responses: {
        '200': {
          description: 'Model list or single model detail',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', enum: [true] },
                  data: {
                    description: 'Either a list envelope or a ModelDetail object',
                    type: 'object',
                  },
                  correlationId: { type: 'string' },
                },
              },
            },
          },
        },
        '404': {
          description: 'Model not found (when uri is provided)',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', enum: [false] },
                  error: { type: 'string' },
                  correlationId: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    post: {
      operationId: 'createModel',
      summary: 'Create a new model file',
      description:
        'Creates a new model file in the workspace based on the grammar manifest configuration. ' +
        'Content is generated from the root type template if not provided.',
      tags: ['models'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/CreateModelRequest' },
          },
        },
      },
      responses: {
        '201': {
          description: 'Model created successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', enum: [true] },
                  data: { $ref: '#/components/schemas/ModelDetail' },
                  correlationId: { type: 'string' },
                },
              },
            },
          },
        },
        '400': {
          description: 'Bad request (missing fields, invalid name)',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', enum: [false] },
                  error: { type: 'string' },
                  correlationId: { type: 'string' },
                },
              },
            },
          },
        },
        '404': {
          description: 'Language or root type not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', enum: [false] },
                  error: { type: 'string' },
                  correlationId: { type: 'string' },
                },
              },
            },
          },
        },
        '409': {
          description: 'File already exists',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', enum: [false] },
                  error: { type: 'string' },
                  correlationId: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    put: {
      operationId: 'updateModel',
      summary: 'Update model content',
      description: 'Replaces the content of an existing model file and triggers a Langium rebuild.',
      tags: ['models'],
      parameters: [
        {
          name: 'uri',
          in: 'query',
          required: true,
          description: 'Document URI of the model to update',
          schema: { type: 'string' },
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/UpdateModelRequest' },
          },
        },
      },
      responses: {
        '200': {
          description: 'Model updated successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', enum: [true] },
                  data: { $ref: '#/components/schemas/ModelDetail' },
                  correlationId: { type: 'string' },
                },
              },
            },
          },
        },
        '400': {
          description: 'Bad request (missing uri or content)',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', enum: [false] },
                  error: { type: 'string' },
                  correlationId: { type: 'string' },
                },
              },
            },
          },
        },
        '404': {
          description: 'Model not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', enum: [false] },
                  error: { type: 'string' },
                  correlationId: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    delete: {
      operationId: 'deleteModel',
      summary: 'Delete a model file',
      description: 'Removes a model file from the Langium workspace and deletes it from disk.',
      tags: ['models'],
      parameters: [
        {
          name: 'uri',
          in: 'query',
          required: true,
          description: 'Document URI of the model to delete',
          schema: { type: 'string' },
        },
      ],
      responses: {
        '200': {
          description: 'Model deleted successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', enum: [true] },
                  data: {
                    type: 'object',
                    properties: {
                      deleted: { type: 'boolean', enum: [true] },
                      uri: { type: 'string' },
                    },
                  },
                  correlationId: { type: 'string' },
                },
              },
            },
          },
        },
        '400': {
          description: 'Missing uri query parameter',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', enum: [false] },
                  error: { type: 'string' },
                  correlationId: { type: 'string' },
                },
              },
            },
          },
        },
        '404': {
          description: 'Model not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', enum: [false] },
                  error: { type: 'string' },
                  correlationId: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  };

  // Add operations listing endpoint
  paths['/api/v1/operations'] = {
    get: {
      operationId: 'listLanguages',
      summary: 'List all languages with operations',
      description: 'Returns a list of all language IDs that have registered operations.',
      tags: ['operations'],
      responses: {
        '200': {
          description: 'List of languages',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: {
                    type: 'object',
                    properties: {
                      languages: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            languageId: { type: 'string' },
                            operationCount: { type: 'integer' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  // Add operations tag
  tags.push({
    name: 'operations',
    description: 'Operation discovery endpoints',
  });

  // Process each language
  for (const languageId of languageIds) {
    const operations = registry.getOperationsForLanguage(languageId);

    if (operations.length === 0) {
      continue;
    }

    // Add language tag
    tags.push({
      name: languageId,
      description: `${languageId.toUpperCase()} grammar operations`,
    });

    // Add language operations listing endpoint
    const listPath = `/api/v1/${languageId}/operations`;
    paths[listPath] = {
      get: {
        operationId: `list${capitalizeFirst(languageId)}Operations`,
        summary: `List ${languageId} operations`,
        description: `Returns all available operations for the ${languageId} language.`,
        tags: [languageId, 'operations'],
        responses: {
          '200': {
            description: 'List of operations',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        languageId: { type: 'string' },
                        operations: {
                          type: 'array',
                          items: { type: 'object' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '404': {
            description: 'Language not found',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', enum: [false] },
                    error: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    };

    // Add each operation endpoint
    for (const op of operations) {
      const operationPathItem = buildOperationSchema(languageId, op.declaration);
      const fullPath = `/api/v1/${languageId}/operations/${op.declaration.id}`;

      // Merge with existing path item if it exists
      paths[fullPath] = {
        ...paths[fullPath],
        ...operationPathItem,
      };
    }
  }

  // Add parse endpoint documentation
  for (const languageId of languageIds) {
    const parsePath = `/api/v1/${languageId}/parse`;
    paths[parsePath] = {
      post: {
        operationId: `parse${capitalizeFirst(languageId)}`,
        summary: `Parse ${languageId} DSL to JSON AST`,
        description: `Parse ${languageId} source code and return the JSON AST representation.`,
        tags: [languageId],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['content'],
                properties: {
                  content: {
                    type: 'string',
                    description: 'The DSL source code to parse',
                  },
                  fileName: {
                    type: 'string',
                    description: 'Optional file name for error messages',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successfully parsed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', enum: [true] },
                    data: {
                      type: 'object',
                      description: 'The JSON AST',
                    },
                    correlationId: { type: 'string' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Parse error',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', enum: [false] },
                    error: { type: 'string' },
                    correlationId: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    };
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'Sanyam Grammar Operations API',
      version: '1.0.0',
      description:
        'REST API for executing grammar-defined operations. ' +
        'Each grammar can define custom operations that are exposed via this API.',
    },
    servers: [
      {
        url: serverUrl,
        description: 'Local development server',
      },
    ],
    tags,
    paths,
    components: {
      schemas: {
        DocumentReference: {
          type: 'object',
          description: 'Reference to a document for operation execution',
          properties: {
            uri: {
              type: 'string',
              description: 'Document URI (file path or workspace URI)',
            },
            content: {
              type: 'string',
              description: 'Inline document content',
            },
            fileName: {
              type: 'string',
              description: 'File name for inline content',
            },
          },
        },
        OperationResult: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              description: 'Operation-specific result data',
            },
            message: { type: 'string' },
            error: { type: 'string' },
            correlationId: { type: 'string' },
            durationMs: { type: 'number' },
          },
        },
        AsyncJobResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [true] },
            async: { type: 'boolean', enum: [true] },
            jobId: { type: 'string' },
            correlationId: { type: 'string' },
          },
        },
        ModelSummary: {
          type: 'object',
          description: 'Summary of a model in the workspace',
          properties: {
            uri: { type: 'string', description: 'Document URI' },
            languageId: { type: 'string', description: 'Language identifier' },
            displayName: { type: 'string', description: 'File name for display' },
            version: { type: 'integer', description: 'Document version' },
            hasErrors: { type: 'boolean', description: 'Whether the model has parse/validation errors' },
            diagnosticCount: { type: 'integer', description: 'Total number of diagnostics' },
          },
          required: ['uri', 'languageId', 'displayName', 'version', 'hasErrors', 'diagnosticCount'],
        },
        ModelDetail: {
          type: 'object',
          description: 'Detailed model with content and AST',
          properties: {
            uri: { type: 'string', description: 'Document URI' },
            languageId: { type: 'string', description: 'Language identifier' },
            displayName: { type: 'string', description: 'File name for display' },
            version: { type: 'integer', description: 'Document version' },
            hasErrors: { type: 'boolean', description: 'Whether the model has parse/validation errors' },
            diagnosticCount: { type: 'integer', description: 'Total number of diagnostics' },
            content: { type: 'string', description: 'Raw text content of the model' },
            ast: { type: 'object', description: 'Serialized AST (JSON)' },
            diagnostics: {
              type: 'array',
              description: 'Diagnostic messages',
              items: {
                type: 'object',
                properties: {
                  severity: { type: 'integer', description: '1=Error, 2=Warning, 3=Info, 4=Hint' },
                  message: { type: 'string' },
                  range: { type: 'object', description: 'LSP Range' },
                },
              },
            },
          },
          required: ['uri', 'languageId', 'displayName', 'version', 'hasErrors', 'diagnosticCount', 'content', 'ast', 'diagnostics'],
        },
        CreateModelRequest: {
          type: 'object',
          description: 'Request body for creating a new model',
          required: ['languageId', 'name'],
          properties: {
            languageId: { type: 'string', description: 'Target language identifier (e.g., "ecml")' },
            name: { type: 'string', description: 'Model name (used for file name and template substitution)' },
            content: { type: 'string', description: 'Optional content. If omitted, generated from root type template.' },
            rootType: { type: 'string', description: 'Optional root type AST name. Defaults to first rootType in manifest.' },
          },
        },
        UpdateModelRequest: {
          type: 'object',
          description: 'Request body for updating model content',
          required: ['content'],
          properties: {
            content: { type: 'string', description: 'New content for the model file' },
          },
        },
      },
    },
  };
}

/**
 * Build OpenAPI path item for a single operation.
 *
 * @param languageId - The language ID
 * @param op - The operation declaration
 * @returns OpenAPI path item
 */
export function buildOperationSchema(languageId: string, op: GrammarOperation): OpenAPIPathItem {
  const method = op.endpoint.method.toLowerCase() as 'get' | 'post' | 'put' | 'delete';

  // Build tags - include language, category if present
  const operationTags: string[] = [languageId];
  if (op.category) {
    operationTags.push(op.category);
  }

  // Build request body schema
  const requestSchema: JSONSchema = {
    type: 'object',
    properties: {
      document: {
        $ref: '#/components/schemas/DocumentReference',
      },
      uri: {
        type: 'string',
        description: 'Document URI (shorthand)',
      },
      content: {
        type: 'string',
        description: 'Inline content (shorthand)',
      },
      fileName: {
        type: 'string',
        description: 'File name for inline content',
      },
      selectedIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Selected element IDs from diagram or tree',
      },
      input: op.endpoint.requestSchema ?? {
        type: 'object',
        description: 'Operation-specific input parameters',
      },
    },
  };

  // Build response schema
  const responseSchema: JSONSchema = op.endpoint.responseSchema ?? {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      data: { type: 'object' },
      message: { type: 'string' },
      correlationId: { type: 'string' },
      durationMs: { type: 'number' },
    },
  };

  const operation: OpenAPIOperation = {
    operationId: `${languageId}_${op.id.replace(/-/g, '_')}`,
    summary: op.displayName,
    description: op.description,
    tags: operationTags,
    requestBody:
      method === 'get'
        ? undefined
        : {
            required: true,
            description: 'Operation execution request',
            content: {
              'application/json': {
                schema: requestSchema,
              },
            },
          },
    responses: {
      '200': {
        description: 'Operation completed successfully',
        content: {
          'application/json': {
            schema: responseSchema,
          },
        },
      },
      '202': {
        description: 'Async operation accepted',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/AsyncJobResponse',
            },
          },
        },
      },
      '400': {
        description: 'Bad request or operation error',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', enum: [false] },
                error: { type: 'string' },
                correlationId: { type: 'string' },
              },
            },
          },
        },
      },
      '404': {
        description: 'Operation not found',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', enum: [false] },
                error: { type: 'string' },
              },
            },
          },
        },
      },
    },
    // Extension fields
    ...(op.licensing?.tier && { 'x-tier': op.licensing.tier }),
    ...(op.category && { 'x-category': op.category }),
    ...(op.licensing?.requiresAuth && { 'x-requires-auth': true }),
  };

  // Build the GET operation for fetching operation details
  const getDetailsOperation: OpenAPIOperation = {
    operationId: `get_${languageId}_${op.id.replace(/-/g, '_')}`,
    summary: `Get ${op.displayName} details`,
    description: `Returns the operation declaration for ${op.displayName}.`,
    tags: operationTags,
    responses: {
      '200': {
        description: 'Operation details',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                data: {
                  type: 'object',
                  properties: {
                    operation: { type: 'object' },
                  },
                },
              },
            },
          },
        },
      },
      '404': {
        description: 'Operation not found',
      },
    },
  };

  // Build result based on HTTP method
  switch (method) {
    case 'get':
      return { get: operation };
    case 'post':
      // POST operations also have GET for details
      return { get: getDetailsOperation, post: operation };
    case 'put':
      return { get: getDetailsOperation, put: operation };
    case 'delete':
      return { get: getDetailsOperation, delete: operation };
  }
}

/**
 * Capitalize the first letter of a string.
 */
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
