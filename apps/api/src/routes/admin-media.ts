import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import type { FastifyInstance } from "fastify";
import { requireAdminAuth } from "../plugins/auth.js";

const ALLOWED_FOLDERS = new Set([
  "meals",
  "meal-categories",
  "workout-levels",
  "workout-categories",
  "exercises",
]);

const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const VIDEO_MIMES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const LOTTIE_MIMES = new Set(["application/json", "text/json"]);

type MediaKind = "image" | "video" | "lottie";

function extensionForMime(mime: string, filename: string, kind: MediaKind): string {
  if (kind === "lottie") return "json";
  if (kind === "video") {
    switch (mime) {
      case "video/webm":
        return "webm";
      case "video/quicktime":
        return "mov";
      default:
        return "mp4";
    }
  }

  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      break;
  }

  const lower = filename.toLowerCase();
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".mp4")) return "mp4";
  if (lower.endsWith(".webm")) return "webm";
  if (lower.endsWith(".mov")) return "mov";
  return "bin";
}

function resolveMediaKind(
  kindField: string | undefined,
  mime: string,
  filename: string,
): MediaKind | null {
  const normalized = kindField?.trim().toLowerCase();
  if (normalized === "video" || normalized === "lottie" || normalized === "image") {
    return normalized;
  }

  if (IMAGE_MIMES.has(mime)) return "image";
  if (VIDEO_MIMES.has(mime)) return "video";
  if (LOTTIE_MIMES.has(mime) || filename.toLowerCase().endsWith(".json")) return "lottie";
  if (mime.startsWith("video/")) return "video";
  return null;
}

function isAllowedMime(kind: MediaKind, mime: string, filename: string): boolean {
  if (kind === "image") return IMAGE_MIMES.has(mime);
  if (kind === "video") {
    return VIDEO_MIMES.has(mime) || mime.startsWith("video/") || /\.(mp4|webm|mov)$/i.test(filename);
  }
  return LOTTIE_MIMES.has(mime) || filename.toLowerCase().endsWith(".json");
}

function maxBytesForKind(env: { MAX_IMAGE_UPLOAD_MB: number; MAX_VIDEO_UPLOAD_MB: number }, kind: MediaKind): number {
  if (kind === "video") return env.MAX_VIDEO_UPLOAD_MB * 1024 * 1024;
  return env.MAX_IMAGE_UPLOAD_MB * 1024 * 1024;
}

function validationMessage(kind: MediaKind): string {
  if (kind === "video") return "Only MP4, WebM, and MOV videos are allowed";
  if (kind === "lottie") return "Only Lottie JSON files are allowed";
  return "Only JPEG, PNG, WebP, and GIF images are allowed";
}

export async function registerAdminMediaRoutes(app: FastifyInstance) {
  app.post("/api/admin/media/upload", {
    preHandler: requireAdminAuth,
    schema: {
      tags: ["Media"],
      summary: "Upload media file",
      description:
        "Multipart upload. Field name: file. Optional fields: folder (meals, exercises, …), mediaType (image, video, lottie).",
      security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }],
    },
  }, async (request, reply) => {
    const env = app.env;
    const maxBytes = Math.max(env.MAX_IMAGE_UPLOAD_MB, env.MAX_VIDEO_UPLOAD_MB) * 1024 * 1024;

    const file = await request.file({ limits: { fileSize: maxBytes } });
    if (!file) {
      return reply.status(400).send({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "No file uploaded" },
        requestId: request.id,
      });
    }

    const folderField = file.fields.folder;
    const mediaTypeField = file.fields.mediaType;
    const folderValue =
      folderField && "value" in folderField && typeof folderField.value === "string"
        ? folderField.value.trim()
        : "meals";
    const mediaTypeValue =
      mediaTypeField && "value" in mediaTypeField && typeof mediaTypeField.value === "string"
        ? mediaTypeField.value.trim()
        : undefined;
    const folder = ALLOWED_FOLDERS.has(folderValue) ? folderValue : "meals";
    const filename = file.filename ?? "";

    const kind = resolveMediaKind(mediaTypeValue, file.mimetype, filename);
    if (!kind) {
      return reply.status(422).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Unsupported file type. Use mediaType=image, video, or lottie.",
        },
        requestId: request.id,
      });
    }

    if (!isAllowedMime(kind, file.mimetype, filename)) {
      return reply.status(422).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: validationMessage(kind),
        },
        requestId: request.id,
      });
    }

    const kindLimit = maxBytesForKind(env, kind);
    const buffer = await file.toBuffer();
    if (buffer.byteLength > kindLimit) {
      const limitMb = kind === "video" ? env.MAX_VIDEO_UPLOAD_MB : env.MAX_IMAGE_UPLOAD_MB;
      return reply.status(422).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: `File exceeds ${limitMb}MB limit`,
        },
        requestId: request.id,
      });
    }

    if (kind === "lottie") {
      try {
        JSON.parse(buffer.toString("utf8"));
      } catch {
        return reply.status(422).send({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid Lottie JSON file",
          },
          requestId: request.id,
        });
      }
    }

    const ext = extensionForMime(file.mimetype, filename, kind);
    const subfolder = kind === "image" ? "" : `${kind}/`;
    const key = `${folder}/${subfolder}${randomUUID()}.${ext}`;
    const saved = await app.storage.saveStream(key, Readable.from(buffer));

    return reply.send({
      success: true,
      data: {
        url: saved.url,
        key: saved.key,
        bytes: saved.bytes,
        mediaType: kind,
        driver: env.STORAGE_DRIVER,
      },
    });
  });
}
