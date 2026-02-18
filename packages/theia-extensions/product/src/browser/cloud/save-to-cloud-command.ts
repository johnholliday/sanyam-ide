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
import { CommonMenus } from '@theia/core/lib/browser';
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
      isEnabled: () => this.authProvider.isAuthenticated,
      isVisible: () => this.authProvider.isConfigured,
    });
  }

  registerMenus(menus: MenuModelRegistry): void {
    // Add to File > Save group, after Save and Save All
    menus.registerMenuAction(CommonMenus.FILE_SAVE, {
      commandId: SAVE_TO_CLOUD_COMMAND.id,
      order: '3', // After Save (1) and Save All (2)
    });
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
      this.messageService.warn('Open a text file first, then save to cloud');
      return;
    }

    const monacoEditor = this.getMonacoEditor(editor);
    if (!monacoEditor) {
      this.messageService.warn('Cannot save this type of document to cloud — open a text editor');
      return;
    }

    const uri = editor.editor.uri;
    const content = monacoEditor.getControl().getValue();
    const name = this.getDocumentName(uri.toString());
    const languageId = monacoEditor.getControl().getModel()?.getLanguageId() ?? 'plaintext';

    this.messageService.info('Saving to cloud…');

    try {
      // Get access token
      const accessToken = await this.authProvider.getAccessToken();
      if (!accessToken) {
        this.messageService.error('Failed to get access token — please sign in again');
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
        let errorMessage = `HTTP ${response.status}`;
        try {
          const body = await response.json();
          if (body.error?.code === 'TIER_LIMIT_EXCEEDED') {
            this.messageService.error(
              `Cannot save: ${body.error.message}. Consider upgrading your subscription.`
            );
            return;
          }
          errorMessage = body.error?.message ?? body.error ?? errorMessage;
        } catch {
          // Response wasn't JSON — use status text
          errorMessage = `${response.status} ${response.statusText}`;
        }
        this.messageService.error(`Failed to save to cloud: ${errorMessage}`);
        return;
      }

      const document = await response.json();
      this.messageService.info(`Saved to cloud: ${document.name}`);

    } catch (error) {
      console.error('[SaveToCloud] Error:', error);
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
