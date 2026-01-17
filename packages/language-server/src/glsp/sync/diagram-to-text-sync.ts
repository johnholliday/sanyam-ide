/**
 * Diagram to Text Synchronization (T088)
 *
 * Handles synchronization from diagram operations to text documents.
 * Operation handlers serialize AST changes back to text edits.
 *
 * @packageDocumentation
 */

import type { LangiumDocument } from 'langium';
import type { TextEdit, Range, Position } from 'vscode-languageserver';
import { Emitter, Event, Disposable } from 'vscode-languageserver';
import { DisposableCollection } from '../../utils/disposable.js';

/**
 * Operation result with text edits.
 */
export interface OperationWithEdits {
  /** Operation kind */
  kind: string;
  /** Whether operation succeeded */
  success: boolean;
  /** Text edits to apply */
  textEdits?: TextEdit[];
  /** Error message if failed */
  error?: string;
}

/**
 * Text edit event.
 */
export interface TextEditEvent {
  /** Document URI */
  uri: string;
  /** Text edits to apply */
  edits: TextEdit[];
  /** Operation that triggered the edit */
  operationKind: string;
  /** Timestamp */
  timestamp: number;
}

/**
 * Sync conflict event.
 */
export interface SyncConflictEvent {
  /** Document URI */
  uri: string;
  /** Expected version */
  expectedVersion: number;
  /** Actual version */
  actualVersion: number;
  /** Operation that caused the conflict */
  operationKind: string;
}

/**
 * Diagram to text sync options.
 */
export interface DiagramToTextSyncOptions {
  /** Whether to batch edits (default: true) */
  batchEdits?: boolean;
  /** Batch timeout in ms (default: 50) */
  batchTimeout?: number;
  /** Whether to validate edits before applying (default: true) */
  validateEdits?: boolean;
}

/**
 * Diagram to text synchronization handler.
 *
 * Converts diagram operations to text edits and applies them
 * to the underlying document.
 */
export class DiagramToTextSync implements Disposable {
  private readonly toDispose = new DisposableCollection();
  private readonly documentVersions: Map<string, number> = new Map();
  private readonly pendingEdits: Map<string, PendingEditBatch> = new Map();

  private readonly options: Required<DiagramToTextSyncOptions>;

  // Event emitters
  private readonly onTextEditsAppliedEmitter = new Emitter<TextEditEvent>();
  private readonly onSyncConflictEmitter = new Emitter<SyncConflictEvent>();
  private readonly onEditFailedEmitter = new Emitter<{ uri: string; error: string }>();

  // Event accessors
  readonly onTextEditsApplied: Event<TextEditEvent> = this.onTextEditsAppliedEmitter.event;
  readonly onSyncConflict: Event<SyncConflictEvent> = this.onSyncConflictEmitter.event;
  readonly onEditFailed: Event<{ uri: string; error: string }> = this.onEditFailedEmitter.event;

  constructor(
    private readonly editApplier: TextEditApplier,
    options?: DiagramToTextSyncOptions
  ) {
    this.options = {
      batchEdits: options?.batchEdits ?? true,
      batchTimeout: options?.batchTimeout ?? 50,
      validateEdits: options?.validateEdits ?? true,
    };

    this.toDispose.push(this.onTextEditsAppliedEmitter);
    this.toDispose.push(this.onSyncConflictEmitter);
    this.toDispose.push(this.onEditFailedEmitter);
  }

  /**
   * Handle operation result with text edits.
   *
   * Queues or applies text edits from diagram operations.
   */
  async handleOperationResult(
    uri: string,
    operationResult: OperationWithEdits
  ): Promise<boolean> {
    if (!operationResult.success || !operationResult.textEdits?.length) {
      return operationResult.success;
    }

    if (this.options.batchEdits) {
      return this.queueEdits(uri, operationResult);
    } else {
      return this.applyEditsImmediately(uri, operationResult);
    }
  }

  /**
   * Queue edits for batching.
   */
  private queueEdits(uri: string, operationResult: OperationWithEdits): boolean {
    let batch = this.pendingEdits.get(uri);
    if (!batch) {
      batch = {
        uri,
        edits: [],
        operations: [],
        timeout: null,
      };
      this.pendingEdits.set(uri, batch);
    }

    // Add edits to batch
    batch.edits.push(...(operationResult.textEdits ?? []));
    batch.operations.push(operationResult.kind);

    // Schedule flush
    if (batch.timeout) {
      clearTimeout(batch.timeout);
    }
    batch.timeout = setTimeout(() => {
      this.flushBatch(uri);
    }, this.options.batchTimeout);

    return true;
  }

  /**
   * Flush pending edit batch.
   */
  private async flushBatch(uri: string): Promise<boolean> {
    const batch = this.pendingEdits.get(uri);
    if (!batch || batch.edits.length === 0) {
      return true;
    }

    this.pendingEdits.delete(uri);

    try {
      // Merge overlapping edits
      const mergedEdits = this.mergeEdits(batch.edits);

      // Apply edits
      const success = await this.editApplier.applyEdits(uri, mergedEdits);

      if (success) {
        this.onTextEditsAppliedEmitter.fire({
          uri,
          edits: mergedEdits,
          operationKind: batch.operations.join(', '),
          timestamp: Date.now(),
        });
      }

      return success;
    } catch (error) {
      this.onEditFailedEmitter.fire({
        uri,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Apply edits immediately (no batching).
   */
  private async applyEditsImmediately(
    uri: string,
    operationResult: OperationWithEdits
  ): Promise<boolean> {
    try {
      // Validate edits
      if (this.options.validateEdits) {
        const validation = this.validateEdits(operationResult.textEdits ?? []);
        if (!validation.valid) {
          this.onEditFailedEmitter.fire({
            uri,
            error: validation.error ?? 'Invalid edits',
          });
          return false;
        }
      }

      // Apply edits
      const success = await this.editApplier.applyEdits(
        uri,
        operationResult.textEdits ?? []
      );

      if (success) {
        this.onTextEditsAppliedEmitter.fire({
          uri,
          edits: operationResult.textEdits ?? [],
          operationKind: operationResult.kind,
          timestamp: Date.now(),
        });
      }

      return success;
    } catch (error) {
      this.onEditFailedEmitter.fire({
        uri,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Validate text edits.
   */
  private validateEdits(edits: TextEdit[]): { valid: boolean; error?: string } {
    for (const edit of edits) {
      // Validate range
      if (!this.isValidRange(edit.range)) {
        return { valid: false, error: 'Invalid edit range' };
      }

      // Check for negative positions
      if (
        edit.range.start.line < 0 ||
        edit.range.start.character < 0 ||
        edit.range.end.line < 0 ||
        edit.range.end.character < 0
      ) {
        return { valid: false, error: 'Edit range has negative position' };
      }

      // Check range order
      if (
        edit.range.start.line > edit.range.end.line ||
        (edit.range.start.line === edit.range.end.line &&
          edit.range.start.character > edit.range.end.character)
      ) {
        return { valid: false, error: 'Edit range is inverted' };
      }
    }

    return { valid: true };
  }

  /**
   * Check if a range is valid.
   */
  private isValidRange(range: Range): boolean {
    return (
      range &&
      typeof range.start?.line === 'number' &&
      typeof range.start?.character === 'number' &&
      typeof range.end?.line === 'number' &&
      typeof range.end?.character === 'number'
    );
  }

  /**
   * Merge overlapping edits.
   *
   * Sorts edits by position and merges overlapping ones.
   */
  private mergeEdits(edits: TextEdit[]): TextEdit[] {
    if (edits.length <= 1) {
      return edits;
    }

    // Sort by start position (descending to apply from end to start)
    const sorted = [...edits].sort((a, b) => {
      const lineDiff = b.range.start.line - a.range.start.line;
      if (lineDiff !== 0) return lineDiff;
      return b.range.start.character - a.range.start.character;
    });

    const merged: TextEdit[] = [];
    let current: TextEdit | undefined = sorted[0];

    if (!current) {
      return merged;
    }

    for (let i = 1; i < sorted.length; i++) {
      const next = sorted[i];
      if (!next) continue;

      // Check if edits overlap
      if (this.editsOverlap(current, next)) {
        // Merge edits
        current = this.mergeOverlappingEdits(current, next);
      } else {
        merged.push(current);
        current = next;
      }
    }

    merged.push(current);
    return merged;
  }

  /**
   * Check if two edits overlap.
   */
  private editsOverlap(a: TextEdit, b: TextEdit): boolean {
    // Edit ranges overlap if one starts before the other ends
    return !(
      this.positionBefore(a.range.end, b.range.start) ||
      this.positionBefore(b.range.end, a.range.start)
    );
  }

  /**
   * Check if position a is before position b.
   */
  private positionBefore(a: Position, b: Position): boolean {
    return a.line < b.line || (a.line === b.line && a.character < b.character);
  }

  /**
   * Merge two overlapping edits.
   */
  private mergeOverlappingEdits(a: TextEdit, b: TextEdit): TextEdit {
    // Use the wider range
    const start = this.positionBefore(a.range.start, b.range.start)
      ? a.range.start
      : b.range.start;
    const end = this.positionBefore(a.range.end, b.range.end)
      ? b.range.end
      : a.range.end;

    // Concatenate the new texts (this is a simplification - real merging would be more complex)
    const newText = b.newText + a.newText;

    return {
      range: { start, end },
      newText,
    };
  }

  /**
   * Set document version.
   */
  setDocumentVersion(uri: string, version: number): void {
    this.documentVersions.set(uri, version);
  }

  /**
   * Get document version.
   */
  getDocumentVersion(uri: string): number | undefined {
    return this.documentVersions.get(uri);
  }

  /**
   * Check for version conflict.
   */
  checkVersionConflict(uri: string, expectedVersion: number): boolean {
    const actualVersion = this.documentVersions.get(uri);
    if (actualVersion !== undefined && actualVersion !== expectedVersion) {
      this.onSyncConflictEmitter.fire({
        uri,
        expectedVersion,
        actualVersion,
        operationKind: 'unknown',
      });
      return true;
    }
    return false;
  }

  /**
   * Force flush all pending edits.
   */
  async flushAllPending(): Promise<void> {
    const uris = Array.from(this.pendingEdits.keys());
    for (const uri of uris) {
      await this.flushBatch(uri);
    }
  }

  /**
   * Clear pending edits for a document.
   */
  clearPendingEdits(uri: string): void {
    const batch = this.pendingEdits.get(uri);
    if (batch?.timeout) {
      clearTimeout(batch.timeout);
    }
    this.pendingEdits.delete(uri);
  }

  /**
   * Dispose resources.
   */
  dispose(): void {
    // Clear all pending batches
    for (const batch of this.pendingEdits.values()) {
      if (batch.timeout) {
        clearTimeout(batch.timeout);
      }
    }
    this.pendingEdits.clear();
    this.documentVersions.clear();
    this.toDispose.dispose();
  }
}

/**
 * Pending edit batch.
 */
interface PendingEditBatch {
  uri: string;
  edits: TextEdit[];
  operations: string[];
  timeout: NodeJS.Timeout | null;
}

/**
 * Text edit applier interface.
 */
export interface TextEditApplier {
  applyEdits(uri: string, edits: TextEdit[]): Promise<boolean>;
}

/**
 * Create a diagram-to-text sync instance.
 *
 * @param applier - Text edit applier
 * @param options - Sync options
 * @returns DiagramToTextSync instance
 */
export function createDiagramToTextSync(
  applier: TextEditApplier,
  options?: DiagramToTextSyncOptions
): DiagramToTextSync {
  return new DiagramToTextSync(applier, options);
}

/**
 * Create a default text edit applier using the language server connection.
 *
 * @param connection - LSP connection
 * @returns TextEditApplier
 */
export function createConnectionTextEditApplier(connection: any): TextEditApplier {
  return {
    async applyEdits(uri: string, edits: TextEdit[]): Promise<boolean> {
      try {
        // Apply workspace edit through the connection
        const result = await connection.workspace.applyEdit({
          changes: {
            [uri]: edits,
          },
        });
        return result.applied;
      } catch (error) {
        console.error('Failed to apply edits:', error);
        return false;
      }
    },
  };
}

/**
 * Create a text edit applier that works directly with documents.
 *
 * @param getDocument - Function to get a document by URI
 * @returns TextEditApplier
 */
export function createDocumentTextEditApplier(
  getDocument: (uri: string) => { getText(): string; version: number } | undefined,
  setDocument: (uri: string, text: string, version: number) => void
): TextEditApplier {
  return {
    async applyEdits(uri: string, edits: TextEdit[]): Promise<boolean> {
      const document = getDocument(uri);
      if (!document) {
        return false;
      }

      try {
        // Sort edits from end to start to avoid position shifts
        const sortedEdits = [...edits].sort((a, b) => {
          const lineDiff = b.range.start.line - a.range.start.line;
          if (lineDiff !== 0) return lineDiff;
          return b.range.start.character - a.range.start.character;
        });

        // Apply edits
        let text = document.getText();
        const lines = text.split('\n');

        for (const edit of sortedEdits) {
          // Convert range to offsets
          const startOffset = getOffset(lines, edit.range.start);
          const endOffset = getOffset(lines, edit.range.end);

          // Apply edit
          text = text.substring(0, startOffset) + edit.newText + text.substring(endOffset);
        }

        // Update document
        setDocument(uri, text, document.version + 1);
        return true;
      } catch (error) {
        console.error('Failed to apply edits:', error);
        return false;
      }
    },
  };
}

/**
 * Get offset in text from position.
 */
function getOffset(lines: string[], position: Position): number {
  let offset = 0;
  for (let i = 0; i < position.line && i < lines.length; i++) {
    const line = lines[i];
    if (line !== undefined) {
      offset += line.length + 1; // +1 for newline
    }
  }
  if (position.line < lines.length) {
    const line = lines[position.line];
    if (line !== undefined) {
      offset += Math.min(position.character, line.length);
    }
  }
  return offset;
}
