/**
 * Document History Command
 *
 * Command to view and restore document version history.
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
import { QuickInputService, QuickPickItem } from '@theia/core/lib/browser';
import {
  SupabaseAuthProvider,
  type SupabaseAuthProviderType,
} from '@sanyam/supabase-auth';
import type { DocumentVersion } from '@sanyam/types';

/**
 * Document History command.
 */
export const DOCUMENT_HISTORY_COMMAND: Command = {
  id: 'sanyam.cloud.documentHistory',
  label: 'Sanyam: View Document History',
  category: 'Sanyam Cloud',
};

/**
 * Restore Version command.
 */
export const RESTORE_VERSION_COMMAND: Command = {
  id: 'sanyam.cloud.restoreVersion',
  label: 'Sanyam: Restore Document Version',
  category: 'Sanyam Cloud',
};

/**
 * Document History command contribution.
 */
@injectable()
export class DocumentHistoryCommand implements CommandContribution, MenuContribution {
  @inject(SupabaseAuthProvider)
  private readonly authProvider!: SupabaseAuthProviderType;

  @inject(QuickInputService)
  private readonly quickInputService!: QuickInputService;

  @inject(MessageService)
  private readonly messageService!: MessageService;

  // Current document context
  private currentDocumentId?: string;

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(DOCUMENT_HISTORY_COMMAND, {
      execute: (documentId?: string) => this.showHistory(documentId),
      isEnabled: () => this.authProvider.isAuthenticated,
      isVisible: () => this.authProvider.isConfigured,
    });

    commands.registerCommand(RESTORE_VERSION_COMMAND, {
      execute: (documentId?: string, versionNumber?: number) =>
        this.restoreVersion(documentId, versionNumber),
      isEnabled: () => this.authProvider.isAuthenticated,
      isVisible: () => this.authProvider.isConfigured,
    });
  }

  registerMenus(menus: MenuModelRegistry): void {
    menus.registerMenuAction(['sanyam', 'cloud'], {
      commandId: DOCUMENT_HISTORY_COMMAND.id,
      order: '7',
    });
  }

  /**
   * Show document version history.
   */
  private async showHistory(documentId?: string): Promise<void> {
    const docId = documentId ?? this.currentDocumentId;
    if (!docId) {
      const selected = await this.selectDocument();
      if (!selected) {
        return;
      }
      return this.showHistory(selected);
    }

    try {
      const accessToken = await this.authProvider.getAccessToken();
      if (!accessToken) {
        this.messageService.error('Failed to get access token');
        return;
      }

      // Fetch versions
      const response = await fetch(`/api/v1/documents/${docId}/versions`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        this.messageService.error(`Failed to fetch history: ${error.error?.message ?? 'Unknown error'}`);
        return;
      }

      const versions: DocumentVersion[] = await response.json();

      if (versions.length === 0) {
        this.messageService.info('No version history available for this document.');
        return;
      }

      // Build quick pick items
      const items: QuickPickItem[] = versions.map((v) => ({
        label: `Version ${v.version_number}`,
        description: this.formatDate(v.created_at),
        detail: this.formatSize(v.content_size_bytes),
        id: String(v.version_number),
      }));

      const selected = await this.quickInputService.showQuickPick(items, {
        title: 'Document Version History',
        placeholder: 'Select a version to preview or restore',
      });

      if (!selected) {
        return;
      }

      const versionNumber = parseInt((selected as any).id, 10);

      // Offer actions for selected version
      const action = await this.quickInputService.showQuickPick([
        { label: '$(eye) Preview', description: 'View this version', id: 'preview' },
        { label: '$(history) Restore', description: 'Restore document to this version', id: 'restore' },
        { label: '$(diff) Compare', description: 'Compare with current version', id: 'compare' },
      ], {
        title: `Version ${versionNumber}`,
        placeholder: 'Choose an action',
      });

      if (!action) {
        return;
      }

      switch ((action as any).id) {
        case 'preview':
          await this.previewVersion(docId, versionNumber, accessToken);
          break;
        case 'restore':
          await this.restoreVersion(docId, versionNumber);
          break;
        case 'compare':
          await this.compareVersion(docId, versionNumber, accessToken);
          break;
      }
    } catch (error) {
      this.messageService.error(`Failed to show history: ${error}`);
    }
  }

  /**
   * Preview a specific version.
   */
  private async previewVersion(
    documentId: string,
    versionNumber: number,
    accessToken: string
  ): Promise<void> {
    try {
      const response = await fetch(
        `/api/v1/documents/${documentId}/versions/${versionNumber}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        this.messageService.error('Failed to fetch version');
        return;
      }

      const version: DocumentVersion = await response.json();

      // Show preview in a simple way (ideally would open in a diff editor)
      this.messageService.info(
        `Version ${versionNumber} (${this.formatSize(version.content_size_bytes)})\n\nCreated: ${this.formatDate(version.created_at)}\n\nContent preview: ${version.content.slice(0, 200)}...`
      );
    } catch (error) {
      this.messageService.error(`Failed to preview version: ${error}`);
    }
  }

  /**
   * Restore a specific version.
   */
  private async restoreVersion(
    documentId?: string,
    versionNumber?: number
  ): Promise<void> {
    const docId = documentId ?? this.currentDocumentId;
    if (!docId || versionNumber === undefined) {
      this.messageService.warn('Please select a document and version first');
      return;
    }

    const confirm = await this.messageService.warn(
      `Are you sure you want to restore to version ${versionNumber}? This will create a new version with the old content.`,
      'Restore',
      'Cancel'
    );

    if (confirm !== 'Restore') {
      return;
    }

    try {
      const accessToken = await this.authProvider.getAccessToken();
      if (!accessToken) {
        this.messageService.error('Failed to get access token');
        return;
      }

      const response = await fetch(
        `/api/v1/documents/${docId}/versions/${versionNumber}/restore`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ createNewVersion: true }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        this.messageService.error(`Failed to restore: ${error.error?.message ?? 'Unknown error'}`);
        return;
      }

      this.messageService.info(`Document restored to version ${versionNumber}`);
    } catch (error) {
      this.messageService.error(`Failed to restore version: ${error}`);
    }
  }

  /**
   * Compare version with current.
   */
  private async compareVersion(
    documentId: string,
    versionNumber: number,
    accessToken: string
  ): Promise<void> {
    try {
      const response = await fetch(
        `/api/v1/documents/${documentId}/versions/${versionNumber}/diff`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        this.messageService.error('Failed to fetch diff');
        return;
      }

      const diff = await response.json();

      // Show basic diff info (ideally would open in diff editor)
      const currentSize = new TextEncoder().encode(diff.current.content).length;
      const historicalSize = new TextEncoder().encode(diff.historical.content).length;
      const sizeDiff = currentSize - historicalSize;

      this.messageService.info(
        `Comparing version ${versionNumber} with current (v${diff.current.version})\n\n` +
        `Current: ${this.formatSize(currentSize)}\n` +
        `Version ${versionNumber}: ${this.formatSize(historicalSize)}\n` +
        `Difference: ${sizeDiff >= 0 ? '+' : ''}${this.formatSize(Math.abs(sizeDiff))}`
      );
    } catch (error) {
      this.messageService.error(`Failed to compare versions: ${error}`);
    }
  }

  /**
   * Show document picker.
   */
  private async selectDocument(): Promise<string | undefined> {
    try {
      const accessToken = await this.authProvider.getAccessToken();
      if (!accessToken) {
        return undefined;
      }

      const response = await fetch('/api/v1/documents?limit=50', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        return undefined;
      }

      const result = await response.json();
      const documents = result.data;

      if (documents.length === 0) {
        this.messageService.info('You have no cloud documents.');
        return undefined;
      }

      const items: QuickPickItem[] = documents.map((doc: any) => ({
        label: `$(file) ${doc.name}`,
        description: `v${doc.version}`,
        id: doc.id,
      }));

      const selected = await this.quickInputService.showQuickPick(items, {
        title: 'Select Document',
        placeholder: 'Choose a document to view history',
      });

      return selected ? (selected as any).id : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Format date for display.
   */
  private formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleString();
  }

  /**
   * Format file size for display.
   */
  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Set current document context.
   */
  setCurrentDocument(documentId: string | undefined): void {
    this.currentDocumentId = documentId;
  }
}
