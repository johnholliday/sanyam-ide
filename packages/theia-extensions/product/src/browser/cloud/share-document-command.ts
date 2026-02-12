/**
 * Share Document Command
 *
 * Command to share a cloud document with collaborators (Pro+ feature).
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
import type { DocumentShare, SharePermission } from '@sanyam/types';

/**
 * Share Document command.
 */
export const SHARE_DOCUMENT_COMMAND: Command = {
  id: 'sanyam.cloud.shareDocument',
  label: 'Sanyam: Share Document',
  category: 'Sanyam Cloud',
};

/**
 * Manage Shares command.
 */
export const MANAGE_SHARES_COMMAND: Command = {
  id: 'sanyam.cloud.manageShares',
  label: 'Sanyam: Manage Document Shares',
  category: 'Sanyam Cloud',
};

/**
 * Permission display info.
 */
const PERMISSION_INFO: Record<SharePermission, { label: string; description: string }> = {
  view: { label: 'View', description: 'Can view but not edit' },
  edit: { label: 'Edit', description: 'Can view and edit' },
  admin: { label: 'Admin', description: 'Can view, edit, and manage shares' },
};

/**
 * Share Document command contribution.
 */
@injectable()
export class ShareDocumentCommand implements CommandContribution, MenuContribution {
  @inject(SupabaseAuthProvider)
  private readonly authProvider!: SupabaseAuthProviderType;

  @inject(QuickInputService)
  private readonly quickInputService!: QuickInputService;

  @inject(MessageService)
  private readonly messageService!: MessageService;

  // Current document context - would be set by editor context
  private currentDocumentId?: string;

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(SHARE_DOCUMENT_COMMAND, {
      execute: (documentId?: string) => this.shareDocument(documentId),
      isEnabled: () => this.canShare(),
      isVisible: () => this.authProvider.isConfigured,
    });

    commands.registerCommand(MANAGE_SHARES_COMMAND, {
      execute: (documentId?: string) => this.manageShares(documentId),
      isEnabled: () => this.canShare(),
      isVisible: () => this.authProvider.isConfigured,
    });
  }

  registerMenus(menus: MenuModelRegistry): void {
    menus.registerMenuAction(['sanyam', 'cloud'], {
      commandId: SHARE_DOCUMENT_COMMAND.id,
      order: '5',
    });

    menus.registerMenuAction(['sanyam', 'cloud'], {
      commandId: MANAGE_SHARES_COMMAND.id,
      order: '6',
    });
  }

  /**
   * Check if user can share documents.
   */
  private canShare(): boolean {
    if (!this.authProvider.isAuthenticated) {
      return false;
    }

    const session = this.authProvider.session;
    return session?.user.tier === 'pro' || session?.user.tier === 'enterprise';
  }

  /**
   * Share a document.
   */
  private async shareDocument(documentId?: string): Promise<void> {
    const docId = documentId ?? this.currentDocumentId;
    if (!docId) {
      // Show document picker first
      const selected = await this.selectDocument();
      if (!selected) {
        return;
      }
      return this.shareDocument(selected);
    }

    if (!this.canShare()) {
      this.messageService.warn('Document sharing requires a Pro or Enterprise subscription.');
      return;
    }

    // Get email
    const email = await this.quickInputService.input({
      title: 'Share Document',
      prompt: 'Enter the email address to share with',
      placeHolder: 'collaborator@example.com',
      validateInput: async (value) => {
        if (!value || !value.includes('@')) {
          return 'Please enter a valid email address';
        }
        return undefined;
      },
    });

    if (!email) {
      return;
    }

    // Get permission
    const permissionItems: QuickPickItem[] = Object.entries(PERMISSION_INFO).map(([key, info]) => ({
      label: info.label,
      description: info.description,
      id: key,
    }));

    const selectedPermission = await this.quickInputService.showQuickPick(permissionItems, {
      title: 'Select Permission Level',
      placeholder: 'Choose what the user can do',
    });

    if (!selectedPermission) {
      return;
    }

    const permission = (selectedPermission as any).id as SharePermission;

    try {
      const accessToken = await this.authProvider.getAccessToken();
      if (!accessToken) {
        this.messageService.error('Failed to get access token');
        return;
      }

      const response = await fetch(`/api/v1/documents/${docId}/shares`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ email, permission }),
      });

      if (!response.ok) {
        const error = await response.json();
        if (error.error?.code === 'FEATURE_NOT_AVAILABLE') {
          this.messageService.error('Document sharing requires a Pro or Enterprise subscription.');
        } else if (error.error?.code === 'USER_NOT_FOUND') {
          this.messageService.error(`User not found: ${email}`);
        } else if (error.error?.code === 'DUPLICATE_ENTRY') {
          this.messageService.warn('This user already has access to this document.');
        } else {
          this.messageService.error(`Failed to share: ${error.error?.message ?? 'Unknown error'}`);
        }
        return;
      }

      this.messageService.info(`Document shared with ${email} (${permission} access)`);
    } catch (error) {
      this.messageService.error(`Failed to share document: ${error}`);
    }
  }

  /**
   * Manage existing shares.
   */
  private async manageShares(documentId?: string): Promise<void> {
    const docId = documentId ?? this.currentDocumentId;
    if (!docId) {
      const selected = await this.selectDocument();
      if (!selected) {
        return;
      }
      return this.manageShares(selected);
    }

    try {
      const accessToken = await this.authProvider.getAccessToken();
      if (!accessToken) {
        this.messageService.error('Failed to get access token');
        return;
      }

      // Fetch existing shares
      const response = await fetch(`/api/v1/documents/${docId}/shares`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        this.messageService.error(`Failed to fetch shares: ${error.error?.message ?? 'Unknown error'}`);
        return;
      }

      const shares: DocumentShare[] = await response.json();

      if (shares.length === 0) {
        const result = await this.messageService.info(
          'This document has no shares. Would you like to share it?',
          'Share Document'
        );
        if (result === 'Share Document') {
          await this.shareDocument(docId);
        }
        return;
      }

      // Show shares picker with revoke option
      const items: QuickPickItem[] = shares.map((share) => ({
        label: `$(account) ${share.shared_with_id}`,
        description: PERMISSION_INFO[share.permission as SharePermission]?.label ?? share.permission,
        id: share.id,
      }));

      items.push({
        label: '$(add) Add new share',
        description: 'Share with another user',
        id: 'new',
      });

      const selected = await this.quickInputService.showQuickPick(items, {
        title: 'Manage Document Shares',
        placeholder: 'Select a share to revoke or add a new one',
      });

      if (!selected) {
        return;
      }

      const selectedId = (selected as any).id as string;

      if (selectedId === 'new') {
        await this.shareDocument(docId);
        return;
      }

      // Confirm revoke
      const confirm = await this.messageService.warn(
        `Are you sure you want to revoke access for ${selected.label}?`,
        'Revoke',
        'Cancel'
      );

      if (confirm !== 'Revoke') {
        return;
      }

      // Revoke share
      const deleteResponse = await fetch(`/api/v1/documents/${docId}/shares/${selectedId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!deleteResponse.ok) {
        this.messageService.error('Failed to revoke share');
        return;
      }

      this.messageService.info('Share revoked successfully');
    } catch (error) {
      this.messageService.error(`Failed to manage shares: ${error}`);
    }
  }

  /**
   * Show document picker to select a document.
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
        this.messageService.info('You have no cloud documents to share.');
        return undefined;
      }

      const items: QuickPickItem[] = documents.map((doc: any) => ({
        label: `$(file) ${doc.name}`,
        description: doc.language_id,
        id: doc.id,
      }));

      const selected = await this.quickInputService.showQuickPick(items, {
        title: 'Select Document to Share',
        placeholder: 'Choose a document',
      });

      return selected ? (selected as any).id : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Set current document context (called by editor).
   */
  setCurrentDocument(documentId: string | undefined): void {
    this.currentDocumentId = documentId;
  }
}
