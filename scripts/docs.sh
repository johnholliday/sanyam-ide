#!/bin/bash
# Documentation build/serve script for grammar packages
# Usage: ./scripts/docs.sh <command> <grammar-name>
# Commands: build, start, clean
# Docs location: packages/grammar-definitions/<grammar-name>/docs/

set -e

COMMAND=$1
GRAMMAR=$2

if [ -z "$COMMAND" ] || [ -z "$GRAMMAR" ]; then
    echo "Usage: pnpm docs:<command> <grammar-name>"
    echo "Commands: build, start, clean"
    echo "Example: pnpm docs:build garp"
    exit 1
fi

DOCS_DIR="packages/grammar-definitions/$GRAMMAR/docs"

if [ ! -d "$DOCS_DIR" ]; then
    echo "Error: Documentation directory '$DOCS_DIR' does not exist."
    echo "Run '/grammar.docs $GRAMMAR' to generate documentation first."
    exit 1
fi

case $COMMAND in
    build)
        echo "Building documentation for $GRAMMAR..."
        pnpm --dir "$DOCS_DIR" run build
        echo "Documentation built to $DOCS_DIR/_site/"
        ;;
    start)
        echo "Starting documentation server for $GRAMMAR..."
        pnpm --dir "$DOCS_DIR" run start
        ;;
    clean)
        echo "Cleaning documentation build for $GRAMMAR..."
        pnpm --dir "$DOCS_DIR" run clean
        ;;
    *)
        echo "Unknown command: $COMMAND"
        echo "Valid commands: build, start, clean"
        exit 1
        ;;
esac
