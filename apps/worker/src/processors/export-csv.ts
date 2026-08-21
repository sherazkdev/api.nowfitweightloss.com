import { writeFile } from "node:fs/promises";
import type { Job } from "bullmq";
import {
  exportResourceCsv,
  getMongo,
  markDataJobCompleted,
  markDataJobFailed,
  markDataJobProcessing,
  updateDataJob,
} from "@weightloss/database";
import { stringifyCsv } from "@weightloss/shared";
import type { StorageProvider } from "@weightloss/storage";
import type { ExportCsvJobPayload } from "@weightloss/queue";

export async function processExportCsvJob(job: Job<ExportCsvJobPayload>, storage: StorageProvider) {
  const { db } = getMongo();
  const payload = job.data;

  await markDataJobProcessing(db, payload.jobId, String(job.id));

  try {
    await updateDataJob(db, payload.jobId, { progress: 20 });
    await job.updateProgress(20);

    const exported = await exportResourceCsv(db, payload.resource, payload.columns, payload.filters);
    const csv = stringifyCsv(exported.headers, exported.rows);
    const resultFileKey = `exports/job-${payload.jobId}-${payload.resource}.csv`;
    const destination = storage.resolvePath(resultFileKey);
    await writeFile(destination, csv, "utf8");

    await updateDataJob(db, payload.jobId, {
      progress: 90,
      processed: exported.total,
      successful: exported.total,
      failed: 0,
    });
    await job.updateProgress(90);

    await markDataJobCompleted(db, payload.jobId, {
      processed: exported.total,
      successful: exported.total,
      failed: 0,
      resultFileKey,
    });
    await job.updateProgress(100);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export failed";
    await markDataJobFailed(db, payload.jobId, message);
    throw error;
  }
}
