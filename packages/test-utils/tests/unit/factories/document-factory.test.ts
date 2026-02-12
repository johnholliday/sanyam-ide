/**
 * Unit tests for document factory functions
 */

import { describe, it, expect } from 'vitest';
import {
  buildCreateDocumentRequest,
  buildDocument,
} from '../../../src/factories/document-factory.js';

describe('buildCreateDocumentRequest', () => {
  it('should create request with defaults', () => {
    const request = buildCreateDocumentRequest();

    expect(request.name).toBe('Test Document');
    expect(request.languageId).toBe('sanyam');
    expect(request.content).toContain('Test document content');
  });

  it('should allow overriding name', () => {
    const request = buildCreateDocumentRequest({ name: 'Custom Name' });

    expect(request.name).toBe('Custom Name');
    expect(request.languageId).toBe('sanyam');
  });

  it('should allow overriding languageId', () => {
    const request = buildCreateDocumentRequest({ languageId: 'json' });

    expect(request.languageId).toBe('json');
  });

  it('should allow overriding content', () => {
    const request = buildCreateDocumentRequest({ content: 'Custom content' });

    expect(request.content).toBe('Custom content');
  });

  it('should allow overriding all fields', () => {
    const request = buildCreateDocumentRequest({
      name: 'My Doc',
      languageId: 'xml',
      content: '<root/>',
    });

    expect(request.name).toBe('My Doc');
    expect(request.languageId).toBe('xml');
    expect(request.content).toBe('<root/>');
  });
});

describe('buildDocument', () => {
  it('should create document with defaults', () => {
    const doc = buildDocument();

    expect(doc.id).toBeDefined();
    expect(doc.user_id).toBeDefined();
    expect(doc.name).toBe('Test Document');
    expect(doc.language_id).toBe('sanyam');
    expect(doc.content).toContain('Test document content');
    expect(doc.version).toBe(1);
    expect(doc.created_at).toBeDefined();
    expect(doc.updated_at).toBeDefined();
    expect(doc.deleted_at).toBeNull();
  });

  it('should generate unique IDs', () => {
    const doc1 = buildDocument();
    const doc2 = buildDocument();

    expect(doc1.id).not.toBe(doc2.id);
    expect(doc1.user_id).not.toBe(doc2.user_id);
  });

  it('should allow overriding id', () => {
    const doc = buildDocument({ id: 'custom-id' });

    expect(doc.id).toBe('custom-id');
  });

  it('should allow overriding user_id', () => {
    const doc = buildDocument({ user_id: 'specific-user' });

    expect(doc.user_id).toBe('specific-user');
  });

  it('should allow overriding version', () => {
    const doc = buildDocument({ version: 5 });

    expect(doc.version).toBe(5);
  });

  it('should allow setting deleted_at', () => {
    const deletedAt = new Date().toISOString();
    const doc = buildDocument({ deleted_at: deletedAt });

    expect(doc.deleted_at).toBe(deletedAt);
  });

  it('should allow overriding timestamps', () => {
    const createdAt = '2024-01-01T00:00:00Z';
    const updatedAt = '2024-01-02T00:00:00Z';
    const doc = buildDocument({ created_at: createdAt, updated_at: updatedAt });

    expect(doc.created_at).toBe(createdAt);
    expect(doc.updated_at).toBe(updatedAt);
  });

  it('should set timestamps to current time by default', () => {
    const before = new Date().toISOString();
    const doc = buildDocument();
    const after = new Date().toISOString();

    // Timestamps should be between before and after
    expect(doc.created_at >= before).toBe(true);
    expect(doc.created_at <= after).toBe(true);
    expect(doc.updated_at >= before).toBe(true);
    expect(doc.updated_at <= after).toBe(true);
  });
});
