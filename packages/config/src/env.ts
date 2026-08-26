import { z } from "zod";
import { loadDotenvOnce } from "./load-dotenv.js";

const boolFromEnv = z
  .union([z.literal("true"), z.literal("false"), z.boolean()])
  .transform((value) => value === true || value === "true");

const optionalUrl = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

const positiveInt = (defaultValue: number) =>
  z.coerce.number().int().positive().default(defaultValue);

const nonNegativeInt = (defaultValue: number) =>
  z.coerce.number().int().nonnegative().default(defaultValue);

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  APP_NAME: z.string().default("WeightLoss"),
  APP_VERSION: z.string().default("1.0.0"),

  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(5000),

  API_PUBLIC_URL: z.string().url().default("http://localhost:5000"),
  ADMIN_PUBLIC_URL: z.string().url().default("http://localhost:3000"),

  ALLOWED_ORIGINS: z
    .string()
    .default("http://localhost:3000")
    .transform((value) =>
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),

  MONGODB_URI: z.string().min(1),
  MONGODB_DB: z.string().min(1).default("weight_loss"),

  MONGODB_MIN_POOL_SIZE: positiveInt(5),
  MONGODB_MAX_POOL_SIZE: positiveInt(50),
  MONGODB_MAX_IDLE_TIME_MS: positiveInt(60000),
  MONGODB_SERVER_SELECTION_TIMEOUT_MS: positiveInt(5000),
  MONGODB_CONNECT_TIMEOUT_MS: positiveInt(5000),

  REDIS_URL: z.string().min(1),
  REDIS_CACHE_URL: optionalUrl,
  REDIS_QUEUE_URL: optionalUrl,
  REDIS_AUTH_URL: optionalUrl,
  REDIS_KEY_PREFIX: z.string().default("weightloss:"),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  JWT_ISSUER: z.string().default("weightloss-api"),
  JWT_AUDIENCE: z.string().default("weightloss-admin"),

  COOKIE_SECRET: z.string().min(16),
  REFRESH_COOKIE_NAME: z.string().default("wl_refresh"),
  COOKIE_DOMAIN: z.string().optional().default(""),
  COOKIE_SECURE: boolFromEnv.default(false),
  COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),

  ADMIN_SEED_ENABLED: boolFromEnv.default(true),
  ADMIN_SEED_NAME: z.string().default("Admin"),
  ADMIN_SEED_EMAIL: z.string().email().default("admin@example.com"),
  ADMIN_SEED_PASSWORD: z.string().min(8),

  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  UPLOAD_ROOT: z.string().default("public/uploads"),
  TEMP_UPLOAD_ROOT: z.string().default("tmp"),
  PUBLIC_MEDIA_BASE_URL: z.string().url().default("http://localhost:5000/uploads"),

  MAX_IMAGE_UPLOAD_MB: positiveInt(10),
  MAX_VIDEO_UPLOAD_MB: positiveInt(100),
  MAX_DATA_UPLOAD_MB: positiveInt(100),
  MAX_ZIP_UPLOAD_MB: positiveInt(500),
  MAX_ZIP_UNCOMPRESSED_MB: positiveInt(2048),
  MAX_ZIP_FILES: positiveInt(10000),
  MAX_IMAGE_PIXELS: positiveInt(50000000),

  CACHE_ENABLED: boolFromEnv.default(true),
  CACHE_DEFAULT_TTL_SECONDS: positiveInt(300),
  CACHE_DETAIL_TTL_SECONDS: positiveInt(600),
  CACHE_LIST_TTL_SECONDS: positiveInt(300),
  CACHE_DASHBOARD_TTL_SECONDS: positiveInt(60),
  CACHE_ADMIN_NOTIFICATIONS_TTL_SECONDS: positiveInt(30),
  CACHE_ADMIN_SUMMARY_TTL_SECONDS: positiveInt(90),
  NOTIFICATION_SNAPSHOT_REFRESH_MS: positiveInt(60000),
  CACHE_NEGATIVE_TTL_SECONDS: positiveInt(30),
  CACHE_STAMPEDE_LOCK_MS: positiveInt(5000),

  DEFAULT_PAGE_SIZE: positiveInt(20),
  MAX_PAGE_SIZE: positiveInt(100),
  ADMIN_DEFAULT_PAGE_SIZE: positiveInt(25),
  ADMIN_MAX_PAGE_SIZE: positiveInt(100),

  RATE_LIMIT_ENABLED: boolFromEnv.default(true),
  RATE_LIMIT_PUBLIC_MAX: positiveInt(300),
  RATE_LIMIT_PUBLIC_WINDOW: z.string().default("1 minute"),
  RATE_LIMIT_ADMIN_MAX: positiveInt(180),
  RATE_LIMIT_ADMIN_WINDOW: z.string().default("1 minute"),
  RATE_LIMIT_LOGIN_MAX: positiveInt(5),
  RATE_LIMIT_LOGIN_WINDOW: z.string().default("15 minutes"),
  RATE_LIMIT_UPLOAD_MAX: positiveInt(30),
  RATE_LIMIT_UPLOAD_WINDOW: z.string().default("1 hour"),
  RATE_LIMIT_IMPORT_MAX: positiveInt(10),
  RATE_LIMIT_IMPORT_WINDOW: z.string().default("1 hour"),

  QUEUE_PREFIX: z.string().default("weightloss"),
  QUEUE_IMPORT_CONCURRENCY: positiveInt(2),
  QUEUE_EXPORT_CONCURRENCY: positiveInt(2),
  QUEUE_MEDIA_CONCURRENCY: positiveInt(2),
  QUEUE_ARCHIVE_CONCURRENCY: positiveInt(1),
  QUEUE_JOB_ATTEMPTS: positiveInt(3),
  QUEUE_BACKOFF_MS: positiveInt(3000),

  API_DOCS_ENABLED: boolFromEnv.default(true),
  TRUST_PROXY: boolFromEnv.default(false),

  METRICS_ENABLED: boolFromEnv.default(true),
  METRICS_PATH: z.string().default("/metrics"),
  METRICS_TOKEN: z.string().optional().default(""),

  API_LEGACY_SUNSET: z.string().default("2027-06-01"),

  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  SLOW_REQUEST_MS: positiveInt(300),
  SLOW_DB_QUERY_MS: positiveInt(100),

  S3_ENDPOINT: z.string().optional().default(""),
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: z.string().optional().default(""),
  S3_ACCESS_KEY_ID: z.string().optional().default(""),
  S3_SECRET_ACCESS_KEY: z.string().optional().default(""),
  S3_PUBLIC_BASE_URL: z.string().optional().default(""),

  FIREBASE_PROJECT_ID: z.string().optional().default(""),
  FIREBASE_CLIENT_EMAIL: z.string().optional().default(""),
  FIREBASE_PRIVATE_KEY: z.string().optional().default(""),

  WORKOUT_REMINDERS_CRON_ENABLED: boolFromEnv.default(true),
  WORKOUT_REMINDERS_CRON_INTERVAL_MS: positiveInt(60000),
}).superRefine((data, ctx) => {
  if (data.STORAGE_DRIVER === "s3") {
    if (!data.S3_BUCKET?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["S3_BUCKET"],
        message: "S3_BUCKET is required when STORAGE_DRIVER=s3",
      });
    }
    if (!data.S3_ACCESS_KEY_ID?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["S3_ACCESS_KEY_ID"],
        message: "S3_ACCESS_KEY_ID is required when STORAGE_DRIVER=s3",
      });
    }
    if (!data.S3_SECRET_ACCESS_KEY?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["S3_SECRET_ACCESS_KEY"],
        message: "S3_SECRET_ACCESS_KEY is required when STORAGE_DRIVER=s3",
      });
    }
  }

  if (data.NODE_ENV !== "production") return;

  const weakSecret = (value: string) =>
    value.includes("CHANGE_ME") || value.length < 32;

  if (data.ADMIN_SEED_ENABLED && process.env.WL_CLI_BOOTSTRAP !== "1") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["ADMIN_SEED_ENABLED"],
      message: "Set ADMIN_SEED_ENABLED=false in production after bootstrap",
    });
  }

  if (!data.COOKIE_SECURE) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["COOKIE_SECURE"],
      message: "COOKIE_SECURE must be true in production",
    });
  }

  if (weakSecret(data.JWT_ACCESS_SECRET)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["JWT_ACCESS_SECRET"],
      message: "Use a strong JWT_ACCESS_SECRET (32+ chars, not a placeholder) in production",
    });
  }

  if (weakSecret(data.JWT_REFRESH_SECRET)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["JWT_REFRESH_SECRET"],
      message: "Use a strong JWT_REFRESH_SECRET (32+ chars, not a placeholder) in production",
    });
  }

  if (weakSecret(data.COOKIE_SECRET)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["COOKIE_SECRET"],
      message: "Use a strong COOKIE_SECRET (32+ chars, not a placeholder) in production",
    });
  }

  if (data.METRICS_ENABLED && !data.METRICS_TOKEN?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["METRICS_TOKEN"],
      message: "Set METRICS_TOKEN when METRICS_ENABLED=true in production",
    });
  }
});

export type AppEnv = z.infer<typeof envSchema>;

export type ResolvedRedisUrls = {
  cache: string;
  queue: string;
  auth: string;
};

export function resolveRedisUrls(env: AppEnv): ResolvedRedisUrls {
  return {
    cache: env.REDIS_CACHE_URL ?? env.REDIS_URL,
    queue: env.REDIS_QUEUE_URL ?? env.REDIS_URL,
    auth: env.REDIS_AUTH_URL ?? env.REDIS_URL,
  };
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  loadDotenvOnce();
  return envSchema.parse(source);
}

export function loadEnvSafe(source: NodeJS.ProcessEnv = process.env): AppEnv {
  loadDotenvOnce();
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}
