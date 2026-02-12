/**
 * Open Cloud Document Command
 *
 * Command to browse and open cloud-stored documents.
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
import { MessageService, nls } from '@theia/core';
import { QuickInputService, QuickPickItem, QuickPickSeparator } from '@theia/core/lib/browser';
import { OpenerService, open } from '@theia/core/lib/browser/opener-service';
import { URI } from '@theia/core/lib/common/uri';
import {
  SupabaseAuthProvider,
  type SupabaseAuthProviderType,
} from '@sanyam/supabase-auth';
import type { CloudDocument, PaginatedResponse } from '@sanyam/types';
import { SANYAM_URI_SCHEME } from '@sanyam/types';

/**
 * Open Cloud Document command.
 */
export const OPEN_CLOUD_DOCUMENT_COMMAND: Command = {
  id: 'sanyam.cloud.openDocument',
  label: 'Sanyam: Open Cloud Document',
  category: 'Sanyam Cloud',
};

/**
 * Open Cloud Document command contribution.
 */
@injectable()
export class OpenCloudDocumentCommand implements CommandContribution, MenuContribution {
  @inject(SupabaseAuthProvider)
  private readonly authProvider!: SupabaseAuthProviderType;

  @inject(QuickInputService)
  private readonly quickInputService!: QuickInputService;

  @inject(MessageService)
  private readonly messageService!: MessageService;

  @inject(OpenerService)
  private readonly openerService!: OpenerService;

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(OPEN_CLOUD_DOCUMENT_COMMAND, {
      execute: () => this.openCloudDocument(),
      isEnabled: () => this.authProvider.isAuthenticated,
      isVisible: () => this.authProvider.isConfigured,
    });
  }

  registerMenus(menus: MenuModelRegistry): void {
    // Add to File menu
    menus.registerMenuAction(['menubar', 'file', 'open'], {
      commandId: OPEN_CLOUD_DOCUMENT_COMMAND.id,
      order: '1.5', // After Open File
    });
  }

  /**
   * Show document browser and open selected document.
   */
  private async openCloudDocument(): Promise<void> {
    if (!this.authProvider.isAuthenticated) {
      this.messageService.warn('Please sign in to access cloud documents');
      return;
    }

    try {
      // Fetch documents
      const accessToken = await this.authProvider.getAccessToken();
      if (!accessToken) {
        this.messageService.error('Failed to get access token');
        return;
      }

      const response = await fetch('/api/v1/documents?limit=50', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        this.messageService.error(`Failed to fetch documents: ${error.error?.message ?? 'Unknown error'}`);
        return;
      }

      const result: PaginatedResponse<CloudDocument> = await response.json();
      const documents = result.data;

      if (documents.length === 0) {
        this.showEmptyState();
        return;
      }

      // Build quick pick items
      const items: (QuickPickItem | QuickPickSeparator)[] = documents.map((doc) => ({
        label: `$(file) ${doc.name}`,
        description: doc.language_id,
        detail: `Updated: ${this.formatDate(doc.updated_at)}`,
        id: doc.id,
      }));

      // Add pagination info if there are more
      if (result.pagination.next_cursor) {
        items.push({
          type: 'separator',
          label: `Showing ${documents.length} of ${result.pagination.total_count} documents`,
        } as QuickPickSeparator);
      }

      const selected = await this.quickInputService.showQuickPick(items, {
        title: 'Open Cloud Document',
        placeholder: 'Select a document to open',
        matchOnDescription: true,
        matchOnDetail: true,
      });

      if (!selected || !('id' in selected)) {
        return;
      }

      // Open the selected document
      await this.openDocument(selected.id as string);

    } catch (error) {
      this.messageService.error(`Failed to browse cloud documents: ${error}`);
    }
  }

  /**
   * Open a cloud document by ID.
   */
  private async openDocument(documentId: string): Promise<void> {
    const uri = new URI(`${SANYAM_URI_SCHEME}://documents/${documentId}`);

    try {
      await open(this.openerService, uri);
    } catch (error) {
      this.messageService.error(`Failed to open document: ${error}`);
    }
  }

  /**
   * Show empty state guidance.
   */
  private async showEmptyState(): Promise<void> {
    const result = await this.messageService.info(
      'You don\'t have any cloud documents yet. Save a document to cloud to get started.',
      'Save Current Document'
    );

    if (result === 'Save Current Document') {
      // Execute save to cloud command
      // Note: This would need CommandService injection to work
    }
  }

  /**
   * Format date for display.
   */
  private formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Today at ${date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  }
}
