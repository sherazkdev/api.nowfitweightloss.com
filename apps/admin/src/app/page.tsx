"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { PublicShell } from "@/components/public/public-shell";
import { adminPath } from "@/lib/admin-path";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

type ApiStatus = {
  health: "ok" | "error" | "loading";
  ready: "ok" | "error" | "loading";
  mealCount: number | null;
};

export default function PublicHomePage() {
  const [status, setStatus] = useState<ApiStatus>({
    health: "loading",
    ready: "loading",
    mealCount: null,
  });

  useEffect(() => {
    void (async () => {
      try {
        const healthRes = await fetch(`${API_URL}/health`);
        setStatus((s) => ({ ...s, health: healthRes.ok ? "ok" : "error" }));
      } catch {
        setStatus((s) => ({ ...s, health: "error" }));
      }
      try {
        const readyRes = await fetch(`${API_URL}/ready`);
        const readyJson = (await readyRes.json()) as { success?: boolean };
        setStatus((s) => ({ ...s, ready: readyRes.ok && readyJson.success ? "ok" : "error" }));
      } catch {
        setStatus((s) => ({ ...s, ready: "error" }));
      }
      try {
        const mealsRes = await fetch(`${API_URL}/api/v1/meals?lang=en&limit=1`);
        const mealsJson = (await mealsRes.json()) as { pagination?: { total?: number } };
        setStatus((s) => ({
          ...s,
          mealCount: typeof mealsJson.pagination?.total === "number" ? mealsJson.pagination.total : null,
        }));
      } catch {
        setStatus((s) => ({ ...s, mealCount: null }));
      }
    })();
  }, []);

  return (
    <PublicShell active="home">
      <main className="px-5 py-8 md:px-8 md:py-10">
        <div className="mx-auto max-w-5xl">
        <section className="mb-10 md:mb-12">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--pastel-blue)] px-3 py-1 text-[12px] leading-[18px] text-[var(--static-black)]">
            <Icon name="leaf" size={14} />
            WeightLoss Pro
          </p>
          <h1 className="typo-display mb-4 max-w-2xl text-ink">
            Meals and workouts for your apps
          </h1>
          <p className="typo-lead mb-8 max-w-xl text-[var(--text-muted)]">
            Publish a meal and exercise catalog from admin, then ship it to mobile clients over the
            public content API. English-first, with optional locales when you need them.
          </p>

          <div className="mb-8 flex flex-wrap gap-2">
            <StatusPill
              ok={status.health === "ok"}
              loading={status.health === "loading"}
              label={
                status.health === "loading"
                  ? "Checking API…"
                  : status.health === "ok"
                    ? "API online"
                    : "API offline"
              }
            />
            <StatusPill
              ok={status.ready === "ok"}
              loading={status.ready === "loading"}
              label={
                status.ready === "loading"
                  ? "Checking data stores…"
                  : status.ready === "ok"
                    ? "Mongo + Redis ready"
                    : "Data stores down"
              }
            />
            {status.mealCount !== null ? (
              <StatusPill ok label={`${status.mealCount.toLocaleString()} meals published`} />
            ) : null}
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={adminPath("/login")}
              className="wl-card-hover inline-flex h-9 items-center rounded-[10px] bg-[var(--text-primary)] px-4 text-[14px] leading-5 text-[var(--page-bg)]"
            >
              Open admin
            </Link>
            <Link
              href="/endpoints"
              className="wl-card-hover inline-flex h-9 items-center rounded-[10px] border border-[var(--border)] bg-[var(--card-bg)] px-4 text-[14px] leading-5"
            >
              Browse API
            </Link>
            <a
              href={`${API_URL}/docs/public`}
              target="_blank"
              rel="noreferrer"
              className="wl-card-hover inline-flex h-9 items-center rounded-[10px] border border-[var(--border)] px-4 text-[14px] leading-5"
            >
              Swagger / Try API
            </a>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon="meal"
            title="Meal catalog"
            desc="Categories, nutrition, ingredients, and instructions — localized when you add copy."
            href="/endpoints"
          />
          <FeatureCard
            icon="exercise"
            title="Workouts"
            desc="Levels, categories, and exercises with how-to steps for the public API."
            href="/endpoints"
          />
          <FeatureCard
            icon="upload"
            title="Production import"
            desc="CSV or raw JSON. English-only is enough; add Hindi or other locales later."
            href={adminPath("/data/raw-upload")}
          />
        </section>
        </div>
      </main>
    </PublicShell>
  );
}

function StatusPill({ ok, loading, label }: { ok?: boolean; loading?: boolean; label: string }) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-[12px] leading-[18px] ${
        loading
          ? "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-muted)]"
          : ok
            ? "border-transparent bg-[var(--bright-green)] text-[var(--static-black)]"
            : "border-transparent bg-[rgb(255_71_71/0.15)] text-[var(--bright-red)]"
      }`}
    >
      {label}
    </span>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
  href,
}: {
  icon: "meal" | "exercise" | "upload";
  title: string;
  desc: string;
  href: string;
}) {
  const className =
    "wl-enter wl-card-hover block rounded-[16px] border border-[var(--border)] bg-[var(--card-bg)] p-4";

  const body = (
    <>
      <span className="mb-3 flex size-9 items-center justify-center rounded-full bg-[var(--pastel-purple)] text-[var(--static-black)]">
        <Icon name={icon} size={18} />
      </span>
      <span className="block text-[14px] font-semibold leading-5">{title}</span>
      <span className="mt-1.5 block text-[13px] leading-5 text-[var(--text-muted)]">{desc}</span>
    </>
  );

  return (
    <Link href={href} className={className}>
      {body}
    </Link>
  );
}
