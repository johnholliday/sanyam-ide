/**
 * esbuild configuration for @sanyam/language-server
 *
 * Builds the unified language server and VS Code extension as bundled CommonJS
 * for compatibility with Theia/VS Code plugin hosts.
 */
import * as esbuild from "esbuild";
import * as fs from "node:fs";
import { argv } from "process";

const production = argv.includes("--production");
const watch = argv.includes("--watch");

/**
 * Common build options for VS Code/Theia extensions
 * - CommonJS format required for plugin hosts
 * - Bundle all dependencies except 'vscode' API
 */
const commonOptions = {
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "node20",
  sourcemap: !production,
  minify: production,
  // Only externalize the vscode API - everything else gets bundled
  external: ["vscode"],
};

/**
 * Build configurations
 *
 * Output uses .js extension with a nested package.json to override "type": "module"
 * This is needed because:
 * - The root package.json has "type": "module" for npm ESM exports (lib/)
 * - The bundled output is CommonJS for VS Code/Theia plugin compatibility
 * - The out/package.json with "type": "commonjs" tells Node.js to treat .js as CJS
 */
const builds = [
  // Main server entry point (started as child process)
  {
    ...commonOptions,
    entryPoints: ["src/main.ts"],
    outfile: "out/main.js",
  },
  // VS Code extension entry point (loaded by plugin host)
  {
    ...commonOptions,
    entryPoints: ["src/extension.ts"],
    outfile: "out/extension.js",
  },
];

async function build() {
  try {
    // Ensure out/ directory exists
    if (!fs.existsSync("out")) {
      fs.mkdirSync("out", { recursive: true });
    }

    // Create nested package.json to mark out/ as CommonJS
    // This overrides the root "type": "module" for this directory only
    fs.writeFileSync(
      "out/package.json",
      JSON.stringify({ type: "commonjs" }, null, 2) + "\n"
    );

    if (watch) {
      // Watch mode
      const contexts = await Promise.all(
        builds.map((config) => esbuild.context(config)),
      );
      await Promise.all(contexts.map((ctx) => ctx.watch()));
      console.log("Watching for changes...");
    } else {
      // Single build
      await Promise.all(builds.map((config) => esbuild.build(config)));
      console.log("Build complete");
    }
  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  }
}

build();
