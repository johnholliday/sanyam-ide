---
description: Generate a complete Eleventy documentation site for the {name} grammar
---

## User Input

```text
$ARGUMENTS
```

## Input Resolution

The argument `$ARGUMENTS` should be one of:

1. **Path to a .langium file** (e.g., `packages/grammar-definitions/.source/{name}.langium` or absolute path)
2. **Grammar name** to search for in the `packages/grammar-definitions/` directory (e.g., `ecml`, `spdevkit`, `garp`)

### Step 1: Resolve the Grammar File

1. If `$ARGUMENTS` is empty, ask the user to provide a grammar file path or name
2. If `$ARGUMENTS` ends with `.langium`, treat it as a file path:
   - If relative, resolve from the current working directory
   - Read the file directly
3. If `$ARGUMENTS` doesn't end with `.langium`, search for a matching grammar in the following order:
   - **FIRST**: Check `packages/grammar-definitions/.source/{name}.langium` (master source - PRIMARY)
   - **SECOND**: Check `packages/grammar-definitions/{name}/src/{name}.langium` (existing package)
   - Use the first location where the file exists
   - If no matches found, report the error and stop

Set:
- `grammarPath` = the found file path
- `packageDir` = `packages/grammar-definitions/{name}/` (target package directory)
- `sourcePath` = `packages/grammar-definitions/.source/{name}.langium` (master source location)

## Overview

Generate a fully-functional Eleventy (11ty) documentation website for the {name} grammar. This includes the complete site infrastructure with three-column layout (sidebar, content, table of contents), light/dark theme toggle, and integration of any existing examples.

## Step 1: Ensure 11ty Infrastructure Exists

Check if `docs/{name}/eleventy.config.js` exists. If not, create the complete 11ty site structure.

### Required Files

**1. Create `docs/{name}/eleventy.config.js`:**

```javascript
import syntaxHighlight from '@11ty/eleventy-plugin-syntaxhighlight';
import eleventyNavigationPlugin from '@11ty/eleventy-navigation';

export default function(eleventyConfig) {
  // Plugins
  eleventyConfig.addPlugin(syntaxHighlight);
  eleventyConfig.addPlugin(eleventyNavigationPlugin);

  // Pass through assets
  eleventyConfig.addPassthroughCopy('assets');

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

  // Table of Contents filter - extracts h2 and h3 headings from HTML content
  eleventyConfig.addFilter('toc', (content) => {
    if (!content) return '';

    // Match h2 and h3 headings - extract text and generate IDs
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
      html += \`<li\${indent}><a href="#\${heading.id}">\${heading.text}</a></li>\`;
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
      return \`<h\${level} id="\${id}"\${attrs}>\${text}</h\${closeLevel}>\`;
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

**2. Create `docs/{name}/package.json`:**

```json
{
  "name": "sanyam-grammar/{name}-docs",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "eleventy",
    "dev": "eleventy --serve",
    "preview": "eleventy --serve --port 8080",
    "clean": "rimraf _site"
  },
  "devDependencies": {
    "@11ty/eleventy": "^3.0.0",
    "@11ty/eleventy-navigation": "^1.0.5",
    "@11ty/eleventy-plugin-syntaxhighlight": "^5.0.0",
    "rimraf": "^5.0.0"
  }
}
```

**3. Create `docs/{name}/.gitignore`:**

```text
# Dependencies
node_modules/

# Build output
_site/

# Editor
.DS_Store
*.swp
```

**4. Create `docs/{name}/_includes/layouts/base.njk`:**

```html
<!DOCTYPE html>
<html lang="{{ site.language or 'en' }}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{ title }} | {{ site.title }}</title>
  <meta name="description" content="{{ description or site.description }}">

  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">

  <!-- Styles -->
  <link rel="stylesheet" href="/assets/css/main.css">
  <link rel="stylesheet" href="/assets/css/prism-theme.css">

  {% block head %}{% endblock %}
</head>
<body>
  <div class="site-wrapper">
    <!-- Skip link -->
    <a href="#main-content" class="skip-link">Skip to main content</a>

    <!-- Header -->
    <header class="site-header">
      <div class="header-inner">
        <a href="/" class="logo">
          <span class="logo-text">{{ site.title }}</span>
        </a>

        <nav class="main-nav" aria-label="Main navigation">
          <ul class="nav-list">
            {% for item in navigation.main %}
            <li>
              <a href="{{ item.url }}" {% if page.url == item.url %}aria-current="page"{% endif %}>
                {{ item.text }}
              </a>
            </li>
            {% endfor %}
          </ul>
        </nav>

        <!-- Theme Toggle -->
        <button class="theme-toggle" id="theme-toggle" aria-label="Toggle dark mode">
          <svg class="icon-sun" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
          </svg>
          <svg class="icon-moon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
        </button>

        <button class="mobile-menu-toggle" aria-label="Toggle menu" aria-expanded="false">
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    </header>

    <!-- Main content -->
    <main id="main-content" class="site-main">
      {% block main %}
      {{ content | safe }}
      {% endblock %}
    </main>

    <!-- Footer -->
    <footer class="site-footer">
      <div class="footer-inner">
        <p class="footer-meta">
          {{ site.title }} Documentation · Built with <a href="https://www.11ty.dev/">Eleventy</a>
        </p>
      </div>
    </footer>
  </div>

  <!-- Theme Toggle Script -->
  <script>
    (function() {
      const toggle = document.getElementById('theme-toggle');
      function getTheme() {
        const stored = localStorage.getItem('theme');
        if (stored) return stored;
        return 'dark';
      }
      function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
      }
      setTheme(getTheme());
      toggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        setTheme(current === 'dark' ? 'light' : 'dark');
      });
    })();
  </script>

  {% block scripts %}{% endblock %}
</body>
</html>
```

**5. Create `docs/{name}/_includes/layouts/doc.njk`:**

```html
{% extends "layouts/base.njk" %}

{% block main %}
<div class="doc-layout">
  <!-- Sidebar navigation -->
  <aside class="doc-sidebar">
    <nav class="sidebar-nav" aria-label="Documentation navigation">
      {% set navPages = collections.all | eleventyNavigation %}
      <ul class="nav-tree">
        {% for entry in navPages %}
        <li class="nav-item{% if entry.url == page.url %} is-active{% endif %}">
          <a href="{{ entry.url }}">{{ entry.title }}</a>
          {% if entry.children.length %}
          <ul class="nav-children">
            {% for child in entry.children %}
            <li class="nav-item{% if child.url == page.url %} is-active{% endif %}">
              <a href="{{ child.url }}">{{ child.title }}</a>
            </li>
            {% endfor %}
          </ul>
          {% endif %}
        </li>
        {% endfor %}
      </ul>
    </nav>
  </aside>

  <!-- Main content area -->
  <article class="doc-content">
    <!-- Page header -->
    <header class="doc-header">
      <h1>{{ title }}</h1>
      {% if description %}
      <p class="doc-description">{{ description }}</p>
      {% endif %}
    </header>

    <!-- Main content -->
    <div class="doc-body prose">
      {{ content | safe }}
    </div>
  </article>

  <!-- Table of contents -->
  {% set tocContent = content | toc %}
  {% if tocContent %}
  <aside class="doc-toc">
    <nav class="toc-nav" aria-label="Table of contents">
      <h2 class="toc-title">On this page</h2>
      {{ tocContent | safe }}
    </nav>
  </aside>
  {% endif %}
</div>
{% endblock %}
```

**6. Create `docs/{name}/_includes/layouts/home.njk`:**

```html
{% extends "layouts/base.njk" %}

{% block main %}
<div class="home-layout">
  <div class="home-content prose">
    {{ content | safe }}
  </div>
</div>
{% endblock %}
```

**7. Create `docs/{name}/_data/site.json`:**

Replace `{name}` with the resolved grammar name (e.g., "ECML", "SPDevKit") and `<ext>` with the file extension:

```json
{
  "title": "{name}",
  "description": "Documentation for the {name} language",
  "language": "en",
  "languageId": "<grammarName-lowercase>",
  "fileExtension": ".<ext>"
}
```

**8. Create `docs/{name}/_data/navigation.json`:**

```json
{
  "main": [
    { "text": "Home", "url": "/" },
    { "text": "Getting Started", "url": "/getting-started/" },
    { "text": "Language", "url": "/language/" },
    { "text": "Examples", "url": "/examples/" }
  ]
}
```

**9. Create `docs/{name}/assets/css/main.css`:**

```css
/* ==========================================================================
   Grammar Documentation - Main Stylesheet
   ========================================================================== */

/* --------------------------------------------------------------------------
   CSS Variables
   -------------------------------------------------------------------------- */

:root {
  /* Colors */
  --color-bg: #ffffff;
  --color-bg-alt: #f8f9fa;
  --color-bg-code: #f1f3f5;
  --color-text: #212529;
  --color-text-muted: #6c757d;
  --color-text-light: #adb5bd;
  --color-primary: #4263eb;
  --color-primary-dark: #364fc7;
  --color-accent: #15aabf;
  --color-border: #dee2e6;
  --color-border-light: #e9ecef;

  /* Semantic colors */
  --color-success: #37b24d;
  --color-warning: #f59f00;
  --color-error: #f03e3e;
  --color-info: #1c7ed6;

  /* Typography */
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;

  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.25rem;
  --text-2xl: 1.5rem;
  --text-3xl: 1.875rem;
  --text-4xl: 2.25rem;

  /* Spacing */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.25rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-10: 2.5rem;
  --space-12: 3rem;
  --space-16: 4rem;

  /* Layout */
  --sidebar-width: 280px;
  --toc-width: 220px;
  --content-max-width: 800px;
  --header-height: 64px;

  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-base: 200ms ease;

  /* Border radius */
  --radius-sm: 4px;
  --radius: 6px;
  --radius-lg: 8px;
}

/* Dark mode via data-theme attribute */
[data-theme="dark"] {
  --color-bg: #1a1b26;
  --color-bg-alt: #24283b;
  --color-bg-code: #1f2335;
  --color-text: #c0caf5;
  --color-text-muted: #9aa5ce;
  --color-text-light: #565f89;
  --color-primary: #7aa2f7;
  --color-primary-dark: #5d87f0;
  --color-accent: #2ac3de;
  --color-border: #414868;
  --color-border-light: #32394a;
}

/* Theme Toggle Button */
.theme-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  background: transparent;
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius);
  cursor: pointer;
  color: var(--color-text-muted);
  transition: all var(--transition-fast);
}

.theme-toggle:hover {
  background: var(--color-bg-alt);
  color: var(--color-text);
  border-color: var(--color-border);
}

/* Show sun in dark mode, moon in light mode */
[data-theme="dark"] .icon-sun,
:root:not([data-theme="dark"]) .icon-moon {
  display: block;
}

[data-theme="dark"] .icon-moon,
:root:not([data-theme="dark"]) .icon-sun {
  display: none;
}

/* --------------------------------------------------------------------------
   Reset & Base
   -------------------------------------------------------------------------- */

*, *::before, *::after {
  box-sizing: border-box;
}

html {
  font-size: 16px;
  scroll-behavior: smooth;
  scroll-padding-top: calc(var(--header-height) + var(--space-4));
}

body {
  margin: 0;
  font-family: var(--font-sans);
  font-size: var(--text-base);
  line-height: 1.6;
  color: var(--color-text);
  background-color: var(--color-bg);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* --------------------------------------------------------------------------
   Skip Link
   -------------------------------------------------------------------------- */

.skip-link {
  position: absolute;
  top: -100%;
  left: var(--space-4);
  z-index: 1000;
  padding: var(--space-2) var(--space-4);
  background: var(--color-primary);
  color: white;
  border-radius: var(--radius);
  text-decoration: none;
}

.skip-link:focus {
  top: var(--space-4);
}

/* --------------------------------------------------------------------------
   Layout
   -------------------------------------------------------------------------- */

.site-wrapper {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.site-main {
  flex: 1;
}

/* --------------------------------------------------------------------------
   Header
   -------------------------------------------------------------------------- */

.site-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--color-bg);
  border-bottom: 1px solid var(--color-border-light);
  height: var(--header-height);
}

.header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1440px;
  margin: 0 auto;
  padding: 0 var(--space-6);
  height: 100%;
}

.logo {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  text-decoration: none;
  color: var(--color-text);
  font-weight: 600;
  font-size: var(--text-lg);
}

.main-nav .nav-list {
  display: flex;
  gap: var(--space-6);
  list-style: none;
  margin: 0;
  padding: 0;
}

.main-nav a {
  color: var(--color-text-muted);
  text-decoration: none;
  font-size: var(--text-sm);
  font-weight: 500;
  transition: color var(--transition-fast);
}

.main-nav a:hover,
.main-nav a[aria-current="page"] {
  color: var(--color-primary);
}

.mobile-menu-toggle {
  display: none;
}

/* --------------------------------------------------------------------------
   Doc Layout
   -------------------------------------------------------------------------- */

.doc-layout {
  display: grid;
  grid-template-columns: var(--sidebar-width) 1fr var(--toc-width);
  max-width: 1440px;
  margin: 0 auto;
  min-height: calc(100vh - var(--header-height));
}

/* Sidebar */
.doc-sidebar {
  position: sticky;
  top: var(--header-height);
  height: calc(100vh - var(--header-height));
  overflow-y: auto;
  padding: var(--space-6);
  border-right: 1px solid var(--color-border-light);
}

.nav-tree {
  list-style: none;
  margin: 0;
  padding: 0;
}

.nav-item {
  margin-bottom: var(--space-1);
}

.nav-item > a {
  display: block;
  padding: var(--space-2) var(--space-3);
  color: var(--color-text-muted);
  text-decoration: none;
  font-size: var(--text-sm);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.nav-item > a:hover {
  color: var(--color-text);
  background: var(--color-bg-alt);
}

.nav-item.is-active > a {
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 10%, transparent);
  font-weight: 500;
}

.nav-children {
  list-style: none;
  margin: var(--space-1) 0 var(--space-2) var(--space-4);
  padding: 0;
}

/* Main content */
.doc-content {
  padding: var(--space-8) var(--space-10);
  max-width: var(--content-max-width);
}

.doc-header {
  margin-bottom: var(--space-8);
}

.doc-header h1 {
  margin: 0 0 var(--space-2);
  font-size: var(--text-3xl);
  font-weight: 700;
  letter-spacing: -0.025em;
}

.doc-description {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--text-lg);
}

/* Table of contents */
.doc-toc {
  position: sticky;
  top: var(--header-height);
  height: calc(100vh - var(--header-height));
  overflow-y: auto;
  padding: var(--space-6);
  border-left: 1px solid var(--color-border-light);
}

.toc-title {
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  margin: 0 0 var(--space-4);
}

.toc-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.toc-list li {
  margin: 0;
  padding: var(--space-1) 0;
}

.toc-list a {
  color: var(--color-text-muted);
  text-decoration: none;
  font-size: var(--text-sm);
  display: block;
  transition: color 0.15s ease;
}

.toc-list a:hover {
  color: var(--color-primary);
}

.toc-nested {
  padding-left: var(--space-4);
  font-size: var(--text-xs);
}

/* Home Layout */
.home-layout {
  max-width: var(--content-max-width);
  margin: 0 auto;
  padding: var(--space-10) var(--space-6);
}

.home-content h1 {
  font-size: var(--text-4xl);
  font-weight: 700;
  letter-spacing: -0.025em;
  margin-bottom: var(--space-6);
}

/* --------------------------------------------------------------------------
   Prose Content
   -------------------------------------------------------------------------- */

.prose {
  line-height: 1.7;
}

.prose h2 {
  margin: var(--space-10) 0 var(--space-4);
  font-size: var(--text-2xl);
  font-weight: 600;
  letter-spacing: -0.02em;
}

.prose h3 {
  margin: var(--space-8) 0 var(--space-3);
  font-size: var(--text-xl);
  font-weight: 600;
}

.prose h4 {
  margin: var(--space-6) 0 var(--space-2);
  font-size: var(--text-lg);
  font-weight: 600;
}

.prose p {
  margin: 0 0 var(--space-4);
}

.prose a {
  color: var(--color-primary);
  text-decoration: none;
}

.prose a:hover {
  text-decoration: underline;
}

.prose ul,
.prose ol {
  margin: 0 0 var(--space-4);
  padding-left: var(--space-6);
}

.prose li {
  margin-bottom: var(--space-2);
}

.prose code {
  font-family: var(--font-mono);
  font-size: 0.9em;
  padding: 0.15em 0.4em;
  background: var(--color-bg-code);
  border-radius: var(--radius-sm);
}

.prose pre {
  margin: 0 0 var(--space-6);
  padding: var(--space-4);
  background: var(--color-bg-code);
  border-radius: var(--radius);
  overflow-x: auto;
}

.prose pre code {
  padding: 0;
  background: none;
  font-size: var(--text-sm);
  line-height: 1.6;
}

.prose blockquote {
  margin: 0 0 var(--space-4);
  padding: var(--space-4) var(--space-6);
  border-left: 4px solid var(--color-primary);
  background: var(--color-bg-alt);
  border-radius: 0 var(--radius) var(--radius) 0;
}

.prose blockquote p:last-child {
  margin-bottom: 0;
}

.prose table {
  width: 100%;
  margin: 0 0 var(--space-6);
  border-collapse: collapse;
  font-size: var(--text-sm);
}

.prose th,
.prose td {
  padding: var(--space-3) var(--space-4);
  text-align: left;
  border-bottom: 1px solid var(--color-border-light);
}

.prose th {
  font-weight: 600;
  background: var(--color-bg-alt);
}

/* --------------------------------------------------------------------------
   Footer
   -------------------------------------------------------------------------- */

.site-footer {
  border-top: 1px solid var(--color-border-light);
  padding: var(--space-8) var(--space-6);
  background: var(--color-bg-alt);
}

.footer-inner {
  max-width: 1440px;
  margin: 0 auto;
  text-align: center;
}

.footer-meta {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.footer-meta a {
  color: var(--color-primary);
  text-decoration: none;
}

.footer-meta a:hover {
  text-decoration: underline;
}

/* --------------------------------------------------------------------------
   Responsive
   -------------------------------------------------------------------------- */

@media (max-width: 1200px) {
  .doc-layout {
    grid-template-columns: var(--sidebar-width) 1fr;
  }

  .doc-toc {
    display: none;
  }
}

@media (max-width: 768px) {
  .doc-layout {
    grid-template-columns: 1fr;
  }

  .doc-sidebar {
    display: none;
  }

  .doc-content {
    padding: var(--space-6) var(--space-4);
  }

  .main-nav {
    display: none;
  }

  .mobile-menu-toggle {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    width: 24px;
    height: 18px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
  }

  .mobile-menu-toggle span {
    display: block;
    height: 2px;
    background: var(--color-text);
    border-radius: 1px;
  }

  .footer-inner {
    text-align: center;
  }
}
```

**10. Create `docs/{name}/assets/css/prism-theme.css`:**

```css
/* ==========================================================================
   Prism.js Syntax Highlighting Theme
   Based on One Dark Pro
   ========================================================================== */

code[class*="language-"],
pre[class*="language-"] {
  color: #abb2bf;
  background: none;
  font-family: var(--font-mono);
  text-align: left;
  white-space: pre;
  word-spacing: normal;
  word-break: normal;
  word-wrap: normal;
  line-height: 1.6;
  tab-size: 2;
  hyphens: none;
}

pre[class*="language-"] {
  padding: 1rem;
  margin: 0;
  overflow: auto;
  background: #282c34;
  border-radius: var(--radius);
}

:not(pre) > code[class*="language-"] {
  padding: 0.1em 0.3em;
  border-radius: 0.3em;
  white-space: normal;
  background: #282c34;
}

/* Tokens */
.token.comment,
.token.prolog,
.token.doctype,
.token.cdata {
  color: #5c6370;
  font-style: italic;
}

.token.punctuation {
  color: #abb2bf;
}

.token.selector,
.token.tag {
  color: #e06c75;
}

.token.property,
.token.boolean,
.token.number,
.token.constant,
.token.symbol,
.token.attr-name,
.token.deleted {
  color: #d19a66;
}

.token.string,
.token.char,
.token.attr-value,
.token.builtin,
.token.inserted {
  color: #98c379;
}

.token.operator,
.token.entity,
.token.url,
.language-css .token.string,
.style .token.string {
  color: #56b6c2;
}

.token.atrule,
.token.keyword {
  color: #c678dd;
}

.token.function,
.token.class-name {
  color: #61afef;
}

.token.regex,
.token.important,
.token.variable {
  color: #c678dd;
}

.token.important,
.token.bold {
  font-weight: bold;
}

.token.italic {
  font-style: italic;
}

.token.entity {
  cursor: help;
}

/* Line numbers */
pre[class*="language-"].line-numbers {
  position: relative;
  padding-left: 3.8em;
  counter-reset: linenumber;
}

pre[class*="language-"].line-numbers > code {
  position: relative;
  white-space: inherit;
}

.line-numbers .line-numbers-rows {
  position: absolute;
  pointer-events: none;
  top: 0;
  font-size: 100%;
  left: -3.8em;
  width: 3em;
  letter-spacing: -1px;
  border-right: 1px solid #3b4048;
  user-select: none;
}

.line-numbers-rows > span {
  display: block;
  counter-increment: linenumber;
}

.line-numbers-rows > span:before {
  content: counter(linenumber);
  color: #4b5263;
  display: block;
  padding-right: 0.8em;
  text-align: right;
}
```

## Step 2: Check for Existing Examples

### Ensure Package Structure Exists

After resolving the grammar file path (found in `.source/` or package `src/`), ensure the grammar package folder exists:

1. **Read the grammar file** and extract the grammar name (from `grammar <name>` declaration)
2. **Derive the package name**: `@sanyam-grammar/<lowercase-grammar-name>`
   - Example: `grammar TaskList` → `@sanyam-grammar/tasklist`
3. **Check if the package exists**: Look for `packages/grammar-definitions/{name}/src/` directory
   - Use the Glob tool to check: `packages/grammar-definitions/{name}/src/`
4. **If the package doesn't exist**:
   - Inform the user: "Grammar package structure not found. Creating scaffold..."
   - **Prompt the user for the file extension** using AskUserQuestion:
     - Question: "What file extension should be used for this grammar?"
     - Header: "Extension"
     - Options:
       - `.{lowercase-grammar-name}` (e.g., `.tasklist`) - "Use grammar name as extension (Recommended)"
       - `.dsl` - "Generic DSL extension"
       - `.lang` - "Generic language extension"
     - The user can also select "Other" to provide a custom extension
5. **If the package already exists**:
   - Read `langium-config.json` to get the `fileExtensions` array (e.g., `"fileExtensions": [".ecml"]`)
   - Or read `manifest.ts` to get the `fileExtension` property
   - Use that extension for all generated examples
6. **Set the output paths for auto-save**:
   - Individual examples: `workspace/{name}/`
   - Base template: `workspace/{name}/templates/new-file.{ext}`
   - File extension: Use the extension from step 4 (user prompt) or step 5 (existing config)

**Note**: The grammar file in `.source/` is the master copy. If the grammar was found in `.source/` but not in the package, it should be copied to the package `src/` folder during `/grammar.config` execution.

### Look for user-created examples in the project:

- Check `/workspace/{name}/` folder at the project root
- Read all files with the `<ext>` extension
- Note each example's filename and content for incorporation into docs

## Step 3: Read and Analyze the Grammar

Read `{name}.langium` and extract:
1. **Entry rule**: From `entry <RuleName>:` declaration
2. **Parser rules**: All non-terminal rule names
3. **Terminal rules**: All terminal definitions
4. **Keywords**: All quoted string literals

## Step 4: Generate Content Pages

### 4.1 Homepage

**Save to**: `docs/{name}/index.md`

```yaml
---
title: "$ARGUMENTS"
layout: layouts/home.njk
eleventyNavigation:
  key: Home
  order: 1
---
```

Include: Welcome message, feature highlights, quick links.

### 4.2 Getting Started Guide

**Save to**: `docs/{name}/getting-started/index.md`

```yaml
---
title: "Getting Started"
layout: layouts/doc.njk
eleventyNavigation:
  key: Getting Started
  order: 2
---
```

Include: Prerequisites, first file walkthrough, basic concepts.

### 4.3 Language Reference

**Save to**: `docs/{name}/language/reference.md`

```yaml
---
title: "Language Reference"
layout: layouts/doc.njk
eleventyNavigation:
  key: Reference
  parent: Language
  order: 1
---
```

Include: Complete syntax reference for all grammar rules.

### 4.4 Quick Reference

**Save to**: `docs/{name}/language/quick-reference.md`

```yaml
---
title: "Quick Reference"
layout: layouts/doc.njk
eleventyNavigation:
  key: Quick Reference
  parent: Language
  order: 2
---
```

Include: Cheatsheet with keywords, terminals, common patterns.

### 4.5 Tutorial

**Save to**: `docs/{name}/language/tutorial.md`

```yaml
---
title: "Tutorial"
layout: layouts/doc.njk
eleventyNavigation:
  key: Tutorial
  parent: Language
  order: 3
---
```

Include: Progressive learning path from simple to complex.

## Step 5: Incorporate Existing Examples

If examples were found in Step 2:

### 5.1 Create Example Pages

For each example file found, create `docs/{name}/examples/{example-name}.md`:

```yaml
---
title: "{Example Name}"
layout: layouts/doc.njk
eleventyNavigation:
  key: {Example Name}
  parent: Examples
  order: {N}
---
```

Include:
- The full example code in a fenced code block with `{name}` language
- Explanation of what the example demonstrates
- Key concepts highlighted

### 5.2 Create Examples Index

**Save to**: `docs/{name}/examples/index.md`

```yaml
---
title: "Examples"
layout: layouts/doc.njk
eleventyNavigation:
  key: Examples
  order: 4
---
```

Include:
- List of all examples with brief descriptions
- Links to individual example pages
- Complexity indicators (beginner/intermediate/advanced)

## Step 6: Install Dependencies

After generating all files, run:
```bash
cd docs/{name} && npm install
```

## Running the Documentation Site

From the `docs/{name}/` directory, the following npm scripts are available:

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build static site to `_site/` |
| `npm run preview` | Preview built site on port 8080 |
| `npm run clean` | Remove generated `_site/` folder |

## Style Guidelines

### Writing Style
- Use second person ("you") when addressing the reader
- Use present tense for describing functionality
- Include code examples with `<ext>` as the language identifier
- Keep paragraphs short (3-4 sentences max)

### Code Examples
- All examples MUST be syntactically valid according to the grammar
- Use only keywords defined in the grammar
- Include helpful comments

## Summary

After generation, report:
1. List of all created/updated files
2. Number of examples incorporated
3. Command to start the dev server: `cd docs/{name} && npm run dev`

## Error Handling

- If grammar file not found: Report the expected path
- If docs/{name}/eleventy.config.js exists: Skip infrastructure generation, only update content
- If /workspace/{name}/ folder not found: Generate documentation without user examples
