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
import { getApplicationMetadata } from './application-config';
import { ApplicationMetadata } from '@sanyam/types';

@injectable()
export class TheiaIDEAboutDialog extends AboutDialog {

    @inject(VSXEnvironment) @optional()
    protected readonly environment?: VSXEnvironment;

    @inject(WindowService)
    protected readonly windowService: WindowService;

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
        return <div className='gs-header'>
            {appData ? this.renderApplicationHeader(appData) : this.renderDefaultHeader()}
            {this.renderVersion()}
        </div>;
    }

    protected renderDefaultHeader(): React.ReactNode {
        return <h1>Sanyam <span className='gs-blue-header'>IDE</span></h1>;
    }

    protected renderApplicationHeader(appData: ApplicationMetadata): React.ReactNode {
        return <div className='gs-app-header'>
            {appData.logo && <img src={appData.logo} alt={appData.name} className='gs-app-logo' />}
            <h1>{appData.name}</h1>
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
