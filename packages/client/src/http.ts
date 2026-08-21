import type { ApiFailure, ApiSuccess, Paginated } from "./types.js";

export class WeightLossApiError extends Error {
  code: string;
  status: number;
  requestId?: string;

  constructor(code: string, message: string, status = 400, requestId?: string) {
    super(message);
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

type RequestOptions = {
  method?: "GET";
  query?: Record<string, string | number | boolean | undefined>;
  ifNoneMatch?: string;
};

export type ConditionalResult<T> =
  | { notModified: true; etag: string | null }
  | { notModified: false; data: T; etag: string | null };

export type HttpClientOptions = {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  userAgent?: string;
};

export class HttpClient {
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;
  private readonly userAgent: string;

  constructor(options: HttpClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.userAgent = options.userAgent ?? "weightloss-client/1.0";
  }

  async getData<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const result = await this.getConditional<T>(path, options);
    if (result.notModified) {
      throw new WeightLossApiError("NOT_MODIFIED", "Response not modified (304)", 304);
    }
    return result.data;
  }

  async getPaginated<T>(path: string, options: RequestOptions = {}): Promise<Paginated<T>> {
    const result = await this.getConditional<Paginated<T>>(path, options);
    if (result.notModified) {
      throw new WeightLossApiError("NOT_MODIFIED", "Response not modified (304)", 304);
    }
    return result.data;
  }

  async getConditional<T>(path: string, options: RequestOptions = {}): Promise<ConditionalResult<T>> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value === undefined) continue;
        url.searchParams.set(key, String(value));
      }
    }

    let response: Response;
    try {
      response = await this.fetchImpl(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": this.userAgent,
          ...(options.ifNoneMatch ? { "If-None-Match": options.ifNoneMatch } : {}),
        },
      });
    } catch {
      throw new WeightLossApiError("NETWORK_ERROR", `Cannot reach API at ${this.baseUrl}`, 0);
    }

    const etag = response.headers.get("etag");

    if (response.status === 304) {
      return { notModified: true, etag };
    }

    let json: T | ApiFailure;
    try {
      json = (await response.json()) as T | ApiFailure;
    } catch {
      throw new WeightLossApiError(
        "INVALID_RESPONSE",
        `Unexpected response from API (${response.status})`,
        response.status,
      );
    }

    if (typeof json === "object" && json !== null && "success" in json && json.success === false) {
      const failure = json as ApiFailure;
      throw new WeightLossApiError(
        failure.error.code,
        failure.error.message,
        response.status,
        failure.requestId,
      );
    }

    return { notModified: false, data: json as T, etag };
  }
}

export function toQuery(params: Record<string, string | number | boolean | undefined>): Record<string, string | number | boolean | undefined> {
  const query: Record<string, string | number | boolean | undefined> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    query[key] = value;
  }
  return query;
}
