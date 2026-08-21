import { SUPPORTED_LOCALES } from "@weightloss/contracts";
import type { FastifySchema } from "fastify";

export const PUBLIC_LOCALE_ENUM = [...SUPPORTED_LOCALES];

export const LANG_QUERY_DESCRIPTION =
  "Required locale. Pick from the dropdown (en, hi, es, …). Example: /api/v1/meals?lang=hi. If that locale has no translation, English text is returned (fallback).";

export const langOpenApiParameter = {
  name: "lang",
  in: "query" as const,
  required: true,
  description: LANG_QUERY_DESCRIPTION,
  schema: {
    type: "string" as const,
    enum: PUBLIC_LOCALE_ENUM,
    example: "en",
  },
  example: "en",
};

export const langQuerystringProperty = {
  type: "string" as const,
  enum: PUBLIC_LOCALE_ENUM,
  description: LANG_QUERY_DESCRIPTION,
};

const PUBLIC_ROUTE_SECURITY: Array<{ [securityLabel: string]: string[] }> = [
  { ApiKeyAuth: [] },
  { BearerAuth: [] },
];

export function publicGetRouteSchema(opts: {
  summary: string;
  hide?: boolean;
  langRequired?: boolean;
  queryProperties?: Record<string, object>;
  params?: Record<string, object>;
}): FastifySchema {
  const langRequired = opts.langRequired !== false;
  return {
    ...(opts.hide ? { hide: true as const } : {}),
    tags: ["Content"],
    summary: opts.summary,
    security: PUBLIC_ROUTE_SECURITY,
    description: langRequired
      ? "`lang` is required. Send `x-api-key` or Bearer JWT. Try it out → Authorize → pick **lang** → Execute."
      : "API discovery. Requires x-api-key or Bearer JWT. Content GETs also require lang.",
    querystring: {
      type: "object" as const,
      additionalProperties: true,
      ...(langRequired ? { required: ["lang"] } : {}),
      properties: {
        lang: langQuerystringProperty,
        ...opts.queryProperties,
      },
    },
    ...(opts.params
      ? {
          params: {
            type: "object" as const,
            required: Object.keys(opts.params),
            properties: opts.params,
          },
        }
      : {}),
  };
}
