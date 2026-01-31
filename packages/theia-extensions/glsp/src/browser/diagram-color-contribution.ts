/**
 * Diagram Color Contribution
 *
 * Registers custom color tokens for diagram backgrounds, grid, and foreground
 * that can be overridden by VS Code JSON themes (e.g., Blueprint themes).
 *
 * @packageDocumentation
 */

import { injectable } from 'inversify';
import { ColorContribution } from '@theia/core/lib/browser/color-application-contribution';
import { ColorRegistry } from '@theia/core/lib/browser/color-registry';

/**
 * Registers Sanyam diagram color tokens into the Theia color registry.
 *
 * These tokens produce CSS variables (e.g., `--theia-sanyam-diagram-background`)
 * that the diagram CSS consumes. VS Code JSON themes can override these tokens
 * to restyle the diagram canvas without touching CSS directly.
 */
@injectable()
export class DiagramColorContribution implements ColorContribution {

    /**
     * Register diagram-specific color tokens.
     */
    registerColors(colors: ColorRegistry): void {
        colors.register(
            {
                id: 'sanyam.diagram.background',
                defaults: {
                    dark: 'editor.background',
                    light: 'editor.background',
                    hcDark: 'editor.background',
                    hcLight: 'editor.background',
                },
                description: 'Background color of the diagram canvas.',
            },
            {
                id: 'sanyam.diagram.gridColor',
                defaults: {
                    dark: '#80808050',
                    light: '#00000028',
                    hcDark: 'contrastBorder',
                    hcLight: 'contrastBorder',
                },
                description: 'Color of the diagram grid/dot pattern.',
            },
            {
                id: 'sanyam.diagram.foreground',
                defaults: {
                    dark: 'foreground',
                    light: 'foreground',
                    hcDark: 'foreground',
                    hcLight: 'foreground',
                },
                description: 'Default foreground color for diagram elements (labels, edges).',
            }
        );
    }
}
