/**
 * Restore Deleted Document Command
 *
 * Command to restore soft-deleted cloud documents (Pro+ feature).
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
import type { CloudDocument, PaginatedResponse } from '@sanyam/types';

/**
 * Restore Deleted Document command.
 */
export const RESTORE_DOCUMENT_COMMAND: Command = {
  id: 'sanyam.cloud.restoreDocument',
  label: 'Sanyam: Restore Deleted Document',
  category: 'Sanyam Cloud',
};

/**
 * Restore Document command contribution.
 */
@injectable()
export class RestoreDocumentCommand implements CommandContribution, MenuContribution {
  @inject(SupabaseAuthProvider)
  private readonly authProvider!: SupabaseAuthProviderType;

  @inject(QuickInputService)
  private readonly quickInputService!: QuickInputService;

  @inject(MessageService)
  private readonly messageService!: MessageService;

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(RESTORE_DOCUMENT_COMMAND, {
      execute: () => this.showDeletedDocuments(),
      isEnabled: () => this.canRestore(),
      isVisible: () => this.authProvider.isConfigured,
    });
  }

  registerMenus(menus: MenuModelRegistry): void {
    // Add to Cloud submenu
    menus.registerMenuAction(['sanyam', 'cloud'], {
      commandId: RESTORE_DOCUMENT_COMMAND.id,
      order: '4',
    });
  }

  /**
   * Check if user can restore documents (Pro+ tier).
   */
  private canRestore(): boolean {
    if (!this.authProvider.isAuthenticated) {
      return false;
    }

    const session = this.authProvider.session;
    if (!session) {
      return false;
    }

    // Pro or Enterprise can restore
    return session.user.tier === 'pro' || session.user.tier === 'enterprise';
  }

  /**
   * Show deleted documents browser.
   */
  private async showDeletedDocuments(): Promise<void> {
    if (!this.authProvider.isAuthenticated) {
      this.messageService.warn('Please sign in to access cloud documents');
      return;
    }

    const session = this.authProvider.session;
    if (session?.user.tier === 'free') {
      this.messageService.warn(
        'Restoring deleted documents requires a Pro or Enterprise subscription.'
      );
      return;
    }

    try {
      const accessToken = await this.authProvider.getAccessToken();
      if (!accessToken) {
        this.messageService.error('Failed to get access token');
        return;
      }

      // Fetch deleted documents
      const response = await fetch('/api/v1/documents?includeDeleted=true&limit=50', {
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

      // Filter to only deleted documents
      const deletedDocs = result.data.filter((doc) => doc.deleted_at !== null);

      if (deletedDocs.length === 0) {
        this.messageService.info('You don\'t have any deleted documents.');
        return;
      }

      // Build quick pick items
      const items: QuickPickItem[] = deletedDocs.map((doc) => ({
        label: `$(trash) ${doc.name}`,
        description: doc.language_id,
        detail: `Deleted: ${this.formatDate(doc.deleted_at!)}`,
        id: doc.id,
      }));

      const selected = await this.quickInputService.showQuickPick(items, {
        title: 'Restore Deleted Document',
        placeholder: 'Select a document to restore',
        matchOnDescription: true,
        matchOnDetail: true,
      });

      if (!selected || !('id' in selected)) {
        return;
      }

      // Restore the document
      await this.restoreDocument(selected.id as string, accessToken);

    } catch (error) {
      this.messageService.error(`Failed to browse deleted documents: ${error}`);
    }
  }

  /**
   * Restore a document.
   */
  private async restoreDocument(documentId: string, accessToken: string): Promise<void> {
    try {
      const response = await fetch(`/api/v1/documents/${documentId}/restore`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        if (error.error?.code === 'FEATURE_NOT_AVAILABLE') {
          this.messageService.error(
            'Restoring documents requires a Pro or Enterprise subscription.'
          );
        } else {
          this.messageService.error(`Failed to restore document: ${error.error?.message ?? 'Unknown error'}`);
        }
        return;
      }

      const document: CloudDocument = await response.json();
      this.messageService.info(`Document "${document.name}" has been restored.`);

    } catch (error) {
      this.messageService.error(`Failed to restore document: ${error}`);
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
