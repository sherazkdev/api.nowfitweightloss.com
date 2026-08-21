import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { upsertSeedAdmin } from "@weightloss/auth";
import { loadEnvSafe } from "@weightloss/config";
import {
  COLLECTIONS,
  closeMongo,
  connectMongo,
  ensureIndexes,
  getMongo,
} from "@weightloss/database";
import { createLogger } from "@weightloss/logger";

const env = loadEnvSafe();
const log = createLogger({ name: "seed", level: env.LOG_LEVEL });
const reset = process.argv.includes("--reset");

const UPLOAD_FOLDERS = [
  "meals",
  "meal-categories",
  "workout-levels",
  "workout-categories",
  "exercises",
  "imports",
  "exports",
];

async function emptyDir(root: string) {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    await Promise.all(
      entries.map((entry) => rm(path.join(root, entry.name), { recursive: true, force: true })),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

async function resetDatabaseAndUploads() {
  const { db } = getMongo();
  const deleted: Record<string, number> = {};

  for (const name of Object.values(COLLECTIONS)) {
    const result = await db.collection(name).deleteMany({});
    deleted[name] = result.deletedCount;
  }

  const uploadRoots = [
    path.resolve(env.UPLOAD_ROOT),
    path.resolve("apps/api/public/uploads"),
    path.resolve("public/uploads"),
  ];
  const uniqueRoots = [...new Set(uploadRoots.map((root) => path.normalize(root)))];

  for (const root of uniqueRoots) {
    await emptyDir(root);
    for (const folder of UPLOAD_FOLDERS) {
      await mkdir(path.join(root, folder), { recursive: true });
    }
  }

  log.info({ deleted, uploadRoots: uniqueRoots }, "database_and_uploads_cleared");
}

async function main() {
  await connectMongo(env);

  if (reset) {
    await resetDatabaseAndUploads();
  }

  const indexes = await ensureIndexes(getMongo().db);
  log.info({ count: indexes.length }, "indexes_ready");

  const admin = await upsertSeedAdmin(getMongo().db, env);
  log.info(
    {
      email: admin.email,
      created: admin.created,
      action: admin.created ? "created" : "updated",
    },
    "admin_seeded",
  );

  await closeMongo();
}

main().catch((error) => {
  log.fatal({ err: error }, "seed_failed");
  process.exit(1);
});
