import { loadEnvSafe } from "@weightloss/config";
import { closeRedis, connectRedis } from "@weightloss/cache";
import { connectMongo } from "@weightloss/database";
import { initFirebase, isFirebaseConfigured } from "@weightloss/firebase";
import { createLogger } from "@weightloss/logger";
import {
  createQueueConnection,
  JOB_NAMES,
  queueName,
  QUEUE_SUFFIX,
} from "@weightloss/queue";
import { createStorageProvider } from "@weightloss/storage";
import { Worker } from "bullmq";
import { processExportCsvJob } from "./processors/export-csv.js";
import { processImportCsvJob } from "./processors/import-csv.js";
import { processRawImportJob } from "./processors/raw-import.js";
import { processWorkoutReminders } from "./processors/workout-reminders.js";
import { refreshNotificationSnapshots } from "./processors/notification-snapshots.js";

const env = loadEnvSafe();
const log = createLogger({ name: "weightloss-worker", level: env.LOG_LEVEL });

async function main() {
  if (env.STORAGE_DRIVER !== "local") {
    log.warn({ driver: env.STORAGE_DRIVER }, "worker expects local storage for file jobs");
  }

  await connectMongo(env);
  const redis = await connectRedis(env);
  const connection = createQueueConnection(env);
  const storage = createStorageProvider(env);

  const importWorker = new Worker(
    queueName(env, QUEUE_SUFFIX.import),
    async (job) => {
      if (job.name === JOB_NAMES.importCsv) {
        await processImportCsvJob(job, env, storage);
        return;
      }
      throw new Error(`Unknown import job: ${job.name}`);
    },
    {
      connection,
      concurrency: env.QUEUE_IMPORT_CONCURRENCY,
    },
  );

  const exportWorker = new Worker(
    queueName(env, QUEUE_SUFFIX.export),
    async (job) => {
      if (job.name === JOB_NAMES.exportCsv) {
        await processExportCsvJob(job, storage);
        return;
      }
      throw new Error(`Unknown export job: ${job.name}`);
    },
    {
      connection,
      concurrency: env.QUEUE_EXPORT_CONCURRENCY,
    },
  );

  const rawWorker = new Worker(
    queueName(env, QUEUE_SUFFIX.raw),
    async (job) => {
      if (job.name === JOB_NAMES.rawImport) {
        await processRawImportJob(job, env, storage);
        return;
      }
      throw new Error(`Unknown raw job: ${job.name}`);
    },
    {
      connection,
      concurrency: env.QUEUE_IMPORT_CONCURRENCY,
    },
  );

  for (const worker of [importWorker, exportWorker, rawWorker]) {
    worker.on("completed", (job) => {
      log.info({ jobId: job.id, name: job.name }, "job_completed");
    });
    worker.on("failed", (job, error) => {
      log.error({ jobId: job?.id, name: job?.name, err: error }, "job_failed");
    });
  }

  let reminderTimer: NodeJS.Timeout | undefined;
  let snapshotTimer: NodeJS.Timeout | undefined;

  if (env.NOTIFICATION_SNAPSHOT_REFRESH_MS > 0) {
    const snapshotTick = () => {
      void refreshNotificationSnapshots(env, redis.cache).catch((error) => {
        log.error({ err: error }, "notification_snapshot_refresh_failed");
      });
    };
    snapshotTick();
    snapshotTimer = setInterval(snapshotTick, env.NOTIFICATION_SNAPSHOT_REFRESH_MS);
    log.info(
      { intervalMs: env.NOTIFICATION_SNAPSHOT_REFRESH_MS },
      "notification_snapshot_refresh_started",
    );
  }

  if (env.WORKOUT_REMINDERS_CRON_ENABLED && isFirebaseConfigured(env)) {
    initFirebase(env);
    const tick = () => {
      void processWorkoutReminders(env).catch((error) => {
        log.error({ err: error }, "workout_reminder_cron_failed");
      });
    };
    tick();
    reminderTimer = setInterval(tick, env.WORKOUT_REMINDERS_CRON_INTERVAL_MS);
    log.info(
      {
        intervalMs: env.WORKOUT_REMINDERS_CRON_INTERVAL_MS,
        projectId: env.FIREBASE_PROJECT_ID,
      },
      "workout_reminder_cron_started",
    );
  } else {
    log.warn("workout_reminder_cron_disabled");
  }

  log.info(
    {
      queuePrefix: env.QUEUE_PREFIX,
      uploadRoot: env.UPLOAD_ROOT,
      importConcurrency: env.QUEUE_IMPORT_CONCURRENCY,
      exportConcurrency: env.QUEUE_EXPORT_CONCURRENCY,
    },
    "worker_started",
  );

  const shutdown = async (signal: string) => {
    log.info({ signal }, "worker_shutting_down");
    if (reminderTimer) clearInterval(reminderTimer);
    if (snapshotTimer) clearInterval(snapshotTimer);
    await Promise.all([importWorker.close(), exportWorker.close(), rawWorker.close()]);
    await connection.quit();
    await closeRedis();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

void main().catch((error) => {
  log.fatal({ err: error }, "worker_start_failed");
  process.exit(1);
});
