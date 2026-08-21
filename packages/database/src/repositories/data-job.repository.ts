import type { DataJobDocument, DataJobStatus, DataJobType } from "@weightloss/contracts";
import type { Db } from "mongodb";
import { COLLECTIONS } from "../collections.js";
import { nextSequenceId } from "../counters.js";

export type CreateDataJobInput = {
  type: DataJobType;
  resource: string;
  adminId: number;
  fileKey?: string | null;
};

export type UpdateDataJobProgressInput = {
  progress?: number;
  processed?: number;
  successful?: number;
  failed?: number;
  status?: DataJobStatus;
  bullJobId?: string | null;
  resultFileKey?: string | null;
  errorSummary?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
};

export async function createDataJob(db: Db, input: CreateDataJobInput): Promise<DataJobDocument> {
  const now = new Date();
  const id = await nextSequenceId(db, "dataJobs");
  const doc: DataJobDocument = {
    id,
    bullJobId: null,
    type: input.type,
    resource: input.resource,
    status: "queued",
    progress: 0,
    processed: 0,
    successful: 0,
    failed: 0,
    fileKey: input.fileKey ?? null,
    resultFileKey: null,
    errorSummary: null,
    adminId: input.adminId,
    createdAt: now,
    startedAt: null,
    completedAt: null,
    updatedAt: now,
  };

  await db.collection<DataJobDocument>(COLLECTIONS.dataJobs).insertOne(doc);
  return doc;
}

export async function findDataJobById(db: Db, id: number): Promise<DataJobDocument | null> {
  return db.collection<DataJobDocument>(COLLECTIONS.dataJobs).findOne({ id });
}

export async function listDataJobs(
  db: Db,
  options: { adminId?: number; limit?: number } = {},
): Promise<DataJobDocument[]> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
  const query: Record<string, unknown> = {};
  if (options.adminId) query.adminId = options.adminId;

  return db
    .collection<DataJobDocument>(COLLECTIONS.dataJobs)
    .find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}

export async function updateDataJob(
  db: Db,
  id: number,
  patch: UpdateDataJobProgressInput,
): Promise<DataJobDocument | null> {
  const now = new Date();
  const update: Record<string, unknown> = { updatedAt: now };

  if (typeof patch.progress === "number") update.progress = patch.progress;
  if (typeof patch.processed === "number") update.processed = patch.processed;
  if (typeof patch.successful === "number") update.successful = patch.successful;
  if (typeof patch.failed === "number") update.failed = patch.failed;
  if (patch.status) update.status = patch.status;
  if (patch.bullJobId !== undefined) update.bullJobId = patch.bullJobId;
  if (patch.resultFileKey !== undefined) update.resultFileKey = patch.resultFileKey;
  if (patch.errorSummary !== undefined) update.errorSummary = patch.errorSummary;
  if (patch.startedAt !== undefined) update.startedAt = patch.startedAt;
  if (patch.completedAt !== undefined) update.completedAt = patch.completedAt;

  const result = await db
    .collection<DataJobDocument>(COLLECTIONS.dataJobs)
    .findOneAndUpdate({ id }, { $set: update }, { returnDocument: "after" });

  return result ?? null;
}

export async function markDataJobProcessing(
  db: Db,
  id: number,
  bullJobId: string,
): Promise<DataJobDocument | null> {
  return updateDataJob(db, id, {
    status: "processing",
    bullJobId,
    startedAt: new Date(),
    progress: 0,
  });
}

export async function markDataJobCompleted(
  db: Db,
  id: number,
  data: Pick<UpdateDataJobProgressInput, "processed" | "successful" | "failed" | "resultFileKey">,
): Promise<DataJobDocument | null> {
  return updateDataJob(db, id, {
    ...data,
    status: "completed",
    progress: 100,
    completedAt: new Date(),
  });
}

export async function markDataJobFailed(
  db: Db,
  id: number,
  errorSummary: string,
): Promise<DataJobDocument | null> {
  return updateDataJob(db, id, {
    status: "failed",
    errorSummary,
    completedAt: new Date(),
  });
}
