#!/usr/bin/env node
/********************************************************************************
 * Script to publish @sanyam/* packages to local Verdaccio registry.
 *
 * Usage:
 *   1. Start Verdaccio: pnpm registry:start
 *   2. In another terminal: pnpm registry:publish
 *
 * This script:
 *   - Finds all @sanyam/* packages in the workspace
 *   - Publishes them to http://localhost:4873
 *   - Handles both initial publish and updates
 ********************************************************************************/

import { execSync } from 'child_process';
import { createHash } from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const REGISTRY_URL = 'http://localhost:4873';

/**
 * Find all @sanyam/* packages in the workspace.
 */
function findSanyamPackages() {
    const packagesDir = join(rootDir, 'packages');
    const packages = [];

    // Read directory entries
    const entries = execSync(`ls -1 "${packagesDir}"`, { encoding: 'utf-8' })
        .trim()
        .split('\n');

    for (const entry of entries) {
        const pkgJsonPath = join(packagesDir, entry, 'package.json');
        if (existsSync(pkgJsonPath)) {
            const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
            if (pkgJson.name?.startsWith('@sanyam/')) {
                packages.push({
                    name: pkgJson.name,
                    version: pkgJson.version,
                    path: join(packagesDir, entry),
                    hasLib: existsSync(join(packagesDir, entry, 'lib')),
                    private: pkgJson.private === true
                });
            }
        }
    }

    return packages;
}

/**
 * Check if Verdaccio is running.
 */
async function checkVerdaccio() {
    try {
        const response = await fetch(REGISTRY_URL);
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Publish a package to the local registry.
 */
function publishPackage(pkg) {
    console.log(`\n📦 Publishing ${pkg.name}@${pkg.version}...`);

    if (pkg.private) {
        console.log(`   ⏭️  Private package (skipping)`);
        return true;
    }

    if (!pkg.hasLib) {
        console.log(`   ⚠️  No lib/ directory found. Run 'pnpm build' first.`);
        return false;
    }

    try {
        // Use pnpm publish to properly convert workspace:* protocol
        execSync(`pnpm publish --registry ${REGISTRY_URL} --no-git-checks`, {
            cwd: pkg.path,
            stdio: 'pipe'
        });
        console.log(`   ✅ Published successfully`);
        return true;
    } catch (error) {
        const stdout = error.stdout?.toString() || '';
        const stderr = error.stderr?.toString() || '';
        const errorMsg = stderr || stdout || error.message;

        if (errorMsg.includes('cannot publish over the previously published version') ||
            errorMsg.includes('You cannot publish over the previously published versions') ||
            errorMsg.includes('this package is already present') ||
            errorMsg.includes('E409')) {
            console.log(`   ⏭️  Version already published (skipping)`);
            return true;
        }

        // For other errors, try unpublish + publish
        if (errorMsg.includes('EPUBLISHCONFLICT') || errorMsg.includes('already exists')) {
            console.log(`   🔄 Version conflict, attempting force republish...`);
            try {
                execSync(`npm unpublish ${pkg.name}@${pkg.version} --registry ${REGISTRY_URL} --force`, {
                    cwd: pkg.path,
                    stdio: 'pipe'
                });
                execSync(`pnpm publish --registry ${REGISTRY_URL} --no-git-checks`, {
                    cwd: pkg.path,
                    stdio: 'pipe'
                });
                console.log(`   ✅ Republished successfully`);
                return true;
            } catch (retryError) {
                console.log(`   ❌ Failed to republish: ${retryError.message}`);
                return false;
            }
        }

        console.log(`   ❌ Failed: ${errorMsg.slice(0, 200)}`);
        return false;
    }
}

/**
 * Creates a default user in the Verdaccio htpasswd file if it doesn't exist.
 * Password: local, Username: local
 */
function ensureVerdaccioUser() {
    const verdaccioDir = join(rootDir, '.verdaccio');
    const htpasswdPath = join(verdaccioDir, 'htpasswd');

    // Create .verdaccio directory if needed
    if (!existsSync(verdaccioDir)) {
        mkdirSync(verdaccioDir, { recursive: true });
    }

    // Check if htpasswd already has users
    if (existsSync(htpasswdPath)) {
        const content = readFileSync(htpasswdPath, 'utf-8');
        if (content.includes('local:')) {
            return; // User already exists
        }
    }

    // Create SHA1 hash of password 'local'
    const sha1Hash = createHash('sha1').update('local').digest('base64');
    const htpasswdEntry = `local:{SHA}${sha1Hash}\n`;
    writeFileSync(htpasswdPath, htpasswdEntry, 'utf-8');
    console.log('   📝 Created default Verdaccio user (local/local)');
}

/**
 * Ensures npm is authenticated with Verdaccio.
 * Creates a local user if not already set up.
 */
function ensureNpmAuth() {
    // First ensure the Verdaccio user exists
    ensureVerdaccioUser();

    try {
        // Check if already authenticated
        const whoami = execSync(`npm whoami --registry ${REGISTRY_URL}`, {
            encoding: 'utf-8',
            stdio: 'pipe'
        }).trim();
        console.log(`   ✅ Logged in as: ${whoami}`);
        return true;
    } catch {
        // Not logged in, configure auth token
        console.log('   🔑 Setting up npm authentication...');
        try {
            // Use basic auth format: username:password base64 encoded
            const authToken = Buffer.from('local:local').toString('base64');
            execSync(`npm config set //localhost:4873/:_auth ${authToken}`, { stdio: 'pipe' });
            console.log('   ✅ Authentication configured (user: local)');
            return true;
        } catch (err) {
            console.error('   ❌ Failed to configure authentication:', err.message);
            return false;
        }
    }
}

/**
 * Main entry point.
 */
async function main() {
    console.log('🚀 Publishing @sanyam/* packages to local Verdaccio registry\n');
    console.log(`   Registry: ${REGISTRY_URL}`);

    // Check if Verdaccio is running
    const isRunning = await checkVerdaccio();
    if (!isRunning) {
        console.error('\n❌ Verdaccio is not running!');
        console.error('   Start it with: pnpm registry:start');
        process.exit(1);
    }
    console.log('   ✅ Verdaccio is running');

    // Set up authentication
    if (!ensureNpmAuth()) {
        console.error('\n❌ Failed to set up npm authentication');
        process.exit(1);
    }
    console.log('');

    // Find packages
    const packages = findSanyamPackages();
    console.log(`Found ${packages.length} @sanyam/* packages:`);
    for (const pkg of packages) {
        console.log(`   - ${pkg.name}@${pkg.version}`);
    }

    // Publish each package
    let succeeded = 0;
    let failed = 0;

    for (const pkg of packages) {
        if (publishPackage(pkg)) {
            succeeded++;
        } else {
            failed++;
        }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log(`✅ Published: ${succeeded}`);
    if (failed > 0) {
        console.log(`❌ Failed: ${failed}`);
    }
    console.log('='.repeat(50));

    if (failed > 0) {
        process.exit(1);
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
