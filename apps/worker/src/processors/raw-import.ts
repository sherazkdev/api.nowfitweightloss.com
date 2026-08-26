import { readFile } from "node:fs/promises";
import type { Job } from "bullmq";
import { createCacheService, connectRedis } from "@weightloss/cache";
import type { AppEnv } from "@weightloss/config";
import {
  extractRawRecords,
  getMongo,
  importRawRecords,
  markDataJobCompleted,
  markDataJobFailed,
  markDataJobProcessing,
  updateDataJob,
} from "@weightloss/database";
import type { StorageProvider } from "@weightloss/storage";
import type { RawImportJobPayload } from "@weightloss/queue";
import { cacheResourcesForImport } from "../lib/cache-bump.js";

export async function processRawImportJob(
  job: Job<RawImportJobPayload>,
  env: AppEnv,
  storage: StorageProvider,
) {
  const { db } = getMongo();
  const payload = job.data;

  await markDataJobProcessing(db, payload.jobId, String(job.id));

  try {
    const filePath = storage.resolvePath(payload.fileKey);
    const content = await readFile(filePath, "utf8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("Invalid JSON payload");
    }

    const records = extractRawRecords(parsed);
    if (!records || records.length === 0) {
      throw new Error("No records found in JSON payload");
    }

    const batchSize = 50;
    let inserted = 0;
    let updated = 0;
    let failed = 0;

    const redis = await connectRedis(env);
    const cache = createCacheService(redis.cache, env);
    const bumpCache = () => cache.bumpVersions(cacheResourcesForImport(payload.resource));

    for (let offset = 0; offset < records.length; offset += batchSize) {
      const batch = records.slice(offset, offset + batchSize);
      const result = await importRawRecords(db, payload.resource, batch, {
        onLocalizeComplete: bumpCache,
      });
      inserted += result.inserted;
      updated += result.updated;
      failed += result.failed;

      const processed = Math.min(offset + batch.length, records.length);
      const progress = Math.round((processed / records.length) * 100);
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
      processed: records.length,
      successful: inserted + updated,
      failed,
      resultFileKey: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Raw import failed";
    await markDataJobFailed(db, payload.jobId, message);
    throw error;
  }
}
