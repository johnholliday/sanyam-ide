/**
 * Ensures the @vscode/ripgrep binary is present after install.
 *
 * pnpm restores packages from its content-addressable store via hardlinks,
 * but the ripgrep binary (created by a postinstall download) may not be
 * re-created when the package is already cached.  This script detects the
 * missing binary and re-runs the ripgrep postinstall with --force.
 */
const { existsSync } = require('fs');
const { join } = require('path');
const { execFileSync } = require('child_process');

const ripgrepDir = join(__dirname, '..', 'node_modules', '@vscode', 'ripgrep');
const rgBin = join(ripgrepDir, 'bin', 'rg');

if (existsSync(rgBin)) {
    process.exit(0);
}

const postinstall = join(ripgrepDir, 'lib', 'postinstall.js');
if (!existsSync(postinstall)) {
    console.warn('[ensure-ripgrep] @vscode/ripgrep not installed — skipping.');
    process.exit(0);
}

console.log('[ensure-ripgrep] Binary missing, running @vscode/ripgrep postinstall…');
try {
    // Pass --force so ripgrep's postinstall re-downloads even if bin/ dir exists
    execFileSync(process.execPath, [postinstall, '--force'], { cwd: ripgrepDir, stdio: 'inherit' });
    console.log('[ensure-ripgrep] Done.');
} catch (err) {
    console.error('[ensure-ripgrep] Failed to download ripgrep binary:', err.message);
    process.exit(1);
}
