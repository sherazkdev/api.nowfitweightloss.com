/**
 * Smoke-test platform + admin notification APIs.
 * Usage: npx tsx scripts/verify-apis.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

type CheckResult = {
  name: string;
  ok: boolean;
  status?: number;
  ms?: number;
  detail?: string;
};

const API_BASE = process.env.API_PUBLIC_URL ?? "http://localhost:5000";

function loadEnv(): Record<string, string> {
  const path = resolve(process.cwd(), ".env");
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    out[trimmed.slice(0, idx)] = trimmed.slice(idx + 1).replace(/^["']|["']$/g, "");
  }
  return out;
}

async function timedFetch(
  name: string,
  url: string,
  init?: RequestInit,
): Promise<CheckResult> {
  const started = performance.now();
  try {
    const response = await fetch(url, init);
    const ms = Math.round(performance.now() - started);
    let detail = "";
    if (!response.ok) {
      try {
        const body = (await response.json()) as { error?: { message?: string } };
        detail = body.error?.message ?? response.statusText;
      } catch {
        detail = response.statusText;
      }
    }
    return {
      name,
      ok: response.ok,
      status: response.status,
      ms,
      detail: detail || undefined,
    };
  } catch (error) {
    return {
      name,
      ok: false,
      ms: Math.round(performance.now() - started),
      detail: error instanceof Error ? error.message : "Network error",
    };
  }
}

async function main() {
  const env = loadEnv();
  const email = env.ADMIN_SEED_EMAIL ?? "admin@example.com";
  const password = env.ADMIN_SEED_PASSWORD ?? "admin@123";

  const results: CheckResult[] = [];

  results.push(await timedFetch("GET /health", `${API_BASE}/health`));
  results.push(await timedFetch("GET /ready", `${API_BASE}/ready`));

  const publicRoot = await timedFetch("GET /api/v1/ (no auth)", `${API_BASE}/api/v1/`);
  results.push({
    ...publicRoot,
    ok: publicRoot.status === 401,
    name: "GET /api/v1/ requires auth",
    detail: publicRoot.status === 401 ? "Expected 401 without credentials" : publicRoot.detail,
  });

  const loginRes = await fetch(`${API_BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!loginRes.ok) {
    results.push({
      name: "POST /api/admin/login",
      ok: false,
      status: loginRes.status,
      detail: "Cannot continue without admin token",
    });
    printReport(results);
    process.exit(1);
  }

  const loginJson = (await loginRes.json()) as {
    success: boolean;
    data?: { accessToken?: string };
  };
  const token = loginJson.data?.accessToken;
  if (!token) {
    results.push({ name: "POST /api/admin/login", ok: false, detail: "Missing accessToken" });
    printReport(results);
    process.exit(1);
  }

  results.push({ name: "POST /api/admin/login", ok: true, status: 200 });

  const authHeaders = { Authorization: `Bearer ${token}` };

  const adminGets = [
    "/api/admin/dashboard",
    "/api/admin/system",
    "/api/admin/meals",
    "/api/admin/meal-categories",
    "/api/admin/workout-levels",
    "/api/admin/workout-categories",
    "/api/admin/exercises",
    "/api/admin/workout-reminders/summary",
    "/api/admin/workout-reminders?page=1&limit=5",
    "/api/admin/devices/summary",
    "/api/admin/devices?page=1&limit=5",
    "/api/admin/fcm/overview",
    "/api/admin/delivery-logs/summary?days=30",
    "/api/admin/delivery-logs?page=1&limit=5",
    "/api/admin/jobs",
    "/api/admin/api-keys",
  ];

  for (const path of adminGets) {
    results.push(await timedFetch(`GET ${path}`, `${API_BASE}${path}`, { headers: authHeaders }));
  }

  // Notification list response shape checks
  for (const path of [
    "/api/admin/workout-reminders?page=1&limit=5",
    "/api/admin/devices?page=1&limit=5",
    "/api/admin/delivery-logs?page=1&limit=5",
  ]) {
    const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders });
    if (res.ok) {
      const json = (await res.json()) as { success: boolean; data?: Record<string, unknown> };
      const data = json.data ?? {};
      const hasItems = Array.isArray(data.items);
      const hasPagination = typeof data.pagination === "object" && data.pagination !== null;
      results.push({
        name: `Shape ${path}`,
        ok: hasItems && hasPagination,
        detail: hasItems && hasPagination ? undefined : "Expected { items, pagination }",
      });
    }
  }

  for (const path of [
    "/api/admin/workout-reminders/summary",
    "/api/admin/devices/summary",
    "/api/admin/fcm/overview",
    "/api/admin/delivery-logs/summary?days=30",
  ]) {
    const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders });
    if (res.ok) {
      const json = (await res.json()) as { success: boolean; data?: Record<string, unknown> };
      const data = json.data ?? {};
      results.push({
        name: `Shape ${path}`,
        ok: typeof data.stats === "object" && data.stats !== null,
        detail: typeof data.stats === "object" ? undefined : "Expected stats object",
      });
    }
  }

  // Media upload: tiny PNG + Lottie JSON
  const pngBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const pngBuffer = Buffer.from(pngBase64, "base64");
  const pngForm = new FormData();
  pngForm.append("file", new Blob([pngBuffer], { type: "image/png" }), "pixel.png");
  pngForm.append("folder", "exercises");
  pngForm.append("mediaType", "image");

  const pngUpload = await fetch(`${API_BASE}/api/admin/media/upload`, {
    method: "POST",
    headers: authHeaders,
    body: pngForm,
  });
  results.push({
    name: "POST /api/admin/media/upload (image)",
    ok: pngUpload.ok,
    status: pngUpload.status,
    detail: pngUpload.ok ? undefined : await pngUpload.text(),
  });

  const lottieJson = JSON.stringify({ v: "5.7.4", fr: 30, ip: 0, op: 30, w: 100, h: 100, layers: [] });
  const lottieForm = new FormData();
  lottieForm.append("file", new Blob([lottieJson], { type: "application/json" }), "test.json");
  lottieForm.append("folder", "exercises");
  lottieForm.append("mediaType", "lottie");

  const lottieUpload = await fetch(`${API_BASE}/api/admin/media/upload`, {
    method: "POST",
    headers: authHeaders,
    body: lottieForm,
  });
  results.push({
    name: "POST /api/admin/media/upload (lottie)",
    ok: lottieUpload.ok,
    status: lottieUpload.status,
    detail: lottieUpload.ok ? undefined : await lottieUpload.text(),
  });

  printReport(results);
  const failed = results.filter((row) => !row.ok);
  process.exit(failed.length === 0 ? 0 : 1);
}

function printReport(results: CheckResult[]) {
  const failed = results.filter((row) => !row.ok);
  console.log("\n=== API Verification Report ===\n");
  for (const row of results) {
    const icon = row.ok ? "PASS" : "FAIL";
    const timing = row.ms != null ? ` (${row.ms}ms)` : "";
    const status = row.status != null ? ` [${row.status}]` : "";
    console.log(`${icon} ${row.name}${status}${timing}${row.detail ? ` — ${row.detail}` : ""}`);
  }
  console.log(`\nTotal: ${results.length} | Passed: ${results.length - failed.length} | Failed: ${failed.length}\n`);
}

void main();
