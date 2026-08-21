import { z } from "zod";
import { SUPPORTED_LOCALES } from "@weightloss/contracts";

export const localeSchema = z.enum(SUPPORTED_LOCALES);

export const namedCopySchema = z.object({
  name: z.string().trim().max(120).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
});

export const namedTranslationsSchema = z
  .record(z.string(), namedCopySchema)
  .optional()
  .transform((map) => {
    if (!map) return undefined;
    const next: Record<string, z.infer<typeof namedCopySchema>> = {};
    for (const locale of SUPPORTED_LOCALES) {
      const copy = map[locale];
      if (copy) next[locale] = copy;
    }
    return next;
  });

export const taxonomyBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(120),
  description: z.string().trim().max(5000).nullable().optional(),
  icon: z.preprocess(
    (val) => (typeof val === "string" && val.trim() === "" ? null : val),
    z.string().trim().max(500).nullable().optional(),
  ),
  image: z.preprocess(
    (val) => (typeof val === "string" && val.trim() === "" ? null : val),
    z
      .union([
        z.string().url(),
        z.string().startsWith("/uploads/"),
        z.string().startsWith("/assets/"),
        z.null(),
      ])
      .optional(),
  ),
  imageKey: z.string().trim().nullable().optional(),
  sortOrder: z.number().int().nonnegative(),
  isActive: z.boolean(),
  translations: namedTranslationsSchema,
});

export function formatZodError(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`).join("; ");
}

export function isDuplicateKeyError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: number }).code === 11000,
  );
}
