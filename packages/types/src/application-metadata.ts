/**
 * Represents a link in the application metadata.
 */
export interface ApplicationLink {
    readonly label: string;
    readonly url: string;
    readonly icon?: string;  // codicon name
}

/**
 * Simplified application metadata for IDE branding.
 * Grammar documentation is now read from GrammarManifest via GrammarRegistry at runtime.
 *
 * Note: The `applicationGrammar` field is configured at the top-level `theia.frontend.config`
 * level (not inside applicationData). Use `getApplicationGrammar()` to access it.
 */
export interface ApplicationMetadata {
    readonly name: string;
    readonly description: string;
    readonly logo: string;           // path to logo asset
    readonly tagline: string;
    readonly text: readonly string[];      // paragraphs
    readonly links: readonly ApplicationLink[];
}
