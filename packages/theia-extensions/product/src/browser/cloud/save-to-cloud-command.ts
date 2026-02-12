/**
 * Save to Cloud Command
 *
 * Command to save the current document to Sanyam Cloud.
 *
 * @packageDocumentation
 */

import { injectable, inject } from '@theia/core/shared/inversify';
import {
  CommandContribution,
  CommandRegistry,
  Command,
  MenuContribution,
  MenuModelRegistry,
} from '@theia/core/lib/common';
import { MessageService } from '@theia/core';
import { EditorManager, EditorWidget } from '@theia/editor/lib/browser';
import { MonacoEditor } from '@theia/monaco/lib/browser/monaco-editor';
import {
  SupabaseAuthProvider,
  type SupabaseAuthProviderType,
} from '@sanyam/supabase-auth';

/**
 * Save to Cloud command.
 */
export const SAVE_TO_CLOUD_COMMAND: Command = {
  id: 'sanyam.cloud.saveToCloud',
  label: 'Sanyam: Save to Cloud',
  category: 'Sanyam Cloud',
};

/**
 * Save to Cloud command contribution.
 */
@injectable()
export class SaveToCloudCommand implements CommandContribution, MenuContribution {
  @inject(SupabaseAuthProvider)
  private readonly authProvider!: SupabaseAuthProviderType;

  @inject(EditorManager)
  private readonly editorManager!: EditorManager;

  @inject(MessageService)
  private readonly messageService!: MessageService;

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(SAVE_TO_CLOUD_COMMAND, {
      execute: () => this.saveToCloud(),
      isEnabled: () => this.canSaveToCloud(),
      isVisible: () => this.authProvider.isConfigured,
    });
  }

  registerMenus(menus: MenuModelRegistry): void {
    // Add to File menu
    menus.registerMenuAction(['menubar', 'file', 'save'], {
      commandId: SAVE_TO_CLOUD_COMMAND.id,
      order: '2.5', // After Save, before Save As
    });
  }

  /**
   * Check if save to cloud is possible.
   */
  private canSaveToCloud(): boolean {
    if (!this.authProvider.isAuthenticated) {
      return false;
    }

    const editor = this.editorManager.currentEditor;
    if (!editor) {
      return false;
    }

    // Check if document has content
    const monacoEditor = this.getMonacoEditor(editor);
    return monacoEditor !== undefined;
  }

  /**
   * Save current document to cloud.
   */
  private async saveToCloud(): Promise<void> {
    if (!this.authProvider.isAuthenticated) {
      this.messageService.warn('Please sign in to save to cloud');
      return;
    }

    const editor = this.editorManager.currentEditor;
    if (!editor) {
      this.messageService.warn('No active editor');
      return;
    }

    const monacoEditor = this.getMonacoEditor(editor);
    if (!monacoEditor) {
      this.messageService.warn('Cannot save this type of document to cloud');
      return;
    }

    const uri = editor.editor.uri;
    const content = monacoEditor.getControl().getValue();
    const name = this.getDocumentName(uri.toString());
    const languageId = monacoEditor.getControl().getModel()?.getLanguageId() ?? 'plaintext';

    try {
      // Get access token
      const accessToken = await this.authProvider.getAccessToken();
      if (!accessToken) {
        this.messageService.error('Failed to get access token');
        return;
      }

      // Call the API to save document
      const response = await fetch('/api/v1/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          name,
          languageId,
          content,
          metadata: {
            localUri: uri.toString(),
            savedAt: new Date().toISOString(),
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        if (error.error?.code === 'TIER_LIMIT_EXCEEDED') {
          this.messageService.error(
            `Cannot save: ${error.error.message}. Consider upgrading your subscription.`
          );
        } else {
          this.messageService.error(`Failed to save to cloud: ${error.error?.message ?? 'Unknown error'}`);
        }
        return;
      }

      const document = await response.json();
      this.messageService.info(`Document saved to cloud: ${document.name}`);

    } catch (error) {
      this.messageService.error(`Failed to save to cloud: ${error}`);
    }
  }

  /**
   * Get Monaco editor from Theia editor widget.
   */
  private getMonacoEditor(editor: EditorWidget): MonacoEditor | undefined {
    const theiaEditor = editor.editor;
    if ('getControl' in theiaEditor && typeof theiaEditor.getControl === 'function') {
      return theiaEditor as unknown as MonacoEditor;
    }
    return undefined;
  }

  /**
   * Extract document name from URI.
   */
  private getDocumentName(uri: string): string {
    // Get filename from URI
    const parts = uri.split('/');
    const filename = parts[parts.length - 1] ?? 'untitled';
    return decodeURIComponent(filename);
  }
}
