import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import type { AppEnv } from "@weightloss/config";
import type { Readable } from "node:stream";
import { normalizeRelativeKey } from "./key.js";
import type { StorageProvider, StorageSaveResult } from "./types.js";

function resolvePublicBaseUrl(env: AppEnv): string {
  const fromS3 = env.S3_PUBLIC_BASE_URL?.trim();
  if (fromS3) return fromS3.replace(/\/$/, "");

  const bucket = env.S3_BUCKET?.trim();
  const endpoint = env.S3_ENDPOINT?.trim();

  if (endpoint && bucket) {
    const base = endpoint.replace(/\/$/, "");
    const forcePathStyle = !endpoint.includes("amazonaws.com");
    return forcePathStyle ? `${base}/${bucket}` : base;
  }

  if (bucket) {
    const region = env.S3_REGION === "auto" ? "us-east-1" : env.S3_REGION;
    return `https://${bucket}.s3.${region}.amazonaws.com`;
  }

  return env.PUBLIC_MEDIA_BASE_URL.replace(/\/$/, "");
}

export class S3StorageProvider implements StorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(env: AppEnv) {
    const bucket = env.S3_BUCKET?.trim();
    const accessKeyId = env.S3_ACCESS_KEY_ID?.trim();
    const secretAccessKey = env.S3_SECRET_ACCESS_KEY?.trim();

    if (!bucket || !accessKeyId || !secretAccessKey) {
      throw new Error(
        "S3 storage requires S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY",
      );
    }

    this.bucket = bucket;
    const endpoint = env.S3_ENDPOINT?.trim() || undefined;
    const forcePathStyle = Boolean(endpoint && !endpoint.includes("amazonaws.com"));

    this.client = new S3Client({
      region: env.S3_REGION === "auto" ? "us-east-1" : env.S3_REGION,
      endpoint,
      forcePathStyle,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    this.publicBaseUrl = resolvePublicBaseUrl(env);
  }

  resolvePath(relativeKey: string): string {
    const key = normalizeRelativeKey(relativeKey);
    return `s3://${this.bucket}/${key}`;
  }

  publicUrl(relativeKey: string): string {
    const key = normalizeRelativeKey(relativeKey);
    return `${this.publicBaseUrl}/${key}`;
  }

  async saveStream(relativeKey: string, stream: Readable): Promise<StorageSaveResult> {
    const key = normalizeRelativeKey(relativeKey);
    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: stream,
      },
    });

    await upload.done();

    const head = await this.client.send(
      new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    return {
      key,
      url: this.publicUrl(key),
      bytes: head.ContentLength ?? 0,
    };
  }
}

export function createS3StorageProvider(env: AppEnv): S3StorageProvider {
  return new S3StorageProvider(env);
}
