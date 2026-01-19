/**
 * Represents a link in the application metadata.
 */
export interface ApplicationLink {
    readonly label: string;
    readonly url: string;
    readonly icon?: string;  // codicon name
}

/**
 * Rich application metadata for customizing the IDE branding and welcome page.
 * This extends Theia's built-in applicationName with additional fields.
 */
export interface ApplicationMetadata {
    readonly name: string;
    readonly description: string;
    readonly logo: string;           // path to logo asset
    readonly tagline: string;
    readonly text: readonly string[];      // paragraphs
    readonly links: readonly ApplicationLink[];

    /**
     * Optional grammar language ID that provides branding.
     * If specified and the grammar has a logo, it will override the default logo.
     *
     * @example 'ecml'
     */
    readonly grammarId?: string;

    /**
     * Optional grammar logo as a base64-encoded data URL.
     * If provided, this takes precedence over looking up the logo from the grammar registry.
     * Falls back to the default `logo` if not provided.
     *
     * @example 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0i...'
     */
    readonly grammarLogo?: string;
}
