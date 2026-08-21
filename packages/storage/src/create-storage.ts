import type { AppEnv } from "@weightloss/config";
import { createLocalStorageProvider } from "./local-storage.js";
import { createS3StorageProvider } from "./s3-storage.js";
import type { StorageProvider } from "./types.js";

export function createStorageProvider(env: AppEnv): StorageProvider {
  if (env.STORAGE_DRIVER === "s3") {
    return createS3StorageProvider(env);
  }
  return createLocalStorageProvider(env);
}
