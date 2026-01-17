/**
 * Position Utility Helpers (T054)
 *
 * Utilities for working with LSP positions and ranges.
 *
 * @packageDocumentation
 */

import type { Position, Range } from 'vscode-languageserver';
import type { AstNode, CstNode, LangiumDocument } from 'langium';

// Helper to get the document for an AST node
function getDocument(node: AstNode): LangiumDocument | undefined {
  let current: AstNode | undefined = node;
  while (current?.$container) {
    current = current.$container;
  }
  return (current as any)?.$document;
}

/**
 * Create a position from line and character.
 */
export function createPosition(line: number, character: number): Position {
  return { line, character };
}

/**
 * Create a range from start and end positions.
 */
export function createRange(start: Position, end: Position): Range {
  return { start, end };
}

/**
 * Create a range from line/character numbers.
 */
export function createRangeFromNumbers(
  startLine: number,
  startChar: number,
  endLine: number,
  endChar: number
): Range {
  return {
    start: { line: startLine, character: startChar },
    end: { line: endLine, character: endChar },
  };
}

/**
 * Check if a position is before another position.
 */
export function isBefore(a: Position, b: Position): boolean {
  return a.line < b.line || (a.line === b.line && a.character < b.character);
}

/**
 * Check if a position is after another position.
 */
export function isAfter(a: Position, b: Position): boolean {
  return a.line > b.line || (a.line === b.line && a.character > b.character);
}

/**
 * Check if two positions are equal.
 */
export function positionsEqual(a: Position, b: Position): boolean {
  return a.line === b.line && a.character === b.character;
}

/**
 * Check if a position is within a range.
 */
export function positionInRange(position: Position, range: Range): boolean {
  if (isBefore(position, range.start)) {
    return false;
  }
  if (isAfter(position, range.end)) {
    return false;
  }
  return true;
}

/**
 * Check if two ranges overlap.
 */
export function rangesOverlap(a: Range, b: Range): boolean {
  // a starts after b ends
  if (isAfter(a.start, b.end)) {
    return false;
  }
  // a ends before b starts
  if (isBefore(a.end, b.start)) {
    return false;
  }
  return true;
}

/**
 * Check if range a contains range b.
 */
export function rangeContains(outer: Range, inner: Range): boolean {
  return (
    !isBefore(inner.start, outer.start) &&
    !isAfter(inner.end, outer.end)
  );
}

/**
 * Check if two ranges are equal.
 */
export function rangesEqual(a: Range, b: Range): boolean {
  return positionsEqual(a.start, b.start) && positionsEqual(a.end, b.end);
}

/**
 * Get the intersection of two ranges.
 */
export function rangeIntersection(a: Range, b: Range): Range | null {
  if (!rangesOverlap(a, b)) {
    return null;
  }

  const start = isAfter(a.start, b.start) ? a.start : b.start;
  const end = isBefore(a.end, b.end) ? a.end : b.end;

  return { start, end };
}

/**
 * Get the union of two ranges.
 */
export function rangeUnion(a: Range, b: Range): Range {
  const start = isBefore(a.start, b.start) ? a.start : b.start;
  const end = isAfter(a.end, b.end) ? a.end : b.end;

  return { start, end };
}

/**
 * Check if a range is empty (start equals end).
 */
export function isEmptyRange(range: Range): boolean {
  return positionsEqual(range.start, range.end);
}

/**
 * Get range for an AST node.
 */
export function getNodeRange(node: AstNode): Range | undefined {
  const cstNode = node.$cstNode;
  if (!cstNode) {
    return undefined;
  }

  const doc = getDocument(node);
  if (!doc) {
    return undefined;
  }

  return {
    start: doc.textDocument.positionAt(cstNode.offset),
    end: doc.textDocument.positionAt(cstNode.offset + cstNode.length),
  };
}

/**
 * Get range for a CST node in a document.
 */
export function getCstNodeRange(cstNode: CstNode, document: LangiumDocument): Range {
  return {
    start: document.textDocument.positionAt(cstNode.offset),
    end: document.textDocument.positionAt(cstNode.offset + cstNode.length),
  };
}

/**
 * Convert offset to position in a document.
 */
export function offsetToPosition(
  offset: number,
  document: LangiumDocument
): Position {
  return document.textDocument.positionAt(offset);
}

/**
 * Convert position to offset in a document.
 */
export function positionToOffset(
  position: Position,
  document: LangiumDocument
): number {
  return document.textDocument.offsetAt(position);
}

/**
 * Compare two positions.
 * Returns -1 if a < b, 0 if a == b, 1 if a > b.
 */
export function comparePositions(a: Position, b: Position): number {
  if (a.line < b.line) return -1;
  if (a.line > b.line) return 1;
  if (a.character < b.character) return -1;
  if (a.character > b.character) return 1;
  return 0;
}

/**
 * Get the minimum position.
 */
export function minPosition(...positions: Position[]): Position {
  return positions.reduce((min, pos) =>
    isBefore(pos, min) ? pos : min
  );
}

/**
 * Get the maximum position.
 */
export function maxPosition(...positions: Position[]): Position {
  return positions.reduce((max, pos) =>
    isAfter(pos, max) ? pos : max
  );
}

/**
 * Get line count in a range.
 */
export function getLineCount(range: Range): number {
  return range.end.line - range.start.line + 1;
}

/**
 * Move a position by lines and/or characters.
 */
export function movePosition(
  position: Position,
  lines: number,
  characters: number
): Position {
  return {
    line: Math.max(0, position.line + lines),
    character: Math.max(0, position.character + characters),
  };
}

/**
 * Extend a range by positions.
 */
export function extendRange(
  range: Range,
  startLines: number,
  startChars: number,
  endLines: number,
  endChars: number
): Range {
  return {
    start: movePosition(range.start, -startLines, -startChars),
    end: movePosition(range.end, endLines, endChars),
  };
}
