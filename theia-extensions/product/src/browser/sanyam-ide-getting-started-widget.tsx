/********************************************************************************
 * Copyright (C) 2020 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import * as React from 'react';

import { codicon, Message } from '@theia/core/lib/browser';
import { PreferenceService } from '@theia/core/lib/common';
import { inject, injectable, optional } from '@theia/core/shared/inversify';
import {
    renderDocumentation, renderDownloads, renderExtendingCustomizing, renderSourceCode, renderSupport, renderTickets, renderWhatIs, renderCollaboration
} from './branding-util';

import { GettingStartedWidget } from '@theia/getting-started/lib/browser/getting-started-widget';
import { VSXEnvironment } from '@theia/vsx-registry/lib/common/vsx-environment';
import { WindowService } from '@theia/core/lib/browser/window/window-service';
import type { GrammarManifest, RootTypeConfig } from '@sanyam/types';
import { GrammarRegistry } from './grammar-registry';

@injectable()
export class TheiaIDEGettingStartedWidget extends GettingStartedWidget {

    @inject(VSXEnvironment) @optional()
    protected readonly environment?: VSXEnvironment;

    @inject(WindowService)
    protected readonly windowService: WindowService;

    @inject(PreferenceService)
    protected readonly preferenceService: PreferenceService;

    @inject(GrammarRegistry)
    protected readonly grammarRegistry: GrammarRegistry;

    protected vscodeApiVersion: string;

    protected async doInit(): Promise<void> {
        super.doInit();
        this.vscodeApiVersion = this.environment
            ? await this.environment.getVscodeApiVersion()
            : 'unknown';
        await this.preferenceService.ready;
        this.update();
    }

    protected onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        const htmlElement = document.getElementById('alwaysShowWelcomePage');
        if (htmlElement) {
            htmlElement.focus();
        }
    }

    protected render(): React.ReactNode {
        return <div className='gs-container'>
            <div className='gs-content-container'>
                <div className='gs-float'>
                    <div className='gs-logo'>
                    </div>
                    {this.renderActions()}
                </div>
                {this.renderHeader()}
                <hr className='gs-hr' />
                {this.renderInstalledGrammars()}
                <div className='flex-grid'>
                    <div className='col'>
                        {this.renderNews()}
                    </div>
                </div>
                <div className='flex-grid'>
                    <div className='col'>
                        {renderWhatIs(this.windowService)}
                    </div>
                </div>
                <div className='flex-grid'>
                    <div className='col'>
                        {renderExtendingCustomizing(this.windowService)}
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
                <div className='flex-grid'>
                    <div className='col'>
                        {renderSourceCode(this.windowService)}
                    </div>
                </div>
                <div className='flex-grid'>
                    <div className='col'>
                        {renderDocumentation(this.windowService)}
                    </div>
                </div>
                <div className='flex-grid'>
                    <div className='col'>
                        {this.renderAIBanner()}
                    </div>
                </div>
                <div className='flex-grid'>
                    <div className='col'>
                        {renderCollaboration(this.windowService)}
                    </div>
                </div>
                <div className='flex-grid'>
                    <div className='col'>
                        {renderDownloads()}
                    </div>
                </div>
            </div>
            <div className='gs-preference-container'>
                {this.renderPreferences()}
            </div>
        </div>;
    }

    protected renderActions(): React.ReactNode {
        return <div className='gs-container'>
            <div className='flex-grid'>
                <div className='col'>
                    {this.renderStart()}
                </div>
            </div>
            <div className='flex-grid'>
                <div className='col'>
                    {this.renderRecentWorkspaces()}
                </div>
            </div>
            <div className='flex-grid'>
                <div className='col'>
                    {this.renderSettings()}
                </div>
            </div>
            <div className='flex-grid'>
                <div className='col'>
                    {this.renderHelp()}
                </div>
            </div>
        </div>;
    }

    protected renderHeader(): React.ReactNode {
        return <div className='gs-header'>
            <h1>Sanyam <span className='gs-blue-header'>IDE</span></h1>
            {this.renderVersion()}
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

    protected renderAIBanner(): React.ReactNode {
        const framework = super.renderAIBanner();
        if (React.isValidElement<React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>>(framework)) {
            return React.cloneElement(framework, { className: 'gs-section' });
        }
        return framework;
    }

    /**
     * Renders the installed grammars section.
     */
    protected renderInstalledGrammars(): React.ReactNode {
        const manifests = this.grammarRegistry.manifests;
        if (manifests.length === 0) {
            return null;
        }

        return <div className='gs-section'>
            <h3 className='gs-section-header'>
                <i className={codicon('symbol-namespace')}></i>
                Installed Languages
            </h3>
            <div className='gs-grammar-list'>
                {manifests.map(m => this.renderGrammarCard(m))}
            </div>
        </div>;
    }

    /**
     * Renders a single grammar card.
     */
    protected renderGrammarCard(manifest: GrammarManifest): React.ReactNode {
        const rootTypeCount = manifest.rootTypes.length;
        const diagramCount = manifest.diagramTypes?.length ?? 0;

        return <div key={manifest.languageId} className='gs-grammar-card'>
            <div className='gs-grammar-header'>
                <span className='gs-grammar-name'>{manifest.displayName}</span>
                <span className='gs-grammar-ext'>{manifest.fileExtension}</span>
            </div>
            <div className='gs-grammar-details'>
                <span className='gs-grammar-stat'>
                    <i className={codicon('symbol-class')}></i>
                    {rootTypeCount} type{rootTypeCount !== 1 ? 's' : ''}
                </span>
                {manifest.diagrammingEnabled && diagramCount > 0 && (
                    <span className='gs-grammar-stat'>
                        <i className={codicon('type-hierarchy')}></i>
                        {diagramCount} diagram{diagramCount !== 1 ? 's' : ''}
                    </span>
                )}
            </div>
            <div className='gs-grammar-types'>
                {manifest.rootTypes.slice(0, 5).map((rt: RootTypeConfig, idx: number) => (
                    <span key={`${manifest.languageId}-${idx}`} className='gs-grammar-type-tag'>
                        {rt.displayName}
                    </span>
                ))}
                {rootTypeCount > 5 && (
                    <span className='gs-grammar-type-tag gs-grammar-more'>
                        +{rootTypeCount - 5} more
                    </span>
                )}
            </div>
        </div>;
    }
}
