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
}
