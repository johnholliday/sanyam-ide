/**
 * Side-effect module: loads `.env` (then `.env.local` override) from the project root.
 *
 * Only sets `process.env[key]` when the key is not already set,
 * so real environment variables always take precedence.
 *
 * @packageDocumentation
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Parse a dotenv-format file into key-value pairs.
 *
 * Handles:
 *  - blank lines and `#` comments
 *  - optional `export` prefix
 *  - values with or without quotes (single/double)
 */
function parseDotenv(content: string): Record<string, string> {
    const result: Record<string, string> = {};
    for (const raw of content.split('\n')) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) {
            continue;
        }
        // Strip optional `export ` prefix
        const stripped = line.startsWith('export ') ? line.slice(7) : line;
        const eqIndex = stripped.indexOf('=');
        if (eqIndex === -1) {
            continue;
        }
        const key = stripped.slice(0, eqIndex).trim();
        let value = stripped.slice(eqIndex + 1).trim();
        // Remove surrounding quotes
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        result[key] = value;
    }
    return result;
}

/**
 * Walk upward from `startDir` looking for `filename`.
 * Returns the full path if found, otherwise `undefined`.
 */
function findFileUpward(startDir: string, filename: string): string | undefined {
    let dir = startDir;
    for (;;) {
        const candidate = path.join(dir, filename);
        if (fs.existsSync(candidate)) {
            return candidate;
        }
        const parent = path.dirname(dir);
        if (parent === dir) {
            return undefined;
        }
        dir = parent;
    }
}

/**
 * Load a single dotenv file, setting any unset keys in `process.env`.
 * Returns the number of keys set.
 */
function loadFile(filePath: string): number {
    if (!fs.existsSync(filePath)) {
        return 0;
    }
    const entries = parseDotenv(fs.readFileSync(filePath, 'utf-8'));
    let count = 0;
    for (const [key, value] of Object.entries(entries)) {
        if (process.env[key] === undefined) {
            process.env[key] = value;
            count++;
        }
    }
    return count;
}

// --- Execute on import ---

const projectPath = process.env.THEIA_APP_PROJECT_PATH;
if (projectPath) {
    // .env.local overrides .env (loaded first so its values win)
    for (const name of ['.env.local', '.env']) {
        const found = findFileUpward(projectPath, name);
        if (found) {
            const count = loadFile(found);
            if (count > 0) {
                console.log(`[dotenv-loader] Loaded ${count} env var(s) from ${found}`);
            }
        }
    }
}
