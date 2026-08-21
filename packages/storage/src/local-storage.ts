import { createWriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { AppEnv } from "@weightloss/config";
import { normalizeRelativeKey } from "./key.js";
import type { StorageProvider, StorageSaveResult } from "./types.js";

export class LocalStorageProvider implements StorageProvider {
  private readonly uploadRoot: string;
  private readonly publicBaseUrl: string;

  constructor(env: AppEnv) {
    this.uploadRoot = path.resolve(env.UPLOAD_ROOT);
    this.publicBaseUrl = env.PUBLIC_MEDIA_BASE_URL.replace(/\/$/, "");
  }

  resolvePath(relativeKey: string): string {
    const normalized = normalizeRelativeKey(relativeKey);
    return path.join(this.uploadRoot, normalized);
  }

  publicUrl(relativeKey: string): string {
    const normalized = normalizeRelativeKey(relativeKey);
    return `${this.publicBaseUrl}/${normalized}`;
  }

  async saveStream(relativeKey: string, stream: Readable): Promise<StorageSaveResult> {
    const normalized = normalizeRelativeKey(relativeKey);
    const destination = path.join(this.uploadRoot, normalized);
    await mkdir(path.dirname(destination), { recursive: true });
    await pipeline(stream, createWriteStream(destination));
    const fileStat = await stat(destination);
    return {
      key: normalized,
      url: this.publicUrl(normalized),
      bytes: fileStat.size,
    };
  }
}

export function createLocalStorageProvider(env: AppEnv): LocalStorageProvider {
  return new LocalStorageProvider(env);
}
