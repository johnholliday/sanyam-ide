---
description: Generate user-facing IDE documentation site with grammar package docs integration
---

## User Input

```text
$ARGUMENTS
```

## Overview

Generate a complete Eleventy documentation site for IDE end-users (NOT developers) into the root `/docs` folder. This site:
- Aggregates documentation from configured grammar packages
- Publishes locally via Docker
- Integrates with the IDE via environment variable URLs
- Modifies getting-started-widget and about-dialog to use the generated URLs

## Step 1: Read Application Configuration

Read `applications/browser/package.json` and extract:

1. **applicationName**: From `theia.frontend.config.applicationName` (e.g., "E C M L")
2. **applicationGrammar**: From `theia.frontend.config.applicationGrammar` (e.g., "ecml")
3. **productName**: From root `productName` field or `description`

Set variables:
- `appName` = the applicationName value
- `appNameNormalized` = applicationName with spaces removed, uppercased (e.g., "ECML")
- `primaryGrammar` = applicationGrammar value
- `envVarName` = `{appNameNormalized}_DOCS_URL` (e.g., "ECML_DOCS_URL")

### 1.1 Resolve Application Logo

Resolve the effective logo using the same priority as the getting-started-widget:

1. **First priority**: Check if the grammar manifest has an explicit `logo` field
   - Read `packages/grammar-definitions/{primaryGrammar}/src/manifest.ts` and look for `logo:` property

2. **Second priority**: Check for conventional grammar logo path
   - Look for `packages/grammar-definitions/{primaryGrammar}/assets/logos/{primaryGrammar}.svg`

3. **Third priority**: Check applicationData logo from package.json
   - Use `theia.frontend.config.applicationData.logo` value (e.g., "resources/sanyam-banner.svg")
   - Resolve relative to `applications/browser/`

4. **Fallback**: Use default logo
   - `applications/browser/resources/sanyam-banner.svg`

Set variable:
- `effectiveLogo` = the resolved logo path (absolute path to the source file)

Copy the resolved logo to `docs/images/logo.svg`.

## Step 2: Validate Grammar Documentation Exists

**CRITICAL**: Check if grammar documentation exists before proceeding.

1. Check if `packages/grammar-definitions/{primaryGrammar}/docs/` directory exists
2. Check if it contains `eleventy.config.js` (indicator of generated docs)

**If grammar docs do NOT exist, STOP IMMEDIATELY with this error:**

```
ERROR: No documentation found for grammar '{primaryGrammar}'

The /docgen skill requires pre-generated grammar documentation to include in the IDE user documentation.

To fix this:
1. Run: /grammar.docs {primaryGrammar}
2. Then re-run: /docgen

The /grammar.docs skill will generate comprehensive language documentation that /docgen
will then integrate into the user-facing IDE documentation site.
```

## Step 3: Create Documentation Site Structure

Create the root `/docs` folder structure:

### 3.1 Create `docs/eleventy.config.js`

```javascript
import syntaxHighlight from '@11ty/eleventy-plugin-syntaxhighlight';
import eleventyNavigationPlugin from '@11ty/eleventy-navigation';
import { cpSync, existsSync } from 'fs';
import path from 'path';

export default function(eleventyConfig) {
  // Plugins
  eleventyConfig.addPlugin(syntaxHighlight);
  eleventyConfig.addPlugin(eleventyNavigationPlugin);

  // Pass through assets
  eleventyConfig.addPassthroughCopy('assets');
  eleventyConfig.addPassthroughCopy('images');

  // Filters
  eleventyConfig.addFilter('readableDate', (dateObj) => {
    if (!dateObj) return '';
    const date = new Date(dateObj);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  });

  // Table of Contents filter
  eleventyConfig.addFilter('toc', (content) => {
    if (!content) return '';
    const headingRegex = /<h([23])(?:[^>]*)>([^<]+)<\/h[23]>/gi;
    const headings = [];
    let match;
    while ((match = headingRegex.exec(content)) !== null) {
      const level = parseInt(match[1], 10);
      const text = match[2].trim();
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      headings.push({ level, id, text });
    }
    if (headings.length === 0) return '';
    let html = '<ul class="toc-list">';
    for (const heading of headings) {
      const indent = heading.level === 3 ? ' class="toc-nested"' : '';
      html += `<li${indent}><a href="#${heading.id}">${heading.text}</a></li>`;
    }
    html += '</ul>';
    return html;
  });

  // Add IDs to headings for TOC linking
  eleventyConfig.addTransform('addHeadingIds', (content, outputPath) => {
    if (!outputPath || !outputPath.endsWith('.html')) return content;
    return content.replace(/<h([23])([^>]*)>([^<]*)<\/h([23])>/gi, (match, level, attrs, text, closeLevel) => {
      if (attrs.includes('id=')) return match;
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      return `<h${level} id="${id}"${attrs}>${text}</h${closeLevel}>`;
    });
  });

  // Collections
  eleventyConfig.addCollection('docs', (collectionApi) => {
    return collectionApi.getFilteredByGlob(['**/*.md', '!README.md']).sort((a, b) => {
      const orderA = a.data.eleventyNavigation?.order ?? 999;
      const orderB = b.data.eleventyNavigation?.order ?? 999;
      return orderA - orderB;
    });
  });

  return {
    dir: {
      input: '.',
      output: '_site',
      includes: '_includes',
      data: '_data'
    },
    markdownTemplateEngine: 'njk',
    htmlTemplateEngine: 'njk',
    templateFormats: ['md', 'njk', 'html']
  };
}
```

### 3.2 Create `docs/package.json`

Replace `{appName}` and `{appNameNormalized}` with actual values:

```json
{
  "name": "{appNameNormalized}-docs",
  "private": true,
  "type": "module",
  "description": "User documentation for {appName}",
  "scripts": {
    "build": "eleventy",
    "dev": "eleventy --serve",
    "start": "eleventy --serve",
    "preview": "eleventy --serve --port 8080",
    "clean": "rimraf _site",
    "docker:build": "docker build -t {appNameNormalized}-docs .",
    "docker:run": "docker run -d -p 4000:80 --name {appNameNormalized}-docs {appNameNormalized}-docs",
    "docker:stop": "docker stop {appNameNormalized}-docs && docker rm {appNameNormalized}-docs"
  },
  "devDependencies": {
    "@11ty/eleventy": "^3.0.0",
    "@11ty/eleventy-navigation": "^0.3.5",
    "@11ty/eleventy-plugin-syntaxhighlight": "^5.0.0",
    "rimraf": "^5.0.0"
  }
}
```

### 3.3 Create `docs/Dockerfile`

```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

# Production stage
FROM nginx:alpine
COPY --from=builder /app/_site /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 3.4 Create `docs/nginx.conf`

```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Enable gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;

    # Cache static assets
    location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ $uri.html /index.html;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
}
```

### 3.5 Create `docs/.gitignore`

```text
# Dependencies
node_modules/

# Build output
_site/

# Editor
.DS_Store
*.swp
```

### 3.6 Create `docs/_data/site.json`

Replace placeholders with actual values. Include `logo` field only if a logo was resolved in Step 1.1:

```json
{
  "title": "{appName} Documentation",
  "description": "User guide and reference documentation for {appName}",
  "language": "en",
  "applicationName": "{appName}",
  "grammarId": "{primaryGrammar}",
  "docsUrl": "${envVarName}",
  "logo": "/images/logo.svg"
}
```

**Note**: The `logo` field should only be included if `effectiveLogo` was successfully resolved and copied to `docs/images/logo.svg`.

### 3.7 Create `docs/_data/navigation.json`

```json
{
  "main": [
    { "text": "Home", "url": "/" },
    { "text": "Getting Started", "url": "/getting-started/" },
    { "text": "User Guide", "url": "/guide/" },
    { "text": "Language Reference", "url": "/language/" },
    { "text": "Examples", "url": "/examples/" }
  ]
}
```

## Step 4: Create Layout Templates

### 4.1 Create `docs/_includes/layouts/base.njk`

Use the same base layout template from `/grammar.docs` but update:
- Site title references to use `{{ site.title }}`
- Footer text to reference the application name

### 4.2 Create `docs/_includes/layouts/doc.njk`

Copy the doc layout from `/grammar.docs`.

### 4.3 Create `docs/_includes/layouts/home.njk`

Create a two-column layout with optional logo on the left:

```njk
{% extends "layouts/base.njk" %}

{% block main %}
<div class="home-layout">
  {% if site.logo %}
  <div class="home-logo-column">
    <img src="{{ site.logo }}" alt="{{ site.applicationName }}" class="home-logo-img" />
  </div>
  {% endif %}
  <div class="home-content prose">
    {{ content | safe }}
  </div>
</div>
{% endblock %}
```

## Step 5: Create User-Facing Content Pages

**IMPORTANT**: All content must be written for IDE END-USERS, not developers.

### 5.1 Create `docs/index.md` (Homepage)

```yaml
---
title: "Welcome"
layout: layouts/home.njk
eleventyNavigation:
  key: Home
  order: 1
---
```

Content should include:
- Welcome message for users
- What the IDE helps them accomplish
- Quick links to key sections
- Feature highlights (text editing, diagram editing, validation, etc.)

### 5.2 Create `docs/getting-started/index.md`

```yaml
---
title: "Getting Started"
layout: layouts/doc.njk
eleventyNavigation:
  key: Getting Started
  order: 2
---
```

Content should include:
- How to open/create a new file
- Basic editor overview
- Key UI elements (sidebar, editor, properties panel)
- First steps for new users

### 5.3 Create `docs/guide/index.md`

```yaml
---
title: "User Guide"
layout: layouts/doc.njk
eleventyNavigation:
  key: User Guide
  order: 3
---
```

Content should include:
- Working with files
- Using the diagram editor
- Properties panel usage
- Keyboard shortcuts
- Preferences and settings

## Step 6: Integrate Grammar Documentation

**CRITICAL**: Copy and adapt content from the grammar package documentation.

1. Read all `.md` files from `packages/grammar-definitions/{primaryGrammar}/docs/`
2. For each content page (language reference, examples, etc.):
   - Copy to appropriate location in `docs/`
   - Update front matter to fit the user docs navigation
   - Adjust heading levels if needed
   - Ensure language is user-appropriate (not developer-focused)

### 6.1 Create `docs/language/index.md`

Adapt from grammar docs `language/index.md` or `language/reference.md`:

```yaml
---
title: "Language Reference"
layout: layouts/doc.njk
eleventyNavigation:
  key: Language Reference
  order: 4
---
```

### 6.2 Create `docs/language/quick-reference.md`

Copy from grammar docs if exists.

### 6.3 Create `docs/examples/index.md`

```yaml
---
title: "Examples"
layout: layouts/doc.njk
eleventyNavigation:
  key: Examples
  order: 5
---
```

Copy example pages from grammar docs `examples/` directory.

## Step 7: Create CSS Assets

Copy the CSS files from the grammar docs or create new ones at:
- `docs/assets/css/main.css`
- `docs/assets/css/prism-theme.css`

**Important**: Ensure the `main.css` includes the two-column home layout styles:

```css
/* Home Layout - two column with optional logo */
.home-layout {
  display: flex;
  flex-direction: row;
  max-width: calc(var(--content-max-width) + 220px);
  margin: 0 auto;
  padding: var(--space-10) var(--space-6);
}

/* Home Logo Column */
.home-logo-column {
  flex-shrink: 0;
  width: 200px;
  padding-top: var(--space-4);
  padding-right: var(--space-6);
}

.home-logo-img {
  max-width: 180px;
  height: auto;
}

@media (max-width: 768px) {
  .home-layout {
    flex-direction: column;
  }

  .home-logo-column {
    width: 100%;
    padding-right: 0;
    padding-bottom: var(--space-4);
    text-align: center;
  }

  .home-logo-img {
    max-width: 150px;
  }
}
```

## Step 8: Update IDE Integration

### 8.1 Create Environment Variable Configuration Module

Create `packages/theia-extensions/product/src/browser/docs-config.ts`:

```typescript
/**
 * Documentation URL configuration module.
 * Reads the documentation URL from environment variable at runtime.
 */

// Environment variable name for docs URL (generated by /docgen)
const DOCS_ENV_VAR = '{envVarName}';

// Default fallback URL (local Docker instance)
const DEFAULT_DOCS_URL = 'http://localhost:4000';

/**
 * Gets the documentation base URL from environment or falls back to default.
 */
export function getDocsUrl(): string {
    // In browser context, env vars are typically injected at build time
    // or via window object. Check both patterns.
    const envUrl = (globalThis as Record<string, unknown>)[DOCS_ENV_VAR] as string | undefined
        ?? (typeof process !== 'undefined' ? process.env?.[DOCS_ENV_VAR] : undefined);

    return envUrl || DEFAULT_DOCS_URL;
}

/**
 * Documentation URL paths for IDE integration.
 */
export const DocsUrls = {
    home: () => getDocsUrl(),
    gettingStarted: () => `${getDocsUrl()}/getting-started/`,
    userGuide: () => `${getDocsUrl()}/guide/`,
    languageReference: () => `${getDocsUrl()}/language/`,
    examples: () => `${getDocsUrl()}/examples/`,
} as const;
```

### 8.2 Update `branding-util.tsx`

Modify `packages/theia-extensions/product/src/browser/branding-util.tsx`:

1. Import the docs config:
   ```typescript
   import { DocsUrls } from './docs-config';
   ```

2. Update `renderDocumentation()` function to use `DocsUrls.gettingStarted()` instead of hard-coded URL

3. Update any other documentation links to use the DocsUrls helper

### 8.3 Update Getting Started Widget

Modify `packages/theia-extensions/product/src/browser/sanyam-ide-getting-started-widget.tsx`:

1. Import DocsUrls
2. Add a "Documentation" link that uses `DocsUrls.home()`

### 8.4 Update About Dialog

Modify `packages/theia-extensions/product/src/browser/sanyam-ide-about-dialog.tsx`:

1. Ensure it uses the updated `branding-util.tsx` functions

## Step 9: Install Dependencies

```bash
cd docs && pnpm install
```

## Step 10: Build and Run Docker Container

After generating all files and installing dependencies, build and run the Docker container:

```bash
cd docs && pnpm run docker:build
```

If the build succeeds, start the container:

```bash
cd docs && pnpm run docker:run
```

Verify the documentation site is running by checking:
- Container status: `docker ps | grep {appNameNormalized}-docs`
- Site accessibility: The site should be available at http://localhost:4000

If a container with the same name already exists, stop and remove it first:

```bash
docker stop {appNameNormalized}-docs 2>/dev/null || true
docker rm {appNameNormalized}-docs 2>/dev/null || true
```

Then retry the docker:run command.

## Step 11: Generate Environment Variable Instructions

After generating all files, output the following instructions to the user:

```
=============================================================================
Documentation Site Generated Successfully!
=============================================================================

Environment Variable Configuration
----------------------------------

To configure the documentation URL in your environment, set:

  {envVarName}=<your-docs-url>

Examples:
  # Local Docker (default)
  export {envVarName}=http://localhost:4000

  # Production deployment
  export {envVarName}=https://docs.your-domain.com

Running the Documentation Site
------------------------------

Development (with hot reload):
  cd docs && pnpm run dev

Production via Docker:
  cd docs
  pnpm run docker:build
  pnpm run docker:run

  Documentation will be available at: http://localhost:4000

Stopping Docker:
  cd docs && pnpm run docker:stop

IDE Integration
---------------

The getting-started-widget and about-dialog have been updated to read the
documentation URL from the {envVarName} environment variable.

If the environment variable is not set, the IDE will default to:
  http://localhost:4000

For production deployments, ensure the environment variable is set before
building/running the IDE.

=============================================================================
```

## Summary

After successful generation, report:

1. List of all created/updated files
2. Number of grammar documentation pages integrated
3. Environment variable name: `{envVarName}`
4. Commands to run the documentation site

## Error Handling

- If `applications/browser/package.json` not found: Report error with expected path
- If `applicationGrammar` not configured: Report error explaining the requirement
- If grammar docs not found: Report error with instructions to run `/grammar.docs` first
- If `docs/` already exists: Ask user whether to overwrite or merge
