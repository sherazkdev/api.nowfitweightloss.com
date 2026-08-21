import type { Readable } from "node:stream";

export type StorageSaveResult = {
  key: string;
  url: string;
  bytes: number;
};

export interface StorageProvider {
  saveStream(relativeKey: string, stream: Readable): Promise<StorageSaveResult>;
  publicUrl(relativeKey: string): string;
  resolvePath(relativeKey: string): string;
}
