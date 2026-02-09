/**
 * Jobs Routes
 *
 * REST endpoints for async job management.
 *
 * @packageDocumentation
 */

import { Hono } from 'hono';
import type { JobManager } from '../../operations/job-manager.js';
import { createLogger } from '@sanyam/logger';
import type { HonoEnv } from '../types.js';

const logger = createLogger({ name: 'JobsRoutes' });

/**
 * Create jobs routes.
 *
 * @param jobManager - Job manager
 * @returns Hono router
 */
export function createJobsRoutes(jobManager: JobManager): Hono<HonoEnv> {
  const router = new Hono<HonoEnv>();

  /**
   * Get all jobs (admin/monitoring).
   *
   * GET /api/v1/jobs
   */
  router.get('/', async (c) => {
    const status = c.req.query('status');
    const correlationId = c.get('correlationId') as string;

    let jobs;
    if (status) {
      jobs = await jobManager.getJobsByStatus(status as any);
    } else {
      jobs = await jobManager.getAllJobs();
    }

    return c.json({
      success: true,
      data: {
        jobs,
        total: jobs.length,
        activeCount: jobManager.getActiveJobCount(),
      },
      correlationId,
    });
  });

  /**
   * Get job status.
   *
   * GET /api/v1/jobs/:jobId
   */
  router.get('/:jobId', async (c) => {
    const jobId = c.req.param('jobId');
    const correlationId = c.get('correlationId') as string;

    const job = await jobManager.getJob(jobId);
    if (!job) {
      return c.json(
        {
          success: false,
          error: `Job not found: ${jobId}`,
          correlationId,
        },
        404
      );
    }

    return c.json({
      success: true,
      data: job,
      correlationId,
    });
  });

  /**
   * Get job result (includes full result data).
   *
   * GET /api/v1/jobs/:jobId/result
   */
  router.get('/:jobId/result', async (c) => {
    const jobId = c.req.param('jobId');
    const correlationId = c.get('correlationId') as string;

    const job = await jobManager.getJobResult(jobId);
    if (!job) {
      return c.json(
        {
          success: false,
          error: `Job not found: ${jobId}`,
          correlationId,
        },
        404
      );
    }

    // Check if job is complete
    if (job.status !== 'completed' && job.status !== 'failed') {
      return c.json(
        {
          success: false,
          error: 'Job not yet complete',
          status: job.status,
          progress: job.progress,
          message: job.message,
          correlationId,
        },
        202 // Accepted but not complete
      );
    }

    return c.json({
      success: true,
      data: job,
      correlationId,
    });
  });

  /**
   * Cancel a job.
   *
   * DELETE /api/v1/jobs/:jobId
   */
  router.delete('/:jobId', async (c) => {
    const jobId = c.req.param('jobId');
    const correlationId = c.get('correlationId') as string;

    const cancelled = await jobManager.cancelJob(jobId);
    if (!cancelled) {
      // Check if job exists
      const job = await jobManager.getJob(jobId);
      if (!job) {
        return c.json(
          {
            success: false,
            error: `Job not found: ${jobId}`,
            correlationId,
          },
          404
        );
      }

      // Job exists but can't be cancelled (already complete)
      return c.json(
        {
          success: false,
          error: `Job cannot be cancelled (status: ${job.status})`,
          correlationId,
        },
        409 // Conflict
      );
    }

    logger.info({ jobId, correlationId }, 'Job cancelled via REST');

    return c.json({
      success: true,
      data: { cancelled: true },
      correlationId,
    });
  });

  return router;
}
