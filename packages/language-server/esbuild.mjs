/**
 * esbuild configuration for @sanyam/language-server
 *
 * Builds the unified language server and VS Code extension.
 */
import * as esbuild from "esbuild";
import { argv } from "process";

const production = argv.includes("--production");
const watch = argv.includes("--watch");

/**
 * Common build options
 */
const commonOptions = {
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  sourcemap: !production,
  minify: production,
  external: [
    // Peer dependencies
    "vscode",
    "vscode-languageclient",
    // Node.js built-ins
    "fs",
    "path",
    "child_process",
    "net",
    "os",
    "crypto",
    "stream",
    "util",
  ],
};

/**
 * Build configurations
 */
const builds = [
  // Main server entry point
  {
    ...commonOptions,
    entryPoints: ["src/main.ts"],
    outfile: "dist/main.js",
  },
  // VS Code extension entry point
  {
    ...commonOptions,
    entryPoints: ["src/extension.ts"],
    outfile: "dist/extension.js",
    external: [...commonOptions.external, "vscode"],
  },
];

async function build() {
  try {
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
