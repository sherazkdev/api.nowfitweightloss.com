import { readFile, writeFile } from "node:fs/promises";
import type { Job } from "bullmq";
import { createCacheService, connectRedis } from "@weightloss/cache";
import type { AppEnv } from "@weightloss/config";
import {
  csvToRawRecords,
  filterCsvRecords,
  getMongo,
  importRawRecords,
  markDataJobCompleted,
  markDataJobFailed,
  markDataJobProcessing,
  updateDataJob,
  validateCsvHeaders,
} from "@weightloss/database";
import { parseCsv } from "@weightloss/shared";
import type { StorageProvider } from "@weightloss/storage";
import type { ImportCsvJobPayload } from "@weightloss/queue";
import { cacheResourcesForImport } from "../lib/cache-bump.js";

export async function processImportCsvJob(
  job: Job<ImportCsvJobPayload>,
  env: AppEnv,
  storage: StorageProvider,
) {
  const { db } = getMongo();
  const payload = job.data;

  await markDataJobProcessing(db, payload.jobId, String(job.id));

  try {
    const filePath = storage.resolvePath(payload.fileKey);
    const content = await readFile(filePath, "utf8");
    const parsed = parseCsv(content, { hasHeaders: payload.options.hasHeaders });
    const headerError = validateCsvHeaders(payload.resource, parsed.headers);
    if (headerError) {
      throw new Error(headerError);
    }

    const mapped = csvToRawRecords(payload.resource, parsed.headers, parsed.rows);
    const { valid, skipped } = filterCsvRecords(payload.resource, mapped, payload.options.skipInvalid);
    if (valid.length === 0) {
      throw new Error(
        skipped > 0 ? "All CSV rows were invalid and skipped" : "CSV file contains no data rows",
      );
    }

    const batchSize = 50;
    let inserted = 0;
    let updated = 0;
    let failed = skipped;

    const redis = await connectRedis(env);
    const cache = createCacheService(redis.cache, env);
    const bumpCache = () => cache.bumpVersions(cacheResourcesForImport(payload.resource));

    for (let offset = 0; offset < valid.length; offset += batchSize) {
      const batch = valid.slice(offset, offset + batchSize);
      const result = await importRawRecords(db, payload.resource, batch, {
        onLocalizeComplete: bumpCache,
      });
      inserted += result.inserted;
      updated += result.updated;
      failed += result.failed;

      const processed = Math.min(offset + batch.length, valid.length);
      const progress = Math.round((processed / valid.length) * 100);
      await updateDataJob(db, payload.jobId, {
        processed,
        successful: inserted + updated,
        failed,
        progress,
      });
      await job.updateProgress(progress);
    }

    await bumpCache();

    await markDataJobCompleted(db, payload.jobId, {
      processed: valid.length + skipped,
      successful: inserted + updated,
      failed,
      resultFileKey: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed";
    await markDataJobFailed(db, payload.jobId, message);
    throw error;
  }
}
