/**
 * Database Client
 *
 * SQLite database client initialization for job persistence (Phase 2).
 * Currently the job manager uses in-memory storage.
 *
 * @packageDocumentation
 */

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import { createLogger } from '@sanyam/logger';

const logger = createLogger({ name: 'Database' });

/**
 * Database configuration.
 */
export interface DatabaseConfig {
  /** Path to SQLite database file. Use ':memory:' for in-memory. */
  path?: string;
}

/**
 * Database client singleton.
 */
let db: ReturnType<typeof drizzle> | null = null;
let sqliteDb: Database.Database | null = null;

/**
 * Initialize the database client.
 *
 * @param config - Database configuration
 * @returns Drizzle database client
 */
export function initializeDatabase(config?: DatabaseConfig): ReturnType<typeof drizzle> {
  if (db) {
    return db;
  }

  const dbPath = config?.path ?? process.env['SANYAM_DB_PATH'] ?? ':memory:';

  logger.info({ path: dbPath }, 'Initializing database');

  sqliteDb = new Database(dbPath);
  db = drizzle(sqliteDb, { schema });

  // Create tables if they don't exist
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      correlation_id TEXT NOT NULL,
      operation_id TEXT NOT NULL,
      language_id TEXT NOT NULL,
      document_uri TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      progress INTEGER NOT NULL DEFAULT 0,
      message TEXT,
      result TEXT,
      error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
    CREATE INDEX IF NOT EXISTS idx_jobs_correlation_id ON jobs(correlation_id);
  `);

  logger.info('Database initialized');

  return db;
}

/**
 * Get the database client.
 *
 * @throws Error if database not initialized
 */
export function getDatabase(): ReturnType<typeof drizzle> {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

/**
 * Close the database connection.
 */
export function closeDatabase(): void {
  if (sqliteDb) {
    sqliteDb.close();
    sqliteDb = null;
    db = null;
    logger.info('Database closed');
  }
}
