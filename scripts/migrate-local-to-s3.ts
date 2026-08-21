import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { loadEnvSafe } from "@weightloss/config";
import { createS3StorageProvider, normalizeRelativeKey } from "@weightloss/storage";

async function walkFiles(root: string, prefix = ""): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(absolute, relative)));
    } else if (entry.isFile()) {
      files.push(relative);
    }
  }

  return files;
}

async function main() {
  const env = loadEnvSafe();
  if (env.STORAGE_DRIVER !== "s3") {
    throw new Error("Set STORAGE_DRIVER=s3 before running migration");
  }

  const uploadRoot = path.resolve(env.UPLOAD_ROOT);
  const uploadRootStat = await stat(uploadRoot).catch(() => null);
  if (!uploadRootStat?.isDirectory()) {
    console.log(`No local upload directory at ${uploadRoot}`);
    return;
  }

  const storage = createS3StorageProvider(env);
  const files = await walkFiles(uploadRoot);

  if (files.length === 0) {
    console.log("No local files to migrate");
    return;
  }

  let migrated = 0;
  for (const relative of files) {
    const key = normalizeRelativeKey(relative.replace(/\\/g, "/"));
    const stream = createReadStream(path.join(uploadRoot, relative));
    const saved = await storage.saveStream(key, stream);
    migrated += 1;
    console.log(`Uploaded ${saved.key} (${saved.bytes} bytes)`);
  }

  console.log(`Migration complete: ${migrated}/${files.length} files uploaded to S3`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
