import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { requireAdminAuth } from "../plugins/auth.js";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const ALLOWED_FOLDERS = new Set([
  "meals",
  "meal-categories",
  "workout-levels",
  "workout-categories",
  "exercises",
]);

function extensionForMime(mime: string): string {
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
      return "bin";
  }
}

export async function registerAdminMediaRoutes(app: FastifyInstance) {
  app.post("/api/admin/media/upload", {
    preHandler: requireAdminAuth,
    schema: {
      tags: ["Media"],
      summary: "Upload image",
      description: "Multipart image upload. Field name: file. Optional field: folder (meals, meal-categories, workout-levels, workout-categories, exercises).",
      security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }],
    },
  }, async (request, reply) => {
    const env = app.env;
    const maxBytes = env.MAX_IMAGE_UPLOAD_MB * 1024 * 1024;

    const file = await request.file({ limits: { fileSize: maxBytes } });
    if (!file) {
      return reply.status(400).send({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "No file uploaded" },
        requestId: request.id,
      });
    }

    const folderField = file.fields.folder;
    const folderValue =
      folderField && "value" in folderField && typeof folderField.value === "string"
        ? folderField.value.trim()
        : "meals";
    const folder = ALLOWED_FOLDERS.has(folderValue) ? folderValue : "meals";

    const mime = file.mimetype;
    if (!ALLOWED_MIME.has(mime)) {
      return reply.status(422).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Only JPEG, PNG, WebP, and GIF images are allowed",
        },
        requestId: request.id,
      });
    }

    const ext = extensionForMime(mime);
    const key = `${folder}/${randomUUID()}.${ext}`;
    const saved = await app.storage.saveStream(key, file.file);

    return reply.send({
      success: true,
      data: {
        url: saved.url,
        key: saved.key,
        bytes: saved.bytes,
        driver: env.STORAGE_DRIVER,
      },
    });
  });
}
