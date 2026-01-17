/**
 * Default Diagnostics Provider (T035)
 *
 * Reports validation errors and diagnostics from Langium validation.
 *
 * @packageDocumentation
 */

import type {
  Diagnostic,
  DiagnosticSeverity,
} from 'vscode-languageserver';
import type { LspContext } from '@sanyam/types';
import type { DiagnosticData, ValidationCategory } from 'langium';

/**
 * Diagnostic severity mapping from Langium to LSP.
 */
const SEVERITY_MAP: Record<ValidationCategory, DiagnosticSeverity> = {
  error: 1, // DiagnosticSeverity.Error
  warning: 2, // DiagnosticSeverity.Warning
  info: 3, // DiagnosticSeverity.Information
  hint: 4, // DiagnosticSeverity.Hint
};

/**
 * Default diagnostics provider that reports Langium validation errors.
 */
export const defaultDiagnosticsProvider = {
  /**
   * Provide diagnostics for the given document.
   */
  async provide(context: LspContext): Promise<Diagnostic[]> {
    const { document, services, shared } = context;

    // Get diagnostics from the document
    const langiumDiagnostics = document.diagnostics ?? [];

    // Convert Langium diagnostics to LSP diagnostics
    const diagnostics: Diagnostic[] = langiumDiagnostics.map((diag) => {
      const lspDiagnostic: Diagnostic = {
        range: diag.range,
        message: diag.message,
        severity: diag.severity ?? 1, // Default to error
        source: diag.source ?? 'langium',
      };

      // Add code if available
      if (diag.code !== undefined) {
        lspDiagnostic.code = diag.code;
      }

      // Add code description if available
      if (diag.codeDescription) {
        lspDiagnostic.codeDescription = diag.codeDescription;
      }

      // Add related information if available
      if (diag.relatedInformation) {
        lspDiagnostic.relatedInformation = diag.relatedInformation;
      }

      // Add tags if available (deprecated, unnecessary)
      if (diag.tags) {
        lspDiagnostic.tags = diag.tags;
      }

      // Add data if available (for code actions)
      if (diag.data) {
        lspDiagnostic.data = diag.data;
      }

      return lspDiagnostic;
    });

    return diagnostics;
  },
};

/**
 * Create a diagnostics provider with additional custom validation.
 *
 * @param customValidator - Additional validation function
 * @returns A configured diagnostics provider
 */
export function createDiagnosticsProvider(
  customValidator?: (context: LspContext) => Promise<Diagnostic[]>
): typeof defaultDiagnosticsProvider {
  if (!customValidator) {
    return defaultDiagnosticsProvider;
  }

  return {
    async provide(context: LspContext): Promise<Diagnostic[]> {
      // Get base diagnostics
      const baseDiagnostics = await defaultDiagnosticsProvider.provide(context);

      // Get custom diagnostics
      const customDiagnostics = await customValidator(context);

      // Merge and return
      return [...baseDiagnostics, ...customDiagnostics];
    },
  };
}

/**
 * Helper to create a diagnostic.
 */
export function createDiagnostic(
  message: string,
  range: Diagnostic['range'],
  severity: 'error' | 'warning' | 'info' | 'hint' = 'error',
  options?: {
    code?: string | number;
    source?: string;
    relatedInformation?: Diagnostic['relatedInformation'];
    tags?: Diagnostic['tags'];
    data?: unknown;
  }
): Diagnostic {
  const diagnostic: Diagnostic = {
    range,
    message,
    severity: SEVERITY_MAP[severity],
    source: options?.source ?? 'sanyam',
  };

  if (options?.code !== undefined) {
    diagnostic.code = options.code;
  }

  if (options?.relatedInformation) {
    diagnostic.relatedInformation = options.relatedInformation;
  }

  if (options?.tags) {
    diagnostic.tags = options.tags;
  }

  if (options?.data !== undefined) {
    diagnostic.data = options.data;
  }

  return diagnostic;
}

/**
 * Helper to filter diagnostics by severity.
 */
export function filterDiagnosticsBySeverity(
  diagnostics: Diagnostic[],
  minSeverity: 'error' | 'warning' | 'info' | 'hint'
): Diagnostic[] {
  const minSeverityValue = SEVERITY_MAP[minSeverity];
  return diagnostics.filter((d) => (d.severity ?? 1) <= minSeverityValue);
}

/**
 * Helper to group diagnostics by line.
 */
export function groupDiagnosticsByLine(
  diagnostics: Diagnostic[]
): Map<number, Diagnostic[]> {
  const grouped = new Map<number, Diagnostic[]>();

  for (const diagnostic of diagnostics) {
    const line = diagnostic.range.start.line;
    const existing = grouped.get(line);
    if (existing) {
      existing.push(diagnostic);
    } else {
      grouped.set(line, [diagnostic]);
    }
  }

  return grouped;
}
