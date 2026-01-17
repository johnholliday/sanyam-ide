/**
 * ECML LSP Overrides (T114)
 *
 * Custom LSP providers for the ECML language.
 * These override the default providers with ECML-specific behavior.
 *
 * @packageDocumentation
 */

import type {
  HoverProvider,
  CompletionProvider,
  LspContext,
  Position,
} from '@sanyam/types';

/**
 * Custom ECML Hover Provider.
 *
 * Provides rich hover information for ECML elements including:
 * - Element type and name
 * - Description from the model
 * - Links to related elements
 */
export const ecmlHoverProvider: HoverProvider = {
  async provide(context: LspContext, position: Position) {
    const { document, services } = context;

    // Get the AST node at the position
    // This is a simplified example - real implementation would use Langium's node finder
    const offset = document.offsetAt(position);
    const text = document.getText();

    // Find the word at position
    const word = getWordAtOffset(text, offset);
    if (!word) {
      return null;
    }

    // Check for ECML-specific element types and provide rich hover info
    const hoverContent = buildEcmlHoverContent(word, text);
    if (!hoverContent) {
      return null;
    }

    return {
      contents: {
        kind: 'markdown',
        value: hoverContent,
      },
    };
  },
};

/**
 * Custom ECML Completion Provider.
 *
 * Provides context-aware completions for ECML elements including:
 * - Element type keywords (Actor, Activity, Task, etc.)
 * - Reference completions for existing elements
 * - Attribute completions based on context
 */
export const ecmlCompletionProvider: CompletionProvider = {
  async provide(context: LspContext, position: Position, completionContext: any) {
    const { document } = context;
    const text = document.getText();
    const offset = document.offsetAt(position);

    // Get context around the cursor
    const line = getLineAtOffset(text, offset);
    const items: any[] = [];

    // Check if we're at the start of a line (element declaration)
    if (isAtLineStart(line, offset)) {
      items.push(
        ...getEcmlElementKeywords().map(keyword => ({
          label: keyword.label,
          kind: 14, // Keyword
          detail: keyword.description,
          documentation: keyword.documentation,
          insertText: keyword.snippet,
          insertTextFormat: 2, // Snippet
        }))
      );
    }

    // Check if we're inside a block (attribute context)
    if (isInsideBlock(text, offset)) {
      items.push(
        ...getEcmlAttributeCompletions().map(attr => ({
          label: attr.label,
          kind: 10, // Property
          detail: attr.description,
          insertText: attr.snippet,
          insertTextFormat: 2,
        }))
      );
    }

    return items;
  },
};

// Helper functions

function getWordAtOffset(text: string, offset: number): string | null {
  // Find word boundaries
  const before = text.slice(0, offset);
  const after = text.slice(offset);

  const wordStartMatch = before.match(/[\w_]+$/);
  const wordEndMatch = after.match(/^[\w_]*/);

  if (!wordStartMatch && !wordEndMatch) {
    return null;
  }

  return (wordStartMatch?.[0] ?? '') + (wordEndMatch?.[0] ?? '');
}

function getLineAtOffset(text: string, offset: number): string {
  const lines = text.split('\n');
  let currentOffset = 0;

  for (const line of lines) {
    if (currentOffset + line.length >= offset) {
      return line;
    }
    currentOffset += line.length + 1; // +1 for newline
  }

  return '';
}

function isAtLineStart(line: string, offset: number): boolean {
  return line.trim() === '' || /^\s*$/.test(line.slice(0, offset));
}

function isInsideBlock(text: string, offset: number): boolean {
  const before = text.slice(0, offset);
  const openBraces = (before.match(/{/g) || []).length;
  const closeBraces = (before.match(/}/g) || []).length;
  return openBraces > closeBraces;
}

function buildEcmlHoverContent(word: string, fullText: string): string | null {
  // ECML element types
  const elementTypes: Record<string, { icon: string; description: string }> = {
    Actor: {
      icon: '👤',
      description: 'A person or system that interacts with the content model',
    },
    Activity: {
      icon: '📋',
      description: 'A business activity that processes or creates content',
    },
    Task: {
      icon: '✅',
      description: 'A specific task within an activity',
    },
    Content: {
      icon: '📄',
      description: 'A piece of content managed by the system',
    },
    SecurityGroup: {
      icon: '🛡️',
      description: 'A group of permissions for access control',
    },
    Permission: {
      icon: '🔐',
      description: 'A specific permission for content access',
    },
    RetentionLabel: {
      icon: '🏷️',
      description: 'A label for content retention policies',
    },
    SensitivityLabel: {
      icon: '⚠️',
      description: 'A label for content sensitivity classification',
    },
    Workflow: {
      icon: '🔄',
      description: 'A sequence of activities for content processing',
    },
  };

  // Check if word is an ECML keyword
  if (word in elementTypes) {
    const info = elementTypes[word];
    return `${info.icon} **${word}**\n\n${info.description}\n\n---\n\n*ECML Element Type*`;
  }

  // Check if word is a named element in the document
  const elementPattern = new RegExp(`(${Object.keys(elementTypes).join('|')})\\s+${word}\\s*`, 'i');
  const match = fullText.match(elementPattern);

  if (match) {
    const type = match[1];
    const info = elementTypes[type];
    if (info) {
      return `${info.icon} **${word}**\n\nType: \`${type}\`\n\n${info.description}\n\n---\n\n*ECML Element: ${type}*`;
    }
  }

  return null;
}

function getEcmlElementKeywords() {
  return [
    {
      label: 'Actor',
      description: 'Define a person or system',
      documentation: 'An Actor represents a person or external system that interacts with the content model.',
      snippet: 'Actor ${1:name} "${2:Title}" "${3:Description}"',
    },
    {
      label: 'Activity',
      description: 'Define a business activity',
      documentation: 'An Activity represents a business process that creates or manages content.',
      snippet: 'Activity ${1:name} "${2:Title}" "${3:Description}"',
    },
    {
      label: 'Task',
      description: 'Define a specific task',
      documentation: 'A Task is a specific work item within an Activity.',
      snippet: 'Task ${1:name} "${2:Title}" "${3:Description}"',
    },
    {
      label: 'Content',
      description: 'Define a content item',
      documentation: 'Content represents a document or data object in the system.',
      snippet: 'Content ${1:name} "${2:Title}" "${3:Description}"',
    },
    {
      label: 'SecurityGroup',
      description: 'Define a security group',
      documentation: 'A SecurityGroup defines access permissions for users.',
      snippet: 'SecurityGroup ${1:name} "${2:Title}" "${3:Description}"',
    },
    {
      label: 'Permission',
      description: 'Define a permission',
      documentation: 'A Permission grants specific access rights to content.',
      snippet: 'Permission ${1:name} "${2:Title}" "${3:Description}"',
    },
    {
      label: 'RetentionLabel',
      description: 'Define a retention label',
      documentation: 'A RetentionLabel specifies how long content should be kept.',
      snippet: 'RetentionLabel ${1:name} "${2:Title}" "${3:Description}"',
    },
    {
      label: 'SensitivityLabel',
      description: 'Define a sensitivity label',
      documentation: 'A SensitivityLabel classifies content sensitivity level.',
      snippet: 'SensitivityLabel ${1:name} "${2:Title}" "${3:Description}"',
    },
    {
      label: 'Workflow',
      description: 'Define a workflow',
      documentation: 'A Workflow defines a sequence of activities for content processing.',
      snippet: 'Workflow ${1:name} "${2:Title}" "${3:Description}" {\n\t$0\n}',
    },
  ];
}

function getEcmlAttributeCompletions() {
  return [
    {
      label: 'description',
      description: 'Element description',
      snippet: 'description "${1:Description}"',
    },
    {
      label: 'owner',
      description: 'Owner reference',
      snippet: 'owner ${1:ActorName}',
    },
    {
      label: 'assignedTo',
      description: 'Assignment reference',
      snippet: 'assignedTo ${1:ActorName}',
    },
    {
      label: 'produces',
      description: 'Content produced',
      snippet: 'produces ${1:ContentName}',
    },
    {
      label: 'consumes',
      description: 'Content consumed',
      snippet: 'consumes ${1:ContentName}',
    },
    {
      label: 'requires',
      description: 'Required permission',
      snippet: 'requires ${1:PermissionName}',
    },
  ];
}

/**
 * All ECML LSP overrides.
 */
export const ecmlLspOverrides = {
  hover: ecmlHoverProvider,
  completion: ecmlCompletionProvider,
};

export default ecmlLspOverrides;
