const syntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");
const markdownIt = require("markdown-it");
const anchor = require("markdown-it-anchor");

module.exports = function(eleventyConfig) {
  // Syntax highlighting for code blocks
  eleventyConfig.addPlugin(syntaxHighlight);

  // Configure Markdown with anchors for headings
  const md = markdownIt({
    html: true,
    linkify: true,
    typographer: true
  }).use(anchor, {
    permalink: anchor.permalink.headerLink(),
    slugify: s => s.toLowerCase().replace(/[^\w]+/g, '-')
  });
  eleventyConfig.setLibrary("md", md);

  // Copy static assets
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/images");

  // Add GARP code language for syntax highlighting
  eleventyConfig.addShortcode("garpcode", function(code) {
    return `<pre class="language-garp"><code class="language-garp">${escapeHtml(code)}</code></pre>`;
  });

  // Helper to escape HTML
  function escapeHtml(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Add collection for examples
  eleventyConfig.addCollection("examples", function(collectionApi) {
    return collectionApi.getFilteredByGlob("src/examples/*.md").sort((a, b) => {
      return (a.data.order || 0) - (b.data.order || 0);
    });
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      layouts: "_includes/layouts"
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk"
  };
};
