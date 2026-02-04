/**
 * Database Schema
 *
 * Drizzle ORM schema for job persistence (Phase 2).
 * Currently the job manager uses in-memory storage.
 *
 * @packageDocumentation
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

/**
 * Jobs table schema.
 *
 * Stores async operation job records.
 */
export const jobs = sqliteTable('jobs', {
  /** Primary key - UUID */
  id: text('id').primaryKey(),

  /** Correlation ID for request tracing */
  correlationId: text('correlation_id').notNull(),

  /** Operation ID */
  operationId: text('operation_id').notNull(),

  /** Language ID */
  languageId: text('language_id').notNull(),

  /** Document URI */
  documentUri: text('document_uri').notNull(),

  /** Job status: pending, running, completed, failed, cancelled */
  status: text('status').notNull().default('pending'),

  /** Progress percentage (0-100) */
  progress: integer('progress').notNull().default(0),

  /** Progress message */
  message: text('message'),

  /** Operation result (JSON) */
  result: text('result'), // JSON string

  /** Error message */
  error: text('error'),

  /** Creation timestamp (ISO 8601) */
  createdAt: text('created_at').notNull(),

  /** Last update timestamp (ISO 8601) */
  updatedAt: text('updated_at').notNull(),

  /** Completion timestamp (ISO 8601) */
  completedAt: text('completed_at'),
});

/**
 * Type for inserting a job.
 */
export type InsertJob = typeof jobs.$inferInsert;

/**
 * Type for selecting a job.
 */
export type SelectJob = typeof jobs.$inferSelect;
