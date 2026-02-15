/********************************************************************************
 * Copyright (C) 2020 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/
import { getApplicationMetadata } from './application-config';
import { DocsUrls } from './docs-config';
import { WindowService } from '@theia/core/lib/browser/window/window-service';
import * as React from 'react';

export interface ExternalBrowserLinkProps {
    text: string;
    url: string;
    windowService: WindowService;
}

function BrowserLink(props: ExternalBrowserLinkProps): JSX.Element {
    return <a
        role={'button'}
        tabIndex={0}
        href={props.url}
        target='_blank'
    >
        {props.text}
    </a>;
}

export function renderWhatIs(windowService: WindowService): React.ReactNode {
    const appData = getApplicationMetadata();
    return <div className='gs-section'>
        <h3 className='gs-section-header'>
            About This IDE
        </h3>
        <div>
            Sanyam is a modern semantic development environment for knowledge workers.  It is available for cloud and desktop and is based on the <BrowserLink text="Theia platform"
                url="https://sanyam-ide.org" windowService={windowService} ></BrowserLink>.
            {appData && appData.text && <span>
                {appData.text.map((paragraph, idx) => <p key={idx}>{paragraph}</p>)}</span>}
        </div>
        <div>
            The IDE is available as a <BrowserLink text="downloadable desktop application" url="https://sanyam-ide.org//#theiaidedownload"
                windowService={windowService} ></BrowserLink>. You can also <BrowserLink text="try the latest version of the Sanyam IDE online"
                    url="https://try.theia-cloud.io/" windowService={windowService} ></BrowserLink>. The online test version is limited to 30 minutes per session and hosted
            via <BrowserLink text="Theia Cloud" url="https://theia-cloud.io/" windowService={windowService} ></BrowserLink>.
        </div>
    </div>;
}

export function renderExtendingCustomizing(windowService: WindowService): React.ReactNode {
    return <div className='gs-section'>
        <h3 className='gs-section-header'>
            Extending/Customizing the Application
        </h3>
        <div >
            You can extend this application at runtime by installing VS Code extensions, e.g. from the <BrowserLink text="OpenVSX registry" url="https://open-vsx.org/"
                windowService={windowService} ></BrowserLink>, an open marketplace for VS Code extensions. Just open the extension view or browse <BrowserLink
                    text="OpenVSX online" url="https://open-vsx.org/" windowService={windowService} ></BrowserLink>.
        </div>
    </div>;
}

export function renderSupport(windowService: WindowService): React.ReactNode {
    return <div className='gs-section'>
        <h3 className='gs-section-header'>
            Professional Support
        </h3>
        <div>
            Professional support, implementation services, consulting and training for building tools like this and for building other tools based on the Sanyam Framework is
            available by selected companies as listed on the <BrowserLink text=" Sanyam support page" url="https://sanyam-ide.org/support/"
                windowService={windowService} ></BrowserLink>.
        </div>
    </div>;
}

export function renderTickets(windowService: WindowService): React.ReactNode {
    return <div className='gs-section'>
        <h3 className='gs-section-header'>
            Reporting feature requests and bugs
        </h3>
        <div >
            The features of this application are based on the Sanyam Framework and the included
            extensions/plugins. For bugs in the framework please consider opening an issue in
            the <BrowserLink text="Sanyam IDE project on Github" url="https://github.com/johnholliday/sanyam-ide/issues/new/choose"
                windowService={windowService} ></BrowserLink>.
        </div>
    </div>;
}

export function renderSourceCode(windowService: WindowService): React.ReactNode {
    return <div className='gs-section'>
        <h3 className='gs-section-header'>
            Source Code
        </h3>
        <div >
            The source code of Sanyam IDE is available
            on <BrowserLink text="Github" url="https://github.com/johnholliday/sanyam-ide"
                windowService={windowService} ></BrowserLink>.
        </div>
    </div>;
}

export function renderDocumentation(windowService: WindowService): React.ReactNode {
    return <div className='gs-section'>
        <h3 className='gs-section-header'>
            Documentation
        </h3>
        <div >
            Please see the <BrowserLink text="documentation" url={DocsUrls.gettingStarted()}
                windowService={windowService} ></BrowserLink> on how to use the IDE.
        </div>
    </div>;
}

export function renderCollaboration(windowService: WindowService): React.ReactNode {
    return <div className='gs-section'>
        <h3 className='gs-section-header'>
            Collaboration
        </h3>
        <div >
            The IDE features a built-in collaboration feature.
            You can share your workspace with others and work together in real-time by clicking on the <i>Collaborate</i> item in the status bar.
            The collaboration feature is powered by
            the <BrowserLink text="Open Collaboration Tools" url="https://www.open-collab.tools/" windowService={windowService} /> project
            and uses their public server infrastructure.
        </div>
    </div>;
}

export function renderDownloads(): React.ReactNode {
    return <div className='gs-section'>
        <h3 className='gs-section-header'>
            Updates and Downloads
        </h3>
        <div className='gs-action-container'>
            You can update Sanyam IDE directly in this application by navigating to
            File {'>'} Preferences {'>'} Check for Updates… Moreover the application will check for updates
            after each launch automatically.
        </div>
        <div className='gs-action-container'>
            Alternatively you can download the most recent version from the download page.
        </div>
    </div>;
}
