/********************************************************************************
 * Copyright (C) 2020 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { createLogger } from '@sanyam/logger';
import * as React from 'react';

import { codicon, Message } from '@theia/core/lib/browser';
import { PreferenceService } from '@theia/core/lib/common';
import { inject, injectable, optional } from '@theia/core/shared/inversify';
import {
    renderDocumentation, renderDownloads, renderExtendingCustomizing, /*renderSourceCode,*/ renderSupport, renderTickets, renderWhatIs, renderCollaboration
} from './branding-util';
import { DocsUrls } from './docs-config';

import { GettingStartedWidget } from '@theia/getting-started/lib/browser/getting-started-widget';
import { VSXEnvironment } from '@theia/vsx-registry/lib/common/vsx-environment';
import { WindowService } from '@theia/core/lib/browser/window/window-service';
import type { GrammarManifest, RootTypeConfig, ApplicationLink, KeyFeature, CoreConcept } from '@sanyam/types';
import { GrammarRegistry } from './grammar-registry';
import { getApplicationMetadata, getApplicationGrammar, getApplicationName } from './application-config';

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

    protected readonly logger = createLogger({ name: 'GettingStarted' });
    protected vscodeApiVersion: string;

    protected async doInit(): Promise<void> {
        super.doInit();
        this.vscodeApiVersion = this.environment
            ? await this.environment.getVscodeApiVersion()
            : 'unknown';
        await this.preferenceService.ready;
        this.update();
    }

    /**
     * Get the primary grammar manifest based on applicationGrammar config.
     * Returns undefined if no applicationGrammar is configured or the grammar is not found.
     */
    protected getPrimaryGrammarManifest(): GrammarManifest | undefined {
        const grammarId = getApplicationGrammar();
        this.logger.debug({ grammarId }, 'applicationGrammar lookup');
        this.logger.debug({ count: this.grammarRegistry.manifests.length }, 'registry manifests');
        if (!grammarId) {
            return undefined;
        }
        const manifest = this.grammarRegistry.getManifest(grammarId);
        this.logger.debug({ languageId: manifest?.languageId, displayName: manifest?.displayName }, 'found manifest');
        return manifest;
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
            {this.renderHeader()}
            {this.renderApplicationLinks()}
            <hr className='gs-hr' />
            <div className='gs-two-column'>
                <div className='gs-sidebar'>
                    {this.renderActions()}
                </div>
                <div className='gs-main-content'>
                    {this.renderGrammarDocumentation()}
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
                    <div className='gs-preference-container'>
                        {this.renderPreferences()}
                    </div>
                </div>
            </div>
        </div>;
    }

    protected renderActions(): React.ReactNode {
        return <>
            {this.renderStart()}
            {this.renderRecentWorkspaces()}
            {this.renderSettings()}
            {this.renderAIChat()}
            {this.renderHelp()}
        </>;
    }

    protected renderAIChat(): React.ReactNode {
        return <div className='gs-section'>
            <h3 className='gs-section-header'>
                <i className={codicon('hubot')}></i>
                AI Assistant
            </h3>
            <div className='gs-action-container'>
                <a
                    role='button'
                    tabIndex={0}
                    onClick={() => this.commandRegistry.executeCommand('aiChat:toggle')}
                    onKeyDown={(e: React.KeyboardEvent) => this.isEnterKey(e) && this.commandRegistry.executeCommand('aiChat:toggle')}>
                    Open AI Chat
                </a>
            </div>
        </div>;
    }

    protected renderNews(): React.ReactNode {
        return null;
    }

    /**
     * Override renderHelp to use the documentation URL from DocsUrls config.
     */
    protected renderHelp(): React.ReactNode {
        return <div className='gs-section'>
            <h3 className='gs-section-header'>
                <i className={codicon('question')}></i>
                Help
            </h3>
            <div className='gs-action-container'>
                <a
                    role='button'
                    tabIndex={0}
                    onClick={() => this.windowService.openNewWindow(DocsUrls.gettingStarted(), { external: true })}
                    onKeyDown={(e: React.KeyboardEvent) => this.isEnterKey(e) && this.windowService.openNewWindow(DocsUrls.gettingStarted(), { external: true })}>
                    Documentation
                </a>
            </div>
            <div className='gs-action-container'>
                <a
                    role='button'
                    tabIndex={0}
                    onClick={() => this.commandRegistry.executeCommand('workbench.action.showCommands')}
                    onKeyDown={(e: React.KeyboardEvent) => this.isEnterKey(e) && this.commandRegistry.executeCommand('workbench.action.showCommands')}>
                    Show All Commands
                </a>
            </div>
            <div className='gs-action-container'>
                <a
                    role='button'
                    tabIndex={0}
                    onClick={() => this.commandRegistry.executeCommand('workbench.action.openGlobalKeybindings')}
                    onKeyDown={(e: React.KeyboardEvent) => this.isEnterKey(e) && this.commandRegistry.executeCommand('workbench.action.openGlobalKeybindings')}>
                    Keyboard Shortcuts
                </a>
            </div>
        </div>;
    }

    protected renderHeader(): React.ReactNode {
        const appData = getApplicationMetadata();
        const effectiveLogo = this.resolveEffectiveLogo();
        const appName = getApplicationName();
        const manifest = this.getPrimaryGrammarManifest();

        // Resolve tagline: prefer manifest tagline, fall back to applicationData
        const tagline = manifest?.tagline ?? appData?.tagline;

        return <div className='gs-header'>
            {appData ? this.renderApplicationHeader(appName, effectiveLogo) : this.renderDefaultHeader()}
            {tagline && <p className='gs-tagline'>{tagline}</p>}
            {this.renderVersion()}
        </div>;
    }

    /**
     * Resolves the effective logo for the application.
     * Priority order:
     * 1. Explicit logo from primary grammar manifest
     * 2. Conventional grammar logo path (assets/logos/{languageId}.svg)
     * 3. Application logo from applicationData
     * 4. Fallback default logo
     *
     * @returns The effective logo URL
     */
    protected resolveEffectiveLogo(): string {
        const appData = getApplicationMetadata();
        const manifest = this.getPrimaryGrammarManifest();

        // First priority: explicit logo from primary grammar manifest
        if (manifest?.logo) {
            return manifest.logo;
        }

        // Second priority: conventional grammar logo path (webpack copies to assets/logos/)
        if (manifest?.languageId) {
            return `assets/logos/${manifest.languageId}.svg`;
        }

        // Third priority: application logo from applicationData
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
            {/*<h1>{appName}</h1>*/}
        </div>;
    }

    protected renderApplicationContent(): React.ReactNode {
        const appData = getApplicationMetadata();
        if (!appData?.text?.length) {
            return null;
        }
        return <div className='gs-app-content gs-section'>
            {appData.text.map((paragraph, idx) => <p key={idx}>{paragraph}</p>)}
        </div>;
    }

    protected renderApplicationLinks(): React.ReactNode {
        const appData = getApplicationMetadata();
        if (!appData?.links?.length) {
            return null;
        }
        return <div className='gs-app-links'>
            <div className='gs-links-list'>
                {appData.links.map((link, idx) => this.renderApplicationLink(link, idx))}
            </div>
        </div>;
    }

    protected renderApplicationLink(link: ApplicationLink, index: number): React.ReactNode {
        // Use DocsUrls for Documentation links instead of the static URL from config
        const effectiveUrl = link.label.toLowerCase() === 'documentation'
            ? DocsUrls.home()
            : link.url;

        return <a
            key={index}
            href={effectiveUrl}
            className='gs-link-item'
            onClick={e => {
                e.preventDefault();
                this.windowService.openNewWindow(effectiveUrl, { external: true });
            }}
        >
            {link.icon && <i className={codicon(link.icon)}></i>}
            <span>{link.label}</span>
        </a>;
    }

    protected renderVersion(): React.ReactNode {
        return <div className='gs-version-row'>
            <span className='gs-sub-header'>
                {this.applicationInfo ? 'Version ' + this.applicationInfo.version : '-'}
            </span>
            <span className='gs-sub-header'>
                {'VS Code API: ' + this.vscodeApiVersion}
            </span>
        </div>;
    }

    protected renderAIBanner(): React.ReactNode {
        return <div className='gs-section'>
            <h3 className='gs-section-header'>
                <i className={codicon('hubot')}></i>
                AI Features
            </h3>
            <div>
                This IDE includes built-in AI capabilities powered by multiple providers including
                Anthropic Claude, OpenAI GPT, Google Gemini, Ollama, and more. AI features include:
            </div>
            <ul className='gs-ai-features'>
                <li><strong>AI Chat</strong> — Interactive chat assistant for coding help and questions</li>
                <li><strong>Code Completion</strong> — AI-powered code suggestions as you type</li>
                <li><strong>Terminal AI</strong> — Get help with terminal commands</li>
                <li><strong>MCP Support</strong> — Connect to Model Context Protocol servers</li>
            </ul>
            <div>
                Configure your AI providers in File {'>'} Preferences {'>'} Settings and search for "AI".
            </div>
        </div>;
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

    // =========================================================================
    // Grammar Documentation Rendering (from GrammarManifest)
    // =========================================================================

    /**
     * Renders the grammar documentation section from the primary grammar manifest.
     * This includes summary, key features, core concepts, and quick example.
     */
    protected renderGrammarDocumentation(): React.ReactNode {
        const manifest = this.getPrimaryGrammarManifest();
        if (!manifest) {
            return null;
        }

        // Check if manifest has any documentation content
        const hasContent = manifest.summary || manifest.keyFeatures?.length || manifest.coreConcepts?.length || manifest.quickExample;
        if (!hasContent) {
            return null;
        }

        return <div className='gs-grammar-documentation'>
            {this.renderGrammarSummary(manifest)}
            {this.renderKeyFeatures(manifest)}
            {this.renderCoreConcepts(manifest)}
            {this.renderQuickExample(manifest)}
        </div>;
    }

    /**
     * Renders the grammar summary.
     */
    protected renderGrammarSummary(manifest: GrammarManifest): React.ReactNode {
        if (!manifest.summary) {
            return null;
        }
        return <div className='gs-section'>
            <h3 className='gs-section-header'>
                <i className={codicon('info')}></i>
                About {manifest.displayName}
            </h3>
            <p>{manifest.summary}</p>
        </div>;
    }

    /**
     * Renders the key features list.
     */
    protected renderKeyFeatures(manifest: GrammarManifest): React.ReactNode {
        if (!manifest.keyFeatures?.length) {
            return null;
        }
        return <div className='gs-section'>
            <h3 className='gs-section-header'>
                <i className={codicon('star')}></i>
                Key Features
            </h3>
            <ul className='gs-feature-list'>
                {manifest.keyFeatures.map((kf: KeyFeature, idx: number) => (
                    <li key={idx}>
                        <strong>{kf.feature}</strong> — {kf.description}
                    </li>
                ))}
            </ul>
        </div>;
    }

    /**
     * Renders the core concepts list.
     */
    protected renderCoreConcepts(manifest: GrammarManifest): React.ReactNode {
        if (!manifest.coreConcepts?.length) {
            return null;
        }
        return <div className='gs-section'>
            <h3 className='gs-section-header'>
                <i className={codicon('symbol-class')}></i>
                Core Concepts
            </h3>
            <div className='gs-concepts-grid'>
                {manifest.coreConcepts.map((cc: CoreConcept, idx: number) => (
                    <div key={idx} className='gs-concept-item'>
                        <span className='gs-concept-name'>{cc.concept}</span>
                        <span className='gs-concept-desc'>{cc.description}</span>
                    </div>
                ))}
            </div>
        </div>;
    }

    /**
     * Renders the quick example code block.
     */
    protected renderQuickExample(manifest: GrammarManifest): React.ReactNode {
        if (!manifest.quickExample) {
            return null;
        }
        return <div className='gs-section'>
            <h3 className='gs-section-header'>
                <i className={codicon('code')}></i>
                Quick Example
            </h3>
            <pre className='gs-code-example'><code>{manifest.quickExample}</code></pre>
        </div>;
    }
}
