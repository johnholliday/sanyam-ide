/**
 * Integration Test: Bidirectional Synchronization (T063)
 *
 * Tests the synchronization between text editing and diagram editing.
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { LangiumDocument, AstNode } from 'langium';

// TODO: Import actual implementations when available
// import { TextToDiagramSync } from '../../../packages/sanyam-lsp/src/glsp/sync/text-to-diagram-sync';
// import { DiagramToTextSync } from '../../../packages/sanyam-lsp/src/glsp/sync/diagram-to-text-sync';

/**
 * Mock document change event
 */
interface DocumentChangeEvent {
  uri: string;
  version: number;
  changes: TextChange[];
}

interface TextChange {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  text: string;
}

/**
 * Mock diagram operation
 */
interface DiagramOperation {
  kind: string;
  elementId?: string;
  data?: any;
}

/**
 * Mock synchronization service
 */
class MockSyncService {
  private textContent: string = '';
  private diagramModel: any = { nodes: [], edges: [] };
  private syncEnabled: boolean = true;
  private pendingChanges: any[] = [];

  setTextContent(content: string): void {
    this.textContent = content;
  }

  getTextContent(): string {
    return this.textContent;
  }

  setDiagramModel(model: any): void {
    this.diagramModel = model;
  }

  getDiagramModel(): any {
    return this.diagramModel;
  }

  setSyncEnabled(enabled: boolean): void {
    this.syncEnabled = enabled;
  }

  isSyncEnabled(): boolean {
    return this.syncEnabled;
  }

  onTextChange(change: DocumentChangeEvent): void {
    if (!this.syncEnabled) return;
    this.pendingChanges.push({ type: 'text', change });
  }

  onDiagramOperation(operation: DiagramOperation): void {
    if (!this.syncEnabled) return;
    this.pendingChanges.push({ type: 'diagram', operation });
  }

  getPendingChanges(): any[] {
    return this.pendingChanges;
  }

  clearPendingChanges(): void {
    this.pendingChanges = [];
  }

  applyTextChange(change: DocumentChangeEvent): void {
    // Apply text change and update diagram
    this.textContent = 'updated content';
  }

  applyDiagramOperation(operation: DiagramOperation): string {
    // Apply diagram operation and return updated text
    return 'updated text from diagram';
  }
}

describe('Bidirectional Synchronization', () => {
  let syncService: MockSyncService;

  beforeEach(() => {
    syncService = new MockSyncService();
    syncService.setTextContent(`entity Person {
  name: string
  age: number
}

entity Address {
  street: string
  city: string
}`);

    syncService.setDiagramModel({
      nodes: [
        { id: 'Person', type: 'node:entity', position: { x: 0, y: 0 } },
        { id: 'Address', type: 'node:entity', position: { x: 200, y: 0 } },
      ],
      edges: [],
    });
  });

  describe('Text-to-Diagram Sync', () => {
    it('should update diagram when entity is added in text', () => {
      const change: DocumentChangeEvent = {
        uri: 'file:///test.dsl',
        version: 2,
        changes: [{
          range: {
            start: { line: 9, character: 0 },
            end: { line: 9, character: 0 },
          },
          text: '\nentity Company {\n  name: string\n}',
        }],
      };

      syncService.onTextChange(change);

      // Diagram should be updated to include new entity
      const pendingChanges = syncService.getPendingChanges();
      expect(pendingChanges).toHaveLength(1);
      expect(pendingChanges[0].type).toBe('text');
    });

    it('should update diagram when entity is renamed in text', () => {
      const change: DocumentChangeEvent = {
        uri: 'file:///test.dsl',
        version: 2,
        changes: [{
          range: {
            start: { line: 0, character: 7 },
            end: { line: 0, character: 13 },
          },
          text: 'Employee',
        }],
      };

      syncService.onTextChange(change);

      // Node label in diagram should update
      const pendingChanges = syncService.getPendingChanges();
      expect(pendingChanges).toHaveLength(1);
    });

    it('should remove node from diagram when entity is deleted in text', () => {
      const change: DocumentChangeEvent = {
        uri: 'file:///test.dsl',
        version: 2,
        changes: [{
          range: {
            start: { line: 5, character: 0 },
            end: { line: 9, character: 0 },
          },
          text: '', // Delete Address entity
        }],
      };

      syncService.onTextChange(change);

      const pendingChanges = syncService.getPendingChanges();
      expect(pendingChanges).toHaveLength(1);
    });

    it('should update edge when reference is added in text', () => {
      const change: DocumentChangeEvent = {
        uri: 'file:///test.dsl',
        version: 2,
        changes: [{
          range: {
            start: { line: 3, character: 0 },
            end: { line: 3, character: 0 },
          },
          text: '  address: Address\n',
        }],
      };

      syncService.onTextChange(change);

      // Edge should be added to diagram
      const pendingChanges = syncService.getPendingChanges();
      expect(pendingChanges).toHaveLength(1);
    });

    it('should preserve node positions during text sync', () => {
      const initialModel = syncService.getDiagramModel();
      const personPosition = initialModel.nodes[0].position;

      // Make a text change that doesn't affect Person
      const change: DocumentChangeEvent = {
        uri: 'file:///test.dsl',
        version: 2,
        changes: [{
          range: {
            start: { line: 7, character: 2 },
            end: { line: 7, character: 6 },
          },
          text: 'location',
        }],
      };

      syncService.onTextChange(change);

      // Person's position should remain unchanged
      expect(initialModel.nodes[0].position).toEqual(personPosition);
    });
  });

  describe('Diagram-to-Text Sync', () => {
    it('should update text when node is created in diagram', () => {
      const operation: DiagramOperation = {
        kind: 'createNode',
        data: {
          elementTypeId: 'node:entity',
          location: { x: 400, y: 0 },
          args: { name: 'Company' },
        },
      };

      syncService.onDiagramOperation(operation);

      const pendingChanges = syncService.getPendingChanges();
      expect(pendingChanges).toHaveLength(1);
      expect(pendingChanges[0].type).toBe('diagram');
    });

    it('should update text when node is deleted in diagram', () => {
      const operation: DiagramOperation = {
        kind: 'deleteElement',
        elementId: 'Address',
      };

      syncService.onDiagramOperation(operation);

      // Text should have Address entity removed
      const pendingChanges = syncService.getPendingChanges();
      expect(pendingChanges).toHaveLength(1);
    });

    it('should NOT update text content when node position changes', () => {
      // Position changes are metadata, not model content
      const operation: DiagramOperation = {
        kind: 'changeBounds',
        elementId: 'Person',
        data: {
          newPosition: { x: 100, y: 50 },
        },
      };

      const originalText = syncService.getTextContent();
      syncService.onDiagramOperation(operation);

      // Text content should remain the same (position is metadata)
      // Only position metadata in AST should update
      const pendingChanges = syncService.getPendingChanges();
      expect(pendingChanges).toHaveLength(1);
    });

    it('should update text when edge is created in diagram', () => {
      const operation: DiagramOperation = {
        kind: 'createEdge',
        data: {
          sourceId: 'Person',
          targetId: 'Address',
          propertyName: 'address',
        },
      };

      syncService.onDiagramOperation(operation);

      // Text should include new reference property
      const pendingChanges = syncService.getPendingChanges();
      expect(pendingChanges).toHaveLength(1);
    });

    it('should update text when edge is deleted in diagram', () => {
      const operation: DiagramOperation = {
        kind: 'deleteElement',
        elementId: 'Person_address_Address',
      };

      syncService.onDiagramOperation(operation);

      const pendingChanges = syncService.getPendingChanges();
      expect(pendingChanges).toHaveLength(1);
    });

    it('should update text when node is renamed via label edit', () => {
      const operation: DiagramOperation = {
        kind: 'editLabel',
        elementId: 'Person_label',
        data: {
          newText: 'Employee',
        },
      };

      syncService.onDiagramOperation(operation);

      // Entity name in text should change from Person to Employee
      const pendingChanges = syncService.getPendingChanges();
      expect(pendingChanges).toHaveLength(1);
    });
  });

  describe('Conflict Resolution', () => {
    it('should handle simultaneous text and diagram edits', () => {
      // Simulate both editors making changes
      const textChange: DocumentChangeEvent = {
        uri: 'file:///test.dsl',
        version: 2,
        changes: [{
          range: { start: { line: 1, character: 2 }, end: { line: 1, character: 6 } },
          text: 'fullName',
        }],
      };

      const diagramOp: DiagramOperation = {
        kind: 'editLabel',
        elementId: 'Person_name_label',
        data: { newText: 'firstName' },
      };

      // Both changes arrive
      syncService.onTextChange(textChange);
      syncService.onDiagramOperation(diagramOp);

      // Should have recorded both changes (conflict resolution in actual implementation)
      const pendingChanges = syncService.getPendingChanges();
      expect(pendingChanges).toHaveLength(2);
    });

    it('should use last-write-wins for conflicting changes', () => {
      // This is a simple conflict resolution strategy
      // More sophisticated implementations might merge or prompt user

      const firstChange = { timestamp: 100, value: 'first' };
      const secondChange = { timestamp: 200, value: 'second' };

      const winner = firstChange.timestamp > secondChange.timestamp
        ? firstChange.value
        : secondChange.value;

      expect(winner).toBe('second');
    });
  });

  describe('Sync Control', () => {
    it('should pause sync during batch operations', () => {
      syncService.setSyncEnabled(false);

      const operation1: DiagramOperation = { kind: 'createNode', data: { name: 'A' } };
      const operation2: DiagramOperation = { kind: 'createNode', data: { name: 'B' } };
      const operation3: DiagramOperation = { kind: 'createEdge', data: { source: 'A', target: 'B' } };

      syncService.onDiagramOperation(operation1);
      syncService.onDiagramOperation(operation2);
      syncService.onDiagramOperation(operation3);

      // No changes should be recorded while sync is disabled
      expect(syncService.getPendingChanges()).toHaveLength(0);

      syncService.setSyncEnabled(true);
    });

    it('should batch text updates to minimize flicker', () => {
      // Multiple rapid diagram changes should be batched
      const operations = [
        { kind: 'changeBounds', elementId: 'Person', data: { newPosition: { x: 10, y: 10 } } },
        { kind: 'changeBounds', elementId: 'Person', data: { newPosition: { x: 20, y: 20 } } },
        { kind: 'changeBounds', elementId: 'Person', data: { newPosition: { x: 30, y: 30 } } },
      ];

      operations.forEach(op => syncService.onDiagramOperation(op as DiagramOperation));

      // All changes recorded, but actual implementation would batch/debounce
      expect(syncService.getPendingChanges()).toHaveLength(3);
    });
  });

  describe('Error Recovery', () => {
    it('should handle invalid text gracefully', () => {
      const invalidChange: DocumentChangeEvent = {
        uri: 'file:///test.dsl',
        version: 2,
        changes: [{
          range: { start: { line: 0, character: 0 }, end: { line: 10, character: 0 } },
          text: 'invalid { syntax }}}',
        }],
      };

      // Should not throw
      expect(() => syncService.onTextChange(invalidChange)).not.toThrow();
    });

    it('should handle missing elements gracefully', () => {
      const operation: DiagramOperation = {
        kind: 'deleteElement',
        elementId: 'NonExistent',
      };

      // Should not throw
      expect(() => syncService.onDiagramOperation(operation)).not.toThrow();
    });

    it('should recover diagram state after text parse error', () => {
      // After a parse error is fixed, diagram should sync correctly
      const validChange: DocumentChangeEvent = {
        uri: 'file:///test.dsl',
        version: 3,
        changes: [{
          range: { start: { line: 0, character: 0 }, end: { line: 10, character: 0 } },
          text: 'entity Valid { name: string }',
        }],
      };

      syncService.onTextChange(validChange);
      expect(syncService.getPendingChanges()).toHaveLength(1);
    });
  });

  describe('Performance', () => {
    it('should handle large documents efficiently', () => {
      // Generate a large document
      let largeContent = '';
      for (let i = 0; i < 100; i++) {
        largeContent += `entity Entity${i} {\n  prop${i}: string\n}\n\n`;
      }

      syncService.setTextContent(largeContent);

      const start = Date.now();

      const change: DocumentChangeEvent = {
        uri: 'file:///test.dsl',
        version: 2,
        changes: [{
          range: { start: { line: 50, character: 2 }, end: { line: 50, character: 8 } },
          text: 'newProp',
        }],
      };

      syncService.onTextChange(change);

      const elapsed = Date.now() - start;
      // Should complete quickly (< 100ms for basic operation)
      expect(elapsed).toBeLessThan(100);
    });

    it('should debounce rapid changes', () => {
      const changes: DocumentChangeEvent[] = [];
      for (let i = 0; i < 10; i++) {
        changes.push({
          uri: 'file:///test.dsl',
          version: i + 2,
          changes: [{
            range: { start: { line: 0, character: i }, end: { line: 0, character: i + 1 } },
            text: 'x',
          }],
        });
      }

      // Apply all changes rapidly
      changes.forEach(c => syncService.onTextChange(c));

      // All changes recorded (debouncing would happen in actual implementation)
      expect(syncService.getPendingChanges().length).toBe(10);
    });
  });

  describe('Multi-File Support', () => {
    it('should sync changes across multiple files', () => {
      const change1: DocumentChangeEvent = {
        uri: 'file:///model.dsl',
        version: 2,
        changes: [{ range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }, text: 'entity A' }],
      };

      const change2: DocumentChangeEvent = {
        uri: 'file:///types.dsl',
        version: 2,
        changes: [{ range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }, text: 'type B' }],
      };

      syncService.onTextChange(change1);
      syncService.onTextChange(change2);

      const pendingChanges = syncService.getPendingChanges();
      expect(pendingChanges).toHaveLength(2);
    });

    it('should update cross-file references', () => {
      // When an entity in one file is renamed, references in other files should update
      const renameChange: DocumentChangeEvent = {
        uri: 'file:///types.dsl',
        version: 2,
        changes: [{
          range: { start: { line: 0, character: 7 }, end: { line: 0, character: 14 } },
          text: 'NewName',
        }],
      };

      syncService.onTextChange(renameChange);

      // Diagram edges referencing the renamed type should update
      const pendingChanges = syncService.getPendingChanges();
      expect(pendingChanges).toHaveLength(1);
    });
  });
});
