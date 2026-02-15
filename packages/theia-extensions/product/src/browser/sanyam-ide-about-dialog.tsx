/********************************************************************************
 * Copyright (C) 2020 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import * as React from 'react';
import { AboutDialog, AboutDialogProps, ABOUT_CONTENT_CLASS } from '@theia/core/lib/browser/about-dialog';
import { injectable, inject, optional } from '@theia/core/shared/inversify';
import { renderDocumentation, renderDownloads, /* renderSourceCode, */ renderSupport, renderTickets, renderWhatIs } from './branding-util';
import { VSXEnvironment } from '@theia/vsx-registry/lib/common/vsx-environment';
import { WindowService } from '@theia/core/lib/browser/window/window-service';
import { getApplicationMetadata, getApplicationGrammar, getApplicationName } from './application-config';
import type { GrammarManifest } from '@sanyam/types';
import { GrammarRegistry } from './grammar-registry';

@injectable()
export class TheiaIDEAboutDialog extends AboutDialog {

    @inject(VSXEnvironment) @optional()
    protected readonly environment?: VSXEnvironment;

    @inject(WindowService)
    protected readonly windowService: WindowService;

    @inject(GrammarRegistry)
    protected readonly grammarRegistry: GrammarRegistry;

    protected vscodeApiVersion: string;

    constructor(
        @inject(AboutDialogProps) protected readonly props: AboutDialogProps
    ) {
        super(props);
    }

    protected async doInit(): Promise<void> {
        this.vscodeApiVersion = this.environment
            ? await this.environment.getVscodeApiVersion()
            : 'unknown';
        super.doInit();
    }

    /**
     * Get the primary grammar manifest based on applicationGrammar config.
     * Returns undefined if no applicationGrammar is configured or the grammar is not found.
     */
    protected getPrimaryGrammarManifest(): GrammarManifest | undefined {
        const grammarId = getApplicationGrammar();
        if (!grammarId) {
            return undefined;
        }
        return this.grammarRegistry.getManifest(grammarId);
    }

    protected render(): React.ReactNode {
        return <div className={ABOUT_CONTENT_CLASS}>
            {this.renderContent()}
        </div>;
    }

    protected renderContent(): React.ReactNode {
        return <div className='ad-container'>
            {this.renderTitle()}
            <hr className='gs-hr' />
            <div className='flex-grid'>
                <div className='col'>
                    {renderWhatIs(this.windowService)}
                </div>
            </div>
            <div className='flex-grid'>
                <div className='col'>
                    {renderSupport(this.windowService)}
                </div>
            </div>
            <div className='flex-grid'>
                <div className='col'>
                    {renderTickets(this.windowService)}
                </div>
            </div>
            {/*<div className='flex-grid'>
                <div className='col'>
                    {renderSourceCode(this.windowService)}
                </div>
            </div>*/}
            <div className='flex-grid'>
                <div className='col'>
                    {renderDocumentation(this.windowService)}
                </div>
            </div>
            <div className='flex-grid'>
                <div className='col'>
                    {renderDownloads()}
                </div>
            </div>
        </div>;

    }

    protected renderTitle(): React.ReactNode {
        const appData = getApplicationMetadata();
        const appName = getApplicationName();
        return <div className='gs-header'>
            {appData ? <h1>{appName}</h1> : this.renderDefaultHeader()}
            {this.renderVersion()}
        </div>;
    }

    /**
     * Resolves the effective logo for the application.
     * Priority order:
     * 1. Logo from primary grammar manifest (if applicationGrammar is configured)
     * 2. Application logo from applicationData
     * 3. Fallback default logo
     *
     * @returns The effective logo URL
     */
    protected resolveEffectiveLogo(): string {
        const appData = getApplicationMetadata();

        // First priority: logo from primary grammar manifest (if applicationGrammar configured)
        const manifest = this.getPrimaryGrammarManifest();
        if (manifest?.logo) {
            return manifest.logo;
        }

        // Second priority: application logo from applicationData
        if (appData?.logo) {
            return appData.logo;
        }

        // Fallback: default logo
        return 'resources/sanyam-banner.svg';
    }

    protected renderDefaultHeader(): React.ReactNode {
        return <h1>Sanyam <span className='gs-blue-header'>IDE</span></h1>;
    }

    protected renderApplicationHeader(appName: string, effectiveLogo: string): React.ReactNode {
        return <div className='gs-app-header'>
            <img src={effectiveLogo} alt={appName} className='gs-app-logo' />
            <h1>{appName}</h1>
        </div>;
    }

    protected renderVersion(): React.ReactNode {
        return <div>
            <p className='gs-sub-header' >
                {this.applicationInfo ? 'Version ' + this.applicationInfo.version : '-'}
            </p>

            <p className='gs-sub-header' >
                {'VS Code API Version: ' + this.vscodeApiVersion}
            </p>
        </div>;
    }
}
