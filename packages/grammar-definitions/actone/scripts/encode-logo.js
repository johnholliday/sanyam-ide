#!/usr/bin/env node
/**
 * Encodes the logo.svg file as a base64 data URL and generates a TypeScript module.
 * Run this script before TypeScript compilation.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const svgPath = resolve(__dirname, '../src/logo.svg');
const outputPath = resolve(__dirname, '../src/logo.generated.ts');

const svg = readFileSync(svgPath, 'utf-8');
const base64 = Buffer.from(svg).toString('base64');

// Split base64 into chunks to avoid exceeding max line length
const chunkSize = 80;
const chunks = [];
for (let i = 0; i < base64.length; i += chunkSize) {
  chunks.push(base64.slice(i, i + chunkSize));
}

const base64Lines = chunks.map((chunk) => `  '${chunk}'`).join(' +\n');

const output = `/**
 * Auto-generated file - do not edit directly.
 * Generated from logo.svg by scripts/encode-logo.js
 */
const BASE64_DATA =
${base64Lines};

export const LOGO_DATA_URL = \`data:image/svg+xml;base64,\${BASE64_DATA}\`;
`;

writeFileSync(outputPath, output);
console.log('Generated logo.generated.ts');
