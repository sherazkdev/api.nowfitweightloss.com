import { apiGet } from "@/lib/api-client";

export type SystemDependencyStatus = {
  ok: boolean;
  latencyMs: number;
  error?: string;
};

export type SystemStatusApi = {
  status: "healthy" | "degraded";
  checkedAt: string;
  api: {
    name: string;
    version: string;
    nodeEnv: string;
    uptimeSeconds: number;
    publicUrl: string;
    adminUrl: string;
  };
  dependencies: {
    mongo: SystemDependencyStatus;
    redis: SystemDependencyStatus;
  };
  cache: {
    enabled: boolean;
    listTtlSeconds: number;
    versions: Record<string, number>;
  };
  queues: {
    totals: { waiting: number; active: number; failed: number };
    byQueue: Record<string, Record<string, number>>;
  };
  storage: {
    driver: string;
    uploadRoot: string;
    publicMediaBaseUrl: string;
  };
  features: {
    metricsEnabled: boolean;
    metricsPath: string;
    apiDocsEnabled: boolean;
    publicOpenApi: string;
    publicDocsUi: string | null;
  };
};

export async function fetchSystemStatus(): Promise<SystemStatusApi> {
  return apiGet<SystemStatusApi>("/api/admin/system");
}
