/**
 * Unit tests for Sanyam URI Scheme
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SanyamUriSchemeImpl,
  createSanyamUriScheme,
  type DocumentStoreForUri,
  type ParsedSanyamUri,
} from '../../src/sanyam-uri-scheme.js';

const TEST_UUID = '12345678-1234-1234-1234-123456789abc';

function createMockDocumentStore(): DocumentStoreForUri {
  return {
    getDocument: vi.fn().mockResolvedValue({
      success: true,
      data: { content: 'document content' },
    }),
    getVersion: vi.fn().mockResolvedValue({
      success: true,
      data: { content: 'version content' },
    }),
  };
}

describe('SanyamUriScheme', () => {
  let uriScheme: SanyamUriSchemeImpl;
  let mockStore: DocumentStoreForUri;

  beforeEach(() => {
    mockStore = createMockDocumentStore();
    uriScheme = createSanyamUriScheme(mockStore) as SanyamUriSchemeImpl;
  });

  describe('isSanyamUri', () => {
    it('should return true for valid sanyam:// URIs', () => {
      expect(uriScheme.isSanyamUri('sanyam://documents/123')).toBe(true);
    });

    it('should return false for file:// URIs', () => {
      expect(uriScheme.isSanyamUri('file:///path/to/file')).toBe(false);
    });

    it('should return false for http:// URIs', () => {
      expect(uriScheme.isSanyamUri('http://example.com')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(uriScheme.isSanyamUri('')).toBe(false);
    });

    it('should be case-insensitive for scheme', () => {
      expect(uriScheme.isSanyamUri('sanyam://documents/123')).toBe(true);
    });
  });

  describe('parseUri', () => {
    it('should parse basic document URI', () => {
      const uri = `sanyam://documents/${TEST_UUID}`;
      const parsed = uriScheme.parseUri(uri);

      expect(parsed).not.toBeNull();
      expect(parsed?.documentId).toBe(TEST_UUID);
      expect(parsed?.versionNumber).toBeUndefined();
      expect(parsed?.isAsset).toBe(false);
    });

    it('should parse document URI with version', () => {
      const uri = `sanyam://documents/${TEST_UUID}/versions/5`;
      const parsed = uriScheme.parseUri(uri);

      expect(parsed).not.toBeNull();
      expect(parsed?.documentId).toBe(TEST_UUID);
      expect(parsed?.versionNumber).toBe(5);
      expect(parsed?.isAsset).toBe(false);
    });

    it('should parse asset URI', () => {
      const uri = `sanyam://documents/${TEST_UUID}/assets/images/logo.png`;
      const parsed = uriScheme.parseUri(uri);

      expect(parsed).not.toBeNull();
      expect(parsed?.documentId).toBe(TEST_UUID);
      expect(parsed?.assetPath).toBe('images/logo.png');
      expect(parsed?.isAsset).toBe(true);
    });

    it('should return null for non-sanyam URI', () => {
      const parsed = uriScheme.parseUri('file:///path/to/file');

      expect(parsed).toBeNull();
    });

    it('should return null for invalid document ID format', () => {
      const parsed = uriScheme.parseUri('sanyam://documents/invalid-id');

      expect(parsed).toBeNull();
    });

    it('should return null for missing document ID', () => {
      const parsed = uriScheme.parseUri('sanyam://documents/');

      expect(parsed).toBeNull();
    });

    it('should handle uppercase UUID', () => {
      const uri = `sanyam://documents/${TEST_UUID.toUpperCase()}`;
      const parsed = uriScheme.parseUri(uri);

      expect(parsed).not.toBeNull();
      expect(parsed?.documentId.toLowerCase()).toBe(TEST_UUID.toLowerCase());
    });

    it('should parse version number correctly', () => {
      const uri = `sanyam://documents/${TEST_UUID}/versions/123`;
      const parsed = uriScheme.parseUri(uri);

      expect(parsed?.versionNumber).toBe(123);
    });
  });

  describe('buildUri', () => {
    it('should build basic document URI', () => {
      const uri = uriScheme.buildUri(TEST_UUID);

      expect(uri).toBe(`sanyam://documents/${TEST_UUID}`);
    });

    it('should build document URI with version', () => {
      const uri = uriScheme.buildUri(TEST_UUID, 3);

      expect(uri).toBe(`sanyam://documents/${TEST_UUID}/versions/3`);
    });

    it('should not include version when undefined', () => {
      const uri = uriScheme.buildUri(TEST_UUID, undefined);

      expect(uri).toBe(`sanyam://documents/${TEST_UUID}`);
      expect(uri).not.toContain('versions');
    });
  });

  describe('buildAssetUri', () => {
    it('should build asset URI', () => {
      const uri = uriScheme.buildAssetUri(TEST_UUID, 'images/logo.png');

      expect(uri).toBe(`sanyam://documents/${TEST_UUID}/assets/images/logo.png`);
    });

    it('should normalize leading slashes in asset path', () => {
      const uri = uriScheme.buildAssetUri(TEST_UUID, '//path/to/asset');

      expect(uri).toBe(`sanyam://documents/${TEST_UUID}/assets/path/to/asset`);
    });

    it('should handle simple asset name', () => {
      const uri = uriScheme.buildAssetUri(TEST_UUID, 'file.txt');

      expect(uri).toBe(`sanyam://documents/${TEST_UUID}/assets/file.txt`);
    });
  });

  describe('resolve', () => {
    it('should resolve document URI', async () => {
      const uri = `sanyam://documents/${TEST_UUID}`;
      const result = await uriScheme.resolve(uri, 'test-token');

      expect(result.success).toBe(true);
      expect(result.content).toBe('document content');
      expect(result.mimeType).toBe('text/plain');
      expect(mockStore.getDocument).toHaveBeenCalledWith('test-token', TEST_UUID);
    });

    it('should resolve version URI', async () => {
      const uri = `sanyam://documents/${TEST_UUID}/versions/5`;
      const result = await uriScheme.resolve(uri, 'test-token');

      expect(result.success).toBe(true);
      expect(result.content).toBe('version content');
      expect(mockStore.getVersion).toHaveBeenCalledWith('test-token', TEST_UUID, 5);
    });

    it('should return error for invalid URI', async () => {
      const result = await uriScheme.resolve('invalid://uri', 'test-token');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_URI');
    });

    it('should return error for asset URIs (not yet supported)', async () => {
      const uri = `sanyam://documents/${TEST_UUID}/assets/file.txt`;
      const result = await uriScheme.resolve(uri, 'test-token');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('FEATURE_NOT_AVAILABLE');
      expect(result.error?.message).toContain('Asset storage');
    });

    it('should propagate document store errors', async () => {
      (mockStore.getDocument as any).mockResolvedValue({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Document not found' },
      });

      const uri = `sanyam://documents/${TEST_UUID}`;
      const result = await uriScheme.resolve(uri, 'test-token');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('should propagate version store errors', async () => {
      (mockStore.getVersion as any).mockResolvedValue({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Version not found' },
      });

      const uri = `sanyam://documents/${TEST_UUID}/versions/999`;
      const result = await uriScheme.resolve(uri, 'test-token');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });
  });
});

describe('createSanyamUriScheme', () => {
  it('should create a functional instance', () => {
    const mockStore = createMockDocumentStore();
    const scheme = createSanyamUriScheme(mockStore);

    expect(scheme).toBeDefined();
    expect(scheme.isSanyamUri('sanyam://documents/123')).toBe(true);
  });
});
