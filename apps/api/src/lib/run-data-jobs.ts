import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import type { CacheResource } from "@weightloss/cache";
import {
  csvToRawRecords,
  extractRawRecords,
  exportResourceCsv,
  filterCsvRecords,
  getMongo,
  importRawRecords,
  markDataJobCompleted,
  markDataJobFailed,
  markDataJobProcessing,
  validateCsvHeaders,
  type ExportColumnDef,
  type ExportFilters,
  type RawImportResource,
} from "@weightloss/database";
import { parseCsv, stringifyCsv } from "@weightloss/shared";
import { bumpContentCache } from "./cache-bump.js";

const CACHE_MAP: Record<RawImportResource, CacheResource> = {
  "meal-categories": "mealCategories",
  meals: "meals",
  "workout-levels": "workoutLevels",
  "workout-categories": "workoutCategories",
  exercises: "exercises",
};

async function failJob(jobId: number, error: unknown, fallback: string) {
  const { db } = getMongo();
  const message = error instanceof Error ? error.message : fallback;
  await markDataJobFailed(db, jobId, message);
  return message;
}

export async function runRawImportNow(
  app: FastifyInstance,
  jobId: number,
  resource: RawImportResource,
  payloadText: string,
) {
  const { db } = getMongo();
  await markDataJobProcessing(db, jobId, "inline");

  try {
    let parsed: unknown;
    try {
      parsed = JSON.parse(payloadText);
    } catch {
      throw new Error("Invalid JSON payload");
    }

    const records = extractRawRecords(parsed);
    if (!records || records.length === 0) {
      throw new Error("No records found in JSON payload");
    }

    const result = await importRawRecords(db, resource, records);
    await bumpContentCache(app, [CACHE_MAP[resource]]);

    return await markDataJobCompleted(db, jobId, {
      processed: records.length,
      successful: result.inserted + result.updated,
      failed: result.failed,
      resultFileKey: null,
    });
  } catch (error) {
    await failJob(jobId, error, "Raw import failed");
    throw error;
  }
}

export async function runCsvImportNow(
  app: FastifyInstance,
  jobId: number,
  resource: RawImportResource,
  fileKey: string,
  options: { hasHeaders: boolean; skipInvalid: boolean },
) {
  const { db } = getMongo();
  await markDataJobProcessing(db, jobId, "inline");

  try {
    const filePath = app.storage.resolvePath(fileKey);
    const content = await readFile(filePath, "utf8");
    const parsed = parseCsv(content, { hasHeaders: options.hasHeaders });
    const headerError = validateCsvHeaders(resource, parsed.headers);
    if (headerError) {
      throw new Error(headerError);
    }

    const mapped = csvToRawRecords(resource, parsed.headers, parsed.rows);
    const { valid, skipped } = filterCsvRecords(resource, mapped, options.skipInvalid);
    if (valid.length === 0) {
      throw new Error(
        skipped > 0 ? "All CSV rows were invalid and skipped" : "CSV file contains no data rows",
      );
    }

    const result = await importRawRecords(db, resource, valid);
    await bumpContentCache(app, [CACHE_MAP[resource]]);

    return await markDataJobCompleted(db, jobId, {
      processed: valid.length + skipped,
      successful: result.inserted + result.updated,
      failed: result.failed + skipped,
      resultFileKey: null,
    });
  } catch (error) {
    await failJob(jobId, error, "CSV import failed");
    throw error;
  }
}

export async function runCsvExportNow(
  app: FastifyInstance,
  jobId: number,
  resource: RawImportResource,
  columns: ExportColumnDef[],
  filters: ExportFilters,
) {
  const { db } = getMongo();
  await markDataJobProcessing(db, jobId, "inline");

  try {
    const exported = await exportResourceCsv(db, resource, columns, filters);
    const csv = stringifyCsv(exported.headers, exported.rows);
    const resultFileKey = `exports/job-${jobId}-${resource}.csv`;
    const destination = app.storage.resolvePath(resultFileKey);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, csv, "utf8");

    return await markDataJobCompleted(db, jobId, {
      processed: exported.total,
      successful: exported.total,
      failed: 0,
      resultFileKey,
    });
  } catch (error) {
    await failJob(jobId, error, "CSV export failed");
    throw error;
  }
}
