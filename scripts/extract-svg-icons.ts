#!/usr/bin/env tsx
/**
 * Extract multi-color SVG icon data from a directory of SVG files.
 *
 * Parses SVG files, extracting `<path>` elements with their `d`, `fill`,
 * `fill-rule`, `opacity`, and CSS class-based fill colors. Outputs a
 * TypeScript module with typed icon data.
 *
 * Handles:
 * - Inline `fill` attributes on `<path>` elements
 * - CSS class-based fills via `<style>` blocks (e.g., `.Blue{fill:#1177D7;}`)
 * - `fill-rule` and `clip-rule` attributes
 * - `opacity` attributes
 * - Arbitrary `viewBox` values from the root `<svg>` element
 *
 * Usage:
 *   # Platform default icons (TypeScript + CSS overrides)
 *   npx tsx scripts/extract-svg-icons.ts packages/theia-extensions/glsp/src/icons \
 *     --out svg-icons.ts --var SVG_ICON_PATHS --css src/browser/style/svg-icon-overrides.css
 *
 *   # Grammar package icons (TypeScript only)
 *   npx tsx scripts/extract-svg-icons.ts packages/grammar-definitions/actone/src/icons
 *
 * @packageDocumentation
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';

// ── CLI argument parsing ──────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getFlag(name: string): string | undefined {
    const idx = args.indexOf(name);
    if (idx >= 0 && idx + 1 < args.length) {
        return args[idx + 1];
    }
    return undefined;
}

const inputDir = args.find(a => !a.startsWith('--'));
if (!inputDir) {
    console.error('Usage: extract-svg-icons.ts <icons-dir> [--out <filename>] [--outdir <dir>] [--var <varname>] [--css <path>]');
    process.exit(1);
}

const outFilename = getFlag('--out') ?? 'icons-gen.ts';
const outDir = getFlag('--outdir');
const varName = getFlag('--var') ?? 'ICONS';
const cssOutPath = getFlag('--css');

// ── SVG parsing ───────────────────────────────────────────────────────────────

interface PathSegment {
    d: string;
    fill?: string;
    fillRule?: string;
    opacity?: number;
}

interface IconEntry {
    viewBox: string;
    paths: PathSegment[];
}

/**
 * Parse embedded `<style>` blocks to build a CSS class → fill color map.
 *
 * Handles patterns like:
 *   <style>.Blue{fill:#1177D7;}</style>
 *   <style>.cls-1 { fill: #f00; }</style>
 */
function parseStyleBlock(svgContent: string): Map<string, string> {
    const classToFill = new Map<string, string>();
    const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    let styleMatch: RegExpExecArray | null;

    while ((styleMatch = styleRegex.exec(svgContent)) !== null) {
        const cssText = styleMatch[1];
        // Match CSS rules: .ClassName { fill: #color; }
        const ruleRegex = /\.([a-zA-Z_][\w-]*)\s*\{[^}]*fill\s*:\s*([^;}\s]+)\s*;?[^}]*\}/gi;
        let ruleMatch: RegExpExecArray | null;
        while ((ruleMatch = ruleRegex.exec(cssText)) !== null) {
            classToFill.set(ruleMatch[1], ruleMatch[2]);
        }
    }

    return classToFill;
}

/**
 * Extract the viewBox attribute from the root `<svg>` element.
 * Falls back to '0 0 16 16' if not found.
 */
function extractViewBox(svgContent: string): string {
    const match = svgContent.match(/<svg[^>]+viewBox="([^"]+)"/i);
    return match ? match[1] : '0 0 16 16';
}

/**
 * Extract all `<path>` elements from SVG content, resolving fills from
 * inline attributes and CSS class mappings.
 */
function extractPaths(svgContent: string, classToFill: Map<string, string>): PathSegment[] {
    const paths: PathSegment[] = [];
    const pathRegex = /<path\s+([^>]*?)\/?\s*>/gi;
    let match: RegExpExecArray | null;

    while ((match = pathRegex.exec(svgContent)) !== null) {
        const attrs = match[1];

        // Extract d attribute
        const dMatch = attrs.match(/\bd="([^"]+)"/);
        if (!dMatch) continue;

        // Normalize whitespace in path data (SVGs may have multi-line d attrs)
        const segment: PathSegment = { d: dMatch[1].replace(/\s+/g, ' ').trim() };

        // Resolve fill color: inline fill attr > class-based fill
        const fillMatch = attrs.match(/\bfill="([^"]+)"/);
        const classMatch = attrs.match(/\bclass="([^"]+)"/);

        if (fillMatch && fillMatch[1] !== 'none') {
            segment.fill = fillMatch[1];
        } else if (classMatch) {
            // Try each class name against the style map
            const classes = classMatch[1].split(/\s+/);
            for (const cls of classes) {
                const resolved = classToFill.get(cls);
                if (resolved) {
                    segment.fill = resolved;
                    break;
                }
            }
        }

        // Extract fill-rule
        const fillRuleMatch = attrs.match(/\bfill-rule="([^"]+)"/);
        const clipRuleMatch = attrs.match(/\bclip-rule="([^"]+)"/);
        if (fillRuleMatch) {
            segment.fillRule = fillRuleMatch[1];
        } else if (clipRuleMatch) {
            segment.fillRule = clipRuleMatch[1];
        }

        // Extract opacity
        const opacityMatch = attrs.match(/\bopacity="([^"]+)"/);
        if (opacityMatch) {
            segment.opacity = parseFloat(opacityMatch[1]);
        }

        paths.push(segment);
    }

    return paths;
}

/**
 * Format a single path segment as TypeScript object literal.
 */
function formatPathSegment(seg: PathSegment): string {
    const parts: string[] = [`d: '${seg.d}'`];
    if (seg.fill) {
        parts.push(`fill: '${seg.fill}'`);
    }
    if (seg.fillRule) {
        parts.push(`fillRule: '${seg.fillRule}'`);
    }
    if (seg.opacity !== undefined) {
        parts.push(`opacity: ${seg.opacity}`);
    }
    return `{ ${parts.join(', ')} }`;
}

// ── CSS override generation ──────────────────────────────────────────────────

/**
 * Reconstruct a minimal inline SVG from parsed icon data.
 *
 * Rebuilds `<path>` elements with inline fill, fill-rule, and opacity
 * attributes so the SVG is self-contained (no external <style> blocks).
 */
function reconstructSvg(entry: IconEntry): string {
    const pathEls = entry.paths.map(seg => {
        const attrs: string[] = [`d="${seg.d}"`];
        if (seg.fill) {
            attrs.push(`fill="${seg.fill}"`);
        }
        if (seg.fillRule) {
            attrs.push(`fill-rule="${seg.fillRule}"`);
        }
        if (seg.opacity !== undefined) {
            attrs.push(`opacity="${seg.opacity}"`);
        }
        return `<path ${attrs.join(' ')}/>`;
    });
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${entry.viewBox}">${pathEls.join('')}</svg>`;
}

/** Base64-encode a UTF-8 string. */
function toBase64(str: string): string {
    return Buffer.from(str, 'utf-8').toString('base64');
}

/** True if any path in the icon has an explicit fill color. */
function isMultiColor(entry: IconEntry): boolean {
    return entry.paths.some(p => p.fill !== undefined);
}

/**
 * Generate a CSS override file that replaces codicon font glyphs with
 * data-URI SVG backgrounds.
 *
 * - **Monochrome** icons (no explicit fills): Uses `mask-image` +
 *   `background-color: currentColor` so the icon inherits the Theia
 *   theme's foreground color.
 * - **Multi-color** icons (explicit fills): Uses `background-image` to
 *   preserve the per-path fill colors from the SVG source.
 *
 * Both suppress the codicon font character via `::before { content: '' }`.
 */
function generateCssOverrides(icons: Map<string, IconEntry>): string {
    const cssLines: string[] = [];

    cssLines.push(`/********************************************************************************`);
    cssLines.push(` * SVG Icon Overrides for Theia Outline View`);
    cssLines.push(` *`);
    cssLines.push(` * Auto-generated by scripts/extract-svg-icons.ts`);
    cssLines.push(` * Do not edit manually — re-run the script to regenerate.`);
    cssLines.push(` *`);
    cssLines.push(` * Replaces codicon font glyphs with data-URI SVG backgrounds so that the`);
    cssLines.push(` * outline tree icons match the diagram node header icons.`);
    cssLines.push(` *`);
    cssLines.push(` * SPDX-License-Identifier: MIT`);
    cssLines.push(` ********************************************************************************/`);
    cssLines.push('');

    for (const [name, entry] of icons) {
        const svg = reconstructSvg(entry);
        const b64 = toBase64(svg);
        const dataUri = `data:image/svg+xml;base64,${b64}`;
        const selector = `.codicon.codicon-symbol-${name}`;
        const multiColor = isMultiColor(entry);

        cssLines.push(`/* ${name} (${multiColor ? 'multi-color' : 'monochrome'}) */`);
        cssLines.push(`${selector}::before { content: '' !important; }`);

        // The codicon element is display:inline-block and gets its intrinsic
        // width from the ::before font glyph. Clearing the glyph collapses
        // width to 0, so we must set explicit dimensions (1em = codicon's 16px
        // font-size, scaling if the context changes).
        if (multiColor) {
            cssLines.push(`${selector} {`);
            cssLines.push(`    width: 1em;`);
            cssLines.push(`    height: 1em;`);
            cssLines.push(`    background: url("${dataUri}") center/contain no-repeat;`);
            cssLines.push(`}`);
        } else {
            cssLines.push(`${selector} {`);
            cssLines.push(`    width: 1em;`);
            cssLines.push(`    height: 1em;`);
            cssLines.push(`    -webkit-mask: url("${dataUri}") center/contain no-repeat;`);
            cssLines.push(`    mask: url("${dataUri}") center/contain no-repeat;`);
            cssLines.push(`    background-color: currentColor;`);
            cssLines.push(`}`);
        }

        cssLines.push('');
    }

    return cssLines.join('\n');
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main(): void {
    const resolvedDir = resolve(inputDir);

    // No-op if directory doesn't exist or has no SVGs
    if (!existsSync(resolvedDir)) {
        console.log(`Directory not found: ${resolvedDir} — skipping (no-op).`);
        return;
    }

    const svgFiles = readdirSync(resolvedDir)
        .filter(f => f.endsWith('.svg'))
        .sort();

    if (svgFiles.length === 0) {
        console.log(`No SVG files found in ${resolvedDir} — skipping (no-op).`);
        return;
    }

    const icons = new Map<string, IconEntry>();

    for (const file of svgFiles) {
        const filePath = join(resolvedDir, file);
        const name = basename(file, '.svg');
        const content = readFileSync(filePath, 'utf-8');

        const classToFill = parseStyleBlock(content);
        const viewBox = extractViewBox(content);
        const paths = extractPaths(content, classToFill);

        if (paths.length === 0) {
            console.error(`Warning: No paths found in ${file}`);
            continue;
        }

        icons.set(name, { viewBox, paths });
    }

    // Generate TypeScript output
    const lines: string[] = [];

    lines.push(`/********************************************************************************`);
    lines.push(` * SVG Icon Data — extracted from source SVG files`);
    lines.push(` *`);
    lines.push(` * Auto-generated by scripts/extract-svg-icons.ts`);
    lines.push(` * Do not edit manually — re-run the script to regenerate.`);
    lines.push(` *`);
    lines.push(` * SPDX-License-Identifier: MIT`);
    lines.push(` ********************************************************************************/`);
    lines.push('');
    lines.push(`import type { IconSvgData } from '@sanyam/types';`);
    lines.push('');
    lines.push(`/** Built-in SVG icons keyed by name (filename sans .svg). */`);
    lines.push(`export const ${varName}: Record<string, IconSvgData> = {`);

    for (const [name, entry] of icons) {
        lines.push(`    '${name}': {`);
        lines.push(`        viewBox: '${entry.viewBox}',`);
        lines.push(`        paths: [`);
        for (const seg of entry.paths) {
            lines.push(`            ${formatPathSegment(seg)},`);
        }
        lines.push(`        ],`);
        lines.push(`    },`);
    }

    lines.push(`};`);
    lines.push('');

    // Add helper function
    lines.push(`/**`);
    lines.push(` * Look up an icon by name.`);
    lines.push(` *`);
    lines.push(` * @param iconName - Icon name (e.g., 'person', 'package')`);
    lines.push(` * @returns Icon data, or \`undefined\` if the icon is not in the set`);
    lines.push(` */`);
    lines.push(`export function getSvgIcon(iconName: string): IconSvgData | undefined {`);
    lines.push(`    return ${varName}[iconName];`);
    lines.push(`}`);
    lines.push('');

    const resolvedOutDir = outDir ? resolve(outDir) : resolvedDir;
    const outPath = join(resolvedOutDir, outFilename);
    writeFileSync(outPath, lines.join('\n'), 'utf-8');
    console.log(`Wrote ${icons.size} icons to ${outPath}`);

    // Generate CSS override file if --css flag is provided
    if (cssOutPath) {
        const cssContent = generateCssOverrides(icons);
        const resolvedCssPath = resolve(cssOutPath);
        writeFileSync(resolvedCssPath, cssContent, 'utf-8');
        console.log(`Wrote ${icons.size} CSS icon overrides to ${resolvedCssPath}`);
    }
}

main();
