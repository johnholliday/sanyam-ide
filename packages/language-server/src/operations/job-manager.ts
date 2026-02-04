/**
 * Job Manager
 *
 * Manages async operation jobs with SQLite persistence.
 * Tracks job status, progress, and results.
 *
 * @packageDocumentation
 */

import { randomUUID } from 'crypto';
import type { JobStatus, JobInfo, JobResult, OperationResult } from '@sanyam/types';
import { createLogger } from '@sanyam/logger';

const logger = createLogger({ name: 'JobManager' });

/**
 * In-memory job record.
 */
interface JobRecord {
  id: string;
  correlationId: string;
  operationId: string;
  languageId: string;
  documentUri: string;
  status: JobStatus;
  progress: number;
  message?: string;
  result?: OperationResult;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

/**
 * Job manager configuration.
 */
export interface JobManagerConfig {
  /** Maximum age of completed jobs before cleanup (ms). Default: 1 hour */
  maxJobAgeMs?: number;

  /** Cleanup interval (ms). Default: 5 minutes */
  cleanupIntervalMs?: number;

  /** Path to SQLite database file (optional, uses in-memory if not provided) */
  databasePath?: string;
}

/**
 * Manages async operation jobs.
 *
 * Currently uses in-memory storage for simplicity.
 * Phase 2 will add SQLite persistence via Drizzle.
 */
export class JobManager {
  private readonly jobs = new Map<string, JobRecord>();
  private readonly config: Required<JobManagerConfig>;
  private cleanupTimer?: ReturnType<typeof setInterval>;

  constructor(config?: JobManagerConfig) {
    this.config = {
      maxJobAgeMs: config?.maxJobAgeMs ?? 60 * 60 * 1000, // 1 hour
      cleanupIntervalMs: config?.cleanupIntervalMs ?? 5 * 60 * 1000, // 5 minutes
      databasePath: config?.databasePath ?? ':memory:',
    };

    // Start cleanup timer
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldJobs();
    }, this.config.cleanupIntervalMs);

    logger.info({ config: this.config }, 'Job manager initialized');
  }

  /**
   * Create a new job.
   *
   * @param correlationId - Correlation ID for tracing
   * @param operationId - Operation ID
   * @param languageId - Language ID
   * @param documentUri - Document URI
   * @returns The new job ID
   */
  async createJob(
    correlationId: string,
    operationId: string,
    languageId: string,
    documentUri: string
  ): Promise<string> {
    const id = randomUUID();
    const now = new Date();

    const job: JobRecord = {
      id,
      correlationId,
      operationId,
      languageId,
      documentUri,
      status: 'pending',
      progress: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.jobs.set(id, job);

    logger.debug(
      { jobId: id, correlationId, operationId },
      'Job created'
    );

    return id;
  }

  /**
   * Get job info.
   *
   * @param jobId - Job ID
   * @returns Job info or undefined if not found
   */
  async getJob(jobId: string): Promise<JobInfo | undefined> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return undefined;
    }

    return this.toJobInfo(job);
  }

  /**
   * Get job result (full result including operation result).
   *
   * @param jobId - Job ID
   * @returns Job result or undefined if not found
   */
  async getJobResult(jobId: string): Promise<JobResult | undefined> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return undefined;
    }

    return {
      ...this.toJobInfo(job),
      result: job.result,
      error: job.error,
    };
  }

  /**
   * Update job status.
   *
   * @param jobId - Job ID
   * @param status - New status
   */
  async updateJobStatus(jobId: string, status: JobStatus): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      logger.warn({ jobId }, 'Attempted to update non-existent job');
      return;
    }

    job.status = status;
    job.updatedAt = new Date();

    logger.debug({ jobId, status }, 'Job status updated');
  }

  /**
   * Update job progress.
   *
   * @param jobId - Job ID
   * @param progress - Progress percentage (0-100)
   * @param message - Optional progress message
   */
  async updateJobProgress(jobId: string, progress: number, message?: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return;
    }

    job.progress = Math.min(100, Math.max(0, progress));
    if (message !== undefined) {
      job.message = message;
    }
    job.updatedAt = new Date();
  }

  /**
   * Mark job as completed with result.
   *
   * @param jobId - Job ID
   * @param result - Operation result
   */
  async completeJob(jobId: string, result: OperationResult): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      logger.warn({ jobId }, 'Attempted to complete non-existent job');
      return;
    }

    const now = new Date();
    job.status = 'completed';
    job.progress = 100;
    job.result = result;
    job.updatedAt = now;
    job.completedAt = now;

    logger.info(
      { jobId, success: result.success },
      'Job completed'
    );
  }

  /**
   * Mark job as failed with error.
   *
   * @param jobId - Job ID
   * @param error - Error message
   */
  async failJob(jobId: string, error: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      logger.warn({ jobId }, 'Attempted to fail non-existent job');
      return;
    }

    const now = new Date();
    job.status = 'failed';
    job.error = error;
    job.updatedAt = now;
    job.completedAt = now;

    logger.warn({ jobId, error }, 'Job failed');
  }

  /**
   * Cancel a running job.
   *
   * @param jobId - Job ID
   * @returns True if job was cancelled
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return false;
    }

    // Can only cancel pending or running jobs
    if (job.status !== 'pending' && job.status !== 'running') {
      return false;
    }

    const now = new Date();
    job.status = 'cancelled';
    job.updatedAt = now;
    job.completedAt = now;

    logger.info({ jobId }, 'Job cancelled');

    return true;
  }

  /**
   * Get all jobs (for monitoring/debugging).
   *
   * @returns Array of job info
   */
  async getAllJobs(): Promise<JobInfo[]> {
    return Array.from(this.jobs.values()).map((job) => this.toJobInfo(job));
  }

  /**
   * Get jobs by status.
   *
   * @param status - Status to filter by
   * @returns Array of job info
   */
  async getJobsByStatus(status: JobStatus): Promise<JobInfo[]> {
    return Array.from(this.jobs.values())
      .filter((job) => job.status === status)
      .map((job) => this.toJobInfo(job));
  }

  /**
   * Clean up old completed jobs.
   */
  private cleanupOldJobs(): void {
    const cutoff = Date.now() - this.config.maxJobAgeMs;
    let cleanedCount = 0;

    for (const [id, job] of this.jobs.entries()) {
      // Only clean up completed/failed/cancelled jobs
      if (
        job.completedAt &&
        job.completedAt.getTime() < cutoff
      ) {
        this.jobs.delete(id);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug({ cleanedCount }, 'Cleaned up old jobs');
    }
  }

  /**
   * Convert job record to job info.
   */
  private toJobInfo(job: JobRecord): JobInfo {
    return {
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      message: job.message,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
      completedAt: job.completedAt?.toISOString(),
    };
  }

  /**
   * Dispose of the job manager.
   */
  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.jobs.clear();
    logger.info('Job manager disposed');
  }

  /**
   * Get count of active jobs (pending or running).
   */
  getActiveJobCount(): number {
    let count = 0;
    for (const job of this.jobs.values()) {
      if (job.status === 'pending' || job.status === 'running') {
        count++;
      }
    }
    return count;
  }

  /**
   * Get total job count.
   */
  getTotalJobCount(): number {
    return this.jobs.size;
  }
}
