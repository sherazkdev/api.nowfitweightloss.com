import { Queue } from "bullmq";
import type { AppEnv } from "@weightloss/config";
import type { Redis } from "ioredis";
import { queueName } from "./connection.js";
import {
  JOB_NAMES,
  QUEUE_SUFFIX,
  type ExportCsvJobPayload,
  type ImportCsvJobPayload,
  type RawImportJobPayload,
} from "./types.js";

export class QueueService {
  private readonly importQueue: Queue;
  private readonly exportQueue: Queue;
  private readonly rawQueue: Queue;

  constructor(
    private readonly env: AppEnv,
    connection: Redis,
  ) {
    const defaultJobOptions = {
      attempts: env.QUEUE_JOB_ATTEMPTS,
      backoff: {
        type: "exponential" as const,
        delay: env.QUEUE_BACKOFF_MS,
      },
      removeOnComplete: 100,
      removeOnFail: 200,
    };

    this.importQueue = new Queue(queueName(env, QUEUE_SUFFIX.import), {
      connection,
      defaultJobOptions,
    });
    this.exportQueue = new Queue(queueName(env, QUEUE_SUFFIX.export), {
      connection,
      defaultJobOptions,
    });
    this.rawQueue = new Queue(queueName(env, QUEUE_SUFFIX.raw), {
      connection,
      defaultJobOptions,
    });
  }

  async enqueueImportCsv(payload: ImportCsvJobPayload) {
    const job = await this.importQueue.add(JOB_NAMES.importCsv, payload, {
      jobId: `import-csv-${payload.jobId}`,
    });
    return job.id ?? null;
  }

  async enqueueExportCsv(payload: ExportCsvJobPayload) {
    const job = await this.exportQueue.add(JOB_NAMES.exportCsv, payload, {
      jobId: `export-csv-${payload.jobId}`,
    });
    return job.id ?? null;
  }

  async enqueueRawImport(payload: RawImportJobPayload) {
    const job = await this.rawQueue.add(JOB_NAMES.rawImport, payload, {
      jobId: `raw-import-${payload.jobId}`,
    });
    return job.id ?? null;
  }

  async getQueueStats(): Promise<Record<string, Record<string, number>>> {
    const [importCounts, exportCounts, rawCounts] = await Promise.all([
      this.importQueue.getJobCounts(
        "waiting",
        "active",
        "completed",
        "failed",
        "delayed",
        "paused",
      ),
      this.exportQueue.getJobCounts(
        "waiting",
        "active",
        "completed",
        "failed",
        "delayed",
        "paused",
      ),
      this.rawQueue.getJobCounts(
        "waiting",
        "active",
        "completed",
        "failed",
        "delayed",
        "paused",
      ),
    ]);

    return {
      import: importCounts,
      export: exportCounts,
      raw: rawCounts,
    };
  }

  async close() {
    await Promise.all([
      this.importQueue.close(),
      this.exportQueue.close(),
      this.rawQueue.close(),
    ]);
  }
}

export function createQueueService(env: AppEnv, connection: Redis): QueueService {
  return new QueueService(env, connection);
}
