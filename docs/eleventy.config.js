import syntaxHighlight from '@11ty/eleventy-plugin-syntaxhighlight';
import eleventyNavigationPlugin from '@11ty/eleventy-navigation';

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
