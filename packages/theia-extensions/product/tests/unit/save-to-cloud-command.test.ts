/**
 * Unit tests for SaveToCloudCommand
 *
 * Tests the save to cloud command with Theia mock services.
 * FR-173-178
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Container } from 'inversify';

// Mock Theia modules before importing the actual class
vi.mock('@theia/core/shared/inversify', () => ({
  injectable: () => (target: any) => target,
  inject: () => () => {},
  optional: () => () => {},
  postConstruct: () => () => {},
}));

vi.mock('@theia/core/lib/common', () => ({
  CommandContribution: Symbol('CommandContribution'),
  CommandRegistry: class {
    registerCommand = vi.fn();
  },
  Command: {},
  MenuContribution: Symbol('MenuContribution'),
  MenuModelRegistry: class {
    registerMenuAction = vi.fn();
  },
}));

vi.mock('@theia/core', () => ({
  MessageService: Symbol('MessageService'),
  nls: {
    localize: (key: string, defaultValue: string) => defaultValue,
  },
}));

vi.mock('@theia/editor/lib/browser', () => ({
  EditorManager: Symbol('EditorManager'),
  EditorWidget: class {},
}));

vi.mock('@theia/monaco/lib/browser/monaco-editor', () => ({
  MonacoEditor: class {},
}));

vi.mock('@theia/workspace/lib/browser', () => ({
  WorkspaceService: Symbol('WorkspaceService'),
}));

vi.mock('@sanyam/supabase-auth', () => ({
  SupabaseAuthProvider: Symbol('SupabaseAuthProvider'),
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import after mocks are set up
import {
  SaveToCloudCommand,
  SAVE_TO_CLOUD_COMMAND,
} from '../../src/browser/cloud/save-to-cloud-command.js';

// Create mock factories
function createMockAuthProvider(overrides: Partial<{
  isConfigured: boolean;
  isAuthenticated: boolean;
  getAccessToken: () => Promise<string | null>;
}> = {}) {
  return {
    isConfigured: overrides.isConfigured ?? true,
    isAuthenticated: overrides.isAuthenticated ?? true,
    getAccessToken: overrides.getAccessToken ?? (async () => 'mock-token'),
  };
}

function createMockEditorManager(hasEditor = true, content = 'test content') {
  if (!hasEditor) {
    return { currentEditor: undefined };
  }

  return {
    currentEditor: {
      editor: {
        uri: { toString: () => 'file:///test/document.txt' },
        getControl: () => ({
          getValue: () => content,
          getModel: () => ({ getLanguageId: () => 'plaintext' }),
        }),
      },
    },
  };
}

function createMockMessageService() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe('SaveToCloudCommand', () => {
  let command: SaveToCloudCommand;
  let mockAuthProvider: ReturnType<typeof createMockAuthProvider>;
  let mockEditorManager: ReturnType<typeof createMockEditorManager>;
  let mockMessageService: ReturnType<typeof createMockMessageService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();

    command = new SaveToCloudCommand();
    mockAuthProvider = createMockAuthProvider();
    mockEditorManager = createMockEditorManager();
    mockMessageService = createMockMessageService();

    // Inject dependencies manually
    (command as any).authProvider = mockAuthProvider;
    (command as any).editorManager = mockEditorManager;
    (command as any).messageService = mockMessageService;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('SAVE_TO_CLOUD_COMMAND', () => {
    it('should have correct command ID', () => {
      expect(SAVE_TO_CLOUD_COMMAND.id).toBe('sanyam.cloud.saveToCloud');
    });

    it('should have correct label', () => {
      expect(SAVE_TO_CLOUD_COMMAND.label).toBe('Sanyam: Save to Cloud');
    });

    it('should have correct category', () => {
      expect(SAVE_TO_CLOUD_COMMAND.category).toBe('Sanyam Cloud');
    });
  });

  describe('registerCommands', () => {
    it('should register command with registry', () => {
      const mockRegistry = {
        registerCommand: vi.fn(),
      };

      command.registerCommands(mockRegistry as any);

      expect(mockRegistry.registerCommand).toHaveBeenCalledWith(
        SAVE_TO_CLOUD_COMMAND,
        expect.objectContaining({
          execute: expect.any(Function),
          isEnabled: expect.any(Function),
          isVisible: expect.any(Function),
        })
      );
    });
  });

  describe('registerMenus', () => {
    it('should register menu action', () => {
      const mockMenus = {
        registerMenuAction: vi.fn(),
      };

      command.registerMenus(mockMenus as any);

      expect(mockMenus.registerMenuAction).toHaveBeenCalledWith(
        ['menubar', 'file', 'save'],
        expect.objectContaining({
          commandId: SAVE_TO_CLOUD_COMMAND.id,
        })
      );
    });
  });

  describe('isEnabled (canSaveToCloud)', () => {
    it('should return false when not authenticated', () => {
      mockAuthProvider.isAuthenticated = false;
      (command as any).authProvider = mockAuthProvider;

      const mockRegistry = { registerCommand: vi.fn() };
      command.registerCommands(mockRegistry as any);

      const { isEnabled } = mockRegistry.registerCommand.mock.calls[0][1];
      expect(isEnabled()).toBe(false);
    });

    it('should return false when no editor is open', () => {
      (command as any).editorManager = { currentEditor: undefined };

      const mockRegistry = { registerCommand: vi.fn() };
      command.registerCommands(mockRegistry as any);

      const { isEnabled } = mockRegistry.registerCommand.mock.calls[0][1];
      expect(isEnabled()).toBe(false);
    });

    it('should return true when authenticated and editor is open', () => {
      const mockRegistry = { registerCommand: vi.fn() };
      command.registerCommands(mockRegistry as any);

      const { isEnabled } = mockRegistry.registerCommand.mock.calls[0][1];
      expect(isEnabled()).toBe(true);
    });
  });

  describe('isVisible', () => {
    it('should return true when auth provider is configured', () => {
      const mockRegistry = { registerCommand: vi.fn() };
      command.registerCommands(mockRegistry as any);

      const { isVisible } = mockRegistry.registerCommand.mock.calls[0][1];
      expect(isVisible()).toBe(true);
    });

    it('should return false when auth provider is not configured', () => {
      mockAuthProvider.isConfigured = false;
      (command as any).authProvider = mockAuthProvider;

      const mockRegistry = { registerCommand: vi.fn() };
      command.registerCommands(mockRegistry as any);

      const { isVisible } = mockRegistry.registerCommand.mock.calls[0][1];
      expect(isVisible()).toBe(false);
    });
  });

  describe('execute (saveToCloud)', () => {
    it('should warn when not authenticated', async () => {
      mockAuthProvider.isAuthenticated = false;
      (command as any).authProvider = mockAuthProvider;

      const mockRegistry = { registerCommand: vi.fn() };
      command.registerCommands(mockRegistry as any);

      const { execute } = mockRegistry.registerCommand.mock.calls[0][1];
      await execute();

      expect(mockMessageService.warn).toHaveBeenCalledWith('Please sign in to save to cloud');
    });

    it('should warn when no active editor', async () => {
      (command as any).editorManager = { currentEditor: undefined };

      const mockRegistry = { registerCommand: vi.fn() };
      command.registerCommands(mockRegistry as any);

      const { execute } = mockRegistry.registerCommand.mock.calls[0][1];
      await execute();

      expect(mockMessageService.warn).toHaveBeenCalledWith('No active editor');
    });

    it('should error when access token is not available', async () => {
      mockAuthProvider.getAccessToken = async () => null;
      (command as any).authProvider = mockAuthProvider;

      const mockRegistry = { registerCommand: vi.fn() };
      command.registerCommands(mockRegistry as any);

      const { execute } = mockRegistry.registerCommand.mock.calls[0][1];
      await execute();

      expect(mockMessageService.error).toHaveBeenCalledWith('Failed to get access token');
    });

    it('should call API with correct parameters on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: 'document.txt', id: 'doc-123' }),
      });

      const mockRegistry = { registerCommand: vi.fn() };
      command.registerCommands(mockRegistry as any);

      const { execute } = mockRegistry.registerCommand.mock.calls[0][1];
      await execute();

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token',
        },
        body: expect.stringContaining('"name":"document.txt"'),
      });
    });

    it('should show success message on successful save', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: 'My Document', id: 'doc-123' }),
      });

      const mockRegistry = { registerCommand: vi.fn() };
      command.registerCommands(mockRegistry as any);

      const { execute } = mockRegistry.registerCommand.mock.calls[0][1];
      await execute();

      expect(mockMessageService.info).toHaveBeenCalledWith(
        'Document saved to cloud: My Document'
      );
    });

    it('should show tier limit error message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: {
            code: 'TIER_LIMIT_EXCEEDED',
            message: 'Document limit reached',
          },
        }),
      });

      const mockRegistry = { registerCommand: vi.fn() };
      command.registerCommands(mockRegistry as any);

      const { execute } = mockRegistry.registerCommand.mock.calls[0][1];
      await execute();

      expect(mockMessageService.error).toHaveBeenCalledWith(
        expect.stringContaining('Document limit reached')
      );
      expect(mockMessageService.error).toHaveBeenCalledWith(
        expect.stringContaining('upgrading your subscription')
      );
    });

    it('should handle generic API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Server error',
          },
        }),
      });

      const mockRegistry = { registerCommand: vi.fn() };
      command.registerCommands(mockRegistry as any);

      const { execute } = mockRegistry.registerCommand.mock.calls[0][1];
      await execute();

      expect(mockMessageService.error).toHaveBeenCalledWith(
        'Failed to save to cloud: Server error'
      );
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const mockRegistry = { registerCommand: vi.fn() };
      command.registerCommands(mockRegistry as any);

      const { execute } = mockRegistry.registerCommand.mock.calls[0][1];
      await execute();

      expect(mockMessageService.error).toHaveBeenCalledWith(
        expect.stringContaining('Network error')
      );
    });
  });

  describe('getDocumentName', () => {
    it('should extract filename from URI', async () => {
      // Test the private method via command execution
      const mockRegistry = { registerCommand: vi.fn() };

      // Create editor with specific URI
      (command as any).editorManager = {
        currentEditor: {
          editor: {
            uri: { toString: () => 'file:///path/to/my-document.txt' },
            getControl: () => ({
              getValue: () => 'content',
              getModel: () => ({ getLanguageId: () => 'plaintext' }),
            }),
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: 'my-document.txt', id: 'doc-123' }),
      });

      command.registerCommands(mockRegistry as any);
      const { execute } = mockRegistry.registerCommand.mock.calls[0][1];
      await execute();

      // Verify fetch was called with correct document name
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/documents',
        expect.objectContaining({
          body: expect.stringContaining('"name":"my-document.txt"'),
        })
      );
    });
  });
});
