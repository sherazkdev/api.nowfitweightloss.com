"use client";

import { useMemo, useState } from "react";
import { PublicShell } from "@/components/public/public-shell";
import { PrimaryButton, SecondaryButton } from "@/components/ui/buttons";
import { FormField, Select, TextInput, Textarea } from "@/components/ui/fields";
import {
  ALL_ENDPOINT_GROUPS,
  authBadge,
  endpointRequiresCredential,
  type EndpointRow,
} from "@/lib/api-endpoints";
import { SUPPORTED_LOCALES } from "@/lib/locales";
import { cn } from "@/lib/cn";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

function pathParams(path: string) {
  return [...path.matchAll(/:([A-Za-z]+)/g)].map((match) => match[1]);
}

function defaultQuery(row: EndpointRow) {
  if (row.auth === "bearer" || row.path.startsWith("/api/v1/workout-reminders") || row.path.startsWith("/api/v1/devices")) {
    if (row.method === "GET" && row.path === "/api/v1/workout-reminders") return "gender=male";
    return "";
  }
  if (row.method === "GET" && row.path === "/api/admin/workout-reminders") return "page=1&limit=20";
  if (row.method === "GET" && row.path === "/api/admin/devices") return "page=1&limit=20";
  if (row.method === "GET" && row.path === "/api/admin/delivery-logs") return "page=1&limit=20&days=30";
  if (row.method === "GET" && row.path === "/api/admin/delivery-logs/summary") return "days=30";
  if (row.path.startsWith("/api/v1/") && !row.path.includes("openapi") && row.path !== "/api/v1/") {
    return "lang=en";
  }
  return "";
}

function defaultBody(row: EndpointRow) {
  if (row.path === "/api/v1/workout-reminders" && (row.method === "POST" || row.method === "PUT")) {
    return JSON.stringify(
      { hour: 7, minute: 0, days: [1, 2, 3, 4, 5], enabled: true, gender: "male", timezone: "Asia/Karachi" },
      null,
      2,
    );
  }
  if (row.path.endsWith("/toggle") && row.method === "PATCH") {
    return JSON.stringify({ enabled: true }, null, 2);
  }
  if (row.path === "/api/v1/devices" && row.method === "POST") {
    return JSON.stringify({ fcm_token: "FCM_DEVICE_TOKEN", platform: "android" }, null, 2);
  }
  if (row.path === "/api/v1/devices" && row.method === "DELETE") {
    return JSON.stringify({ fcm_token: "FCM_DEVICE_TOKEN" }, null, 2);
  }
  if (row.path === "/api/admin/fcm/test-notification") {
    return JSON.stringify({ fcm_token: "FCM_DEVICE_TOKEN", platform: "android" }, null, 2);
  }
  if (row.method === "GET" || row.method === "DELETE") return "";
  if (row.path.includes("login")) {
    return JSON.stringify({ email: "admin@example.com", password: "your-password" }, null, 2);
  }
  if (row.path.includes("api-keys") && row.method === "POST") {
    return JSON.stringify({ name: "playground-key" }, null, 2);
  }
  if (row.path.includes("meal-categories") && (row.method === "POST" || row.method === "PUT")) {
    return JSON.stringify(
      { name: "Breakfast", slug: "breakfast", description: null, icon: null, image: null, sortOrder: 0, isActive: true },
      null,
      2,
    );
  }
  if (row.method === "POST" || row.method === "PUT" || row.method === "PATCH") {
    return "{\n  \n}";
  }
  return "";
}

function usesJsonBody(row: EndpointRow) {
  if (row.method === "GET") return false;
  if (row.method === "DELETE") return row.path === "/api/v1/devices";
  return true;
}

export default function EndpointsPage() {
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<EndpointRow>(PUBLIC_DEFAULT);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [query, setQuery] = useState(defaultQuery(PUBLIC_DEFAULT));
  const [body, setBody] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [bearer, setBearer] = useState("");
  const [status, setStatus] = useState<number | null>(null);
  const [responseText, setResponseText] = useState("Pick an endpoint and click Send.");
  const [authError, setAuthError] = useState("");
  const [sending, setSending] = useState(false);

  const needle = filter.trim().toLowerCase();
  const params = pathParams(selected.path);
  const needsCredential = endpointRequiresCredential(selected);
  const firebaseOnly = selected.auth === "bearer";
  const hasCredential = firebaseOnly ? Boolean(bearer.trim()) : Boolean(apiKey.trim() || bearer.trim());

  const resolvedPath = useMemo(() => {
    let path = selected.path;
    for (const name of pathParams(path)) {
      path = path.replace(`:${name}`, encodeURIComponent(paramValues[name] || name));
    }
    return path;
  }, [paramValues, selected.path]);

  function choose(row: EndpointRow) {
    setSelected(row);
    setParamValues({});
    setQuery(defaultQuery(row));
    setBody(defaultBody(row));
    setStatus(null);
    setAuthError("");
  }

  async function send() {
    if (needsCredential && !hasCredential) {
      setAuthError(
        firebaseOnly
          ? "Paste a Firebase ID token in Bearer first."
          : "Paste an x-api-key or Bearer token first. The API will not return data without one.",
      );
      setStatus(401);
      setResponseText(
        JSON.stringify(
          {
            success: false,
            error: {
              code: "UNAUTHORIZED",
              message: "Authentication required. Send Bearer JWT or x-api-key header.",
            },
          },
          null,
          2,
        ),
      );
      return;
    }

    setSending(true);
    setStatus(null);
    setAuthError("");
    const url = new URL(`${API_URL}${resolvedPath}`);
    const extra = query.trim();
    if (extra) {
      const parsed = new URLSearchParams(extra.includes("=") || extra.includes("&") ? extra : `q=${extra}`);
      parsed.forEach((value, key) => url.searchParams.set(key, value));
    }
    const headers: Record<string, string> = {};
    if (apiKey.trim()) headers["x-api-key"] = apiKey.trim();
    if (bearer.trim()) headers.Authorization = `Bearer ${bearer.trim()}`;
    const init: RequestInit = { method: selected.method, headers };
    if (usesJsonBody(selected) && body.trim()) {
      headers["Content-Type"] = "application/json";
      init.body = body;
    }
    try {
      const res = await fetch(url.toString(), init);
      setStatus(res.status);
      const text = await res.text();
      try {
        setResponseText(JSON.stringify(JSON.parse(text), null, 2));
      } catch {
        setResponseText(text || "(empty response)");
      }
    } catch (err) {
      setStatus(0);
      setResponseText(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <PublicShell active="endpoints">
      <main className="px-5 py-6 md:px-8">
        <div className="mb-6">
          <h1 className="text-[18px] font-semibold leading-7 tracking-tight">API playground</h1>
          <p className="mt-1 max-w-3xl text-[14px] leading-5 text-[var(--text-muted)]">
            Content APIs need an <strong>x-api-key</strong> or admin Bearer — without one the API returns 401.
            Mobile reminders need a <strong>Firebase ID token</strong> in Bearer (not x-api-key). Content GETs also
            need <code className="rounded bg-[var(--surface-muted)] px-1">lang</code>. Secrets stay in this tab only.
          </p>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <FormField
            label="x-api-key"
            required={needsCredential && !firebaseOnly}
            error={authError && !hasCredential ? authError : undefined}
            hint={
              firebaseOnly
                ? "Not used for mobile reminders. Use Firebase Bearer instead."
                : "From Admin → API Keys. Either this or Bearer is enough."
            }
          >
            <TextInput
              value={apiKey}
              onChange={(event) => {
                setApiKey(event.target.value);
                setAuthError("");
              }}
              placeholder="wl_…"
              autoComplete="off"
            />
          </FormField>
          <FormField
            label="Bearer token"
            required={needsCredential}
            hint={
              firebaseOnly
                ? "Firebase ID token from the mobile app. Required for reminders/devices."
                : "From POST /api/admin/login. Either this or x-api-key is enough."
            }
          >
            <TextInput
              value={bearer}
              onChange={(event) => {
                setBearer(event.target.value);
                setAuthError("");
              }}
              placeholder={firebaseOnly ? "Firebase ID token" : "JWT from /api/admin/login"}
              autoComplete="off"
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <section className="rounded-[16px] border border-[var(--border)] bg-[var(--card-bg)] p-4">
            <TextInput
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Filter endpoints…"
              className="mb-3"
            />
            <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
              {ALL_ENDPOINT_GROUPS.map((group) => {
                const rows = group.rows.filter(
                  (row) =>
                    !needle ||
                    row.path.toLowerCase().includes(needle) ||
                    row.desc.toLowerCase().includes(needle) ||
                    row.method.toLowerCase().includes(needle),
                );
                if (rows.length === 0) return null;
                return (
                  <div key={group.id}>
                    <h2 className="mb-2 text-[13px] font-semibold">{group.title}</h2>
                    <ul className="flex flex-col gap-1">
                      {rows.map((row) => {
                        const active = row.method === selected.method && row.path === selected.path;
                        const badge = authBadge(row.auth);
                        return (
                          <li key={`${row.method}-${row.path}`}>
                            <button
                              type="button"
                              onClick={() => choose(row)}
                              className={cn(
                                "flex w-full flex-col rounded-[10px] px-3 py-2 text-left transition-colors",
                                active ? "bg-[var(--nav-active-bg)]" : "hover:bg-[var(--surface-hover)]",
                              )}
                            >
                              <span className="flex items-center gap-2">
                                <span className="rounded-[6px] bg-[var(--pastel-purple)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--static-black)]">
                                  {row.method}
                                </span>
                                <span className="truncate font-mono text-[12px]">{row.path}</span>
                              </span>
                              <span className="mt-1 text-[11px] text-[var(--text-muted)]">
                                {badge.label} · {row.desc}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-[16px] border border-[var(--border)] bg-[var(--card-bg)] p-4">
            <p className="mb-3 font-mono text-[13px]">
              {selected.method} {API_URL}
              {resolvedPath}
            </p>
            {params.length > 0 ? (
              <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {params.map((name) => (
                  <FormField key={name} label={`:${name}`}>
                    <TextInput
                      value={paramValues[name] ?? ""}
                      onChange={(event) =>
                        setParamValues((current) => ({ ...current, [name]: event.target.value }))
                      }
                      placeholder={name}
                    />
                  </FormField>
                ))}
              </div>
            ) : null}
            <FormField
              label="Query string"
              hint={
                firebaseOnly
                  ? "Example: gender=male"
                  : "Example: lang=hi&page=1&limit=20"
              }
            >
              <TextInput
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={firebaseOnly ? "gender=male" : "lang=en"}
              />
            </FormField>
            {selected.auth === "public" ? (
              <FormField label="lang" className="mt-3">
                <Select
                  value={new URLSearchParams(query).get("lang") ?? "en"}
                  onChange={(event) => {
                    const params = new URLSearchParams(query);
                    params.set("lang", event.target.value);
                    setQuery(params.toString());
                  }}
                >
                  {SUPPORTED_LOCALES.map((locale) => (
                    <option key={locale} value={locale}>
                      {locale}
                    </option>
                  ))}
                </Select>
              </FormField>
            ) : null}
            {usesJsonBody(selected) ? (
              <FormField label="JSON body" className="mt-3">
                <Textarea value={body} onChange={(event) => setBody(event.target.value)} className="min-h-[140px] font-mono text-[12px]" />
              </FormField>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <PrimaryButton type="button" loading={sending} loadingLabel="Sending…" onClick={() => void send()}>
                Send request
              </PrimaryButton>
              <SecondaryButton
                type="button"
                onClick={() => {
                  setResponseText("Pick an endpoint and click Send.");
                  setStatus(null);
                }}
              >
                Clear response
              </SecondaryButton>
            </div>
            <p className="mt-4 text-[12px] text-[var(--text-muted)]">
              {status === null ? "No response yet" : `HTTP ${status}`}
            </p>
            <pre className="mt-2 max-h-[360px] overflow-auto rounded-[12px] bg-[var(--page-bg)] p-3 font-mono text-[12px] leading-5">
              {responseText}
            </pre>
          </section>
        </div>
      </main>
    </PublicShell>
  );
}

const PUBLIC_DEFAULT: EndpointRow = {
  method: "GET",
  path: "/api/v1/meal-categories",
  desc: "List active meal categories",
  auth: "bearer-or-key",
  group: "Public v1",
};
