/**
 * Sanyam Theme Contribution
 *
 * Registers "Sanyam Dark" and "Sanyam Light" VS Code JSON themes via
 * MonacoThemingService. Also toggles a `sanyam-blueprint` CSS class on
 * document.body when a Sanyam theme is active, enabling diagram element overrides.
 *
 * @packageDocumentation
 */

import { injectable, inject } from 'inversify';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { ThemeService } from '@theia/core/lib/browser/theming';
import { MonacoThemingService } from '@theia/monaco/lib/browser/monaco-theming-service';
import { DisposableCollection } from '@theia/core/lib/common';
import sanyamDark from './data/sanyam-dark.json';
import sanyamLight from './data/sanyam-light.json';

/** Theme labels used for detection. */
const SANYAM_DARK_LABEL = 'Sanyam Dark';
const SANYAM_LIGHT_LABEL = 'Sanyam Light';
const SANYAM_BLUEPRINT_BODY_CLASS = 'sanyam-blueprint';

/**
 * Registers Sanyam color themes and manages the body CSS class toggle.
 */
@injectable()
export class SanyamThemeContribution implements FrontendApplicationContribution {

    @inject(ThemeService)
    protected readonly themeService: ThemeService;

    @inject(MonacoThemingService)
    protected readonly monacoThemingService: MonacoThemingService;

    protected readonly toDispose = new DisposableCollection();

    /**
     * Called when the frontend application starts.
     * Registers both Sanyam themes and listens for theme changes.
     */
    onStart(): void {
        this.toDispose.push(
            this.monacoThemingService.registerParsedTheme({
                id: 'sanyam-dark',
                label: SANYAM_DARK_LABEL,
                uiTheme: 'vs-dark',
                json: sanyamDark,
            })
        );

        this.toDispose.push(
            this.monacoThemingService.registerParsedTheme({
                id: 'sanyam-light',
                label: SANYAM_LIGHT_LABEL,
                uiTheme: 'vs',
                json: sanyamLight,
            })
        );

        this.updateBodyClass();
        this.toDispose.push(
            this.themeService.onDidColorThemeChange(() => this.updateBodyClass())
        );
    }

    /**
     * Adds or removes the `sanyam-blueprint` CSS class on document.body
     * based on whether a Sanyam theme is currently active.
     */
    protected updateBodyClass(): void {
        const currentTheme = this.themeService.getCurrentTheme();
        const isSanyam = currentTheme.label === SANYAM_DARK_LABEL
            || currentTheme.label === SANYAM_LIGHT_LABEL;

        if (isSanyam) {
            document.body.classList.add(SANYAM_BLUEPRINT_BODY_CLASS);
        } else {
            document.body.classList.remove(SANYAM_BLUEPRINT_BODY_CLASS);
        }
    }
}
