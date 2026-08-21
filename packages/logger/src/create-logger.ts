import pino, { type Logger, type LoggerOptions } from "pino";

export type CreateLoggerOptions = {
  name: string;
  level?: string;
  pretty?: boolean;
};

const REDACT_PATHS = [
  "password",
  "currentPassword",
  "newPassword",
  "confirmPassword",
  "token",
  "accessToken",
  "refreshToken",
  "authorization",
  "cookie",
  "MONGODB_URI",
  "REDIS_URL",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "COOKIE_SECRET",
  "S3_SECRET_ACCESS_KEY",
  "S3_ACCESS_KEY_ID",
  "ADMIN_SEED_PASSWORD",
];

export function createFastifyLoggerOptions(options: CreateLoggerOptions): LoggerOptions {
  const isDev = process.env.NODE_ENV !== "production";
  const usePretty = options.pretty ?? isDev;

  const base: LoggerOptions = {
    name: options.name,
    level: options.level ?? "info",
    redact: {
      paths: REDACT_PATHS,
      censor: "[REDACTED]",
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  if (usePretty) {
    return {
      ...base,
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      },
    };
  }

  return base;
}

export function createLogger(options: CreateLoggerOptions): Logger {
  return pino(createFastifyLoggerOptions(options));
}

export type { Logger };
