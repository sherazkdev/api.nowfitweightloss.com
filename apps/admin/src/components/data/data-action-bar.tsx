"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { PrimaryLink, SecondaryButton } from "@/components/ui/buttons";
import { dataActionHrefs, type DataResourceId } from "@/lib/data-resources";
import { cn } from "@/lib/cn";

function ActionLink({
  href,
  children,
  icon,
}: {
  href: string;
  children: ReactNode;
  icon: "fileCsv" | "download" | "upload";
}) {
  return (
    <Link
      href={href}
      className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-[8px] border border-[var(--border)] bg-[var(--card-bg)] px-2.5 text-[13px] leading-5 text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] hover:text-ink"
    >
      <Icon name={icon} size={14} />
      {children}
    </Link>
  );
}

export function DataActionBar({
  resource,
  variant = "buttons",
  addHref,
  addLabel,
  onRefresh,
  refreshing,
}: {
  resource: DataResourceId;
  variant?: "buttons" | "links" | "toolbar";
  addHref?: string;
  addLabel?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const hrefs = dataActionHrefs(resource);

  if (variant === "links") {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link href={hrefs.import} className="text-[12px] leading-[18px] text-[var(--text-muted)] hover:text-ink">
          Import CSV
        </Link>
        <Link href={hrefs.export} className="text-[12px] leading-[18px] text-[var(--text-muted)] hover:text-ink">
          Export CSV
        </Link>
        <Link href={hrefs.raw} className="text-[12px] leading-[18px] text-[var(--text-muted)] hover:text-ink">
          Raw Upload
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <ActionLink href={hrefs.import} icon="fileCsv">
        Import CSV
      </ActionLink>
      <ActionLink href={hrefs.export} icon="download">
        Export
      </ActionLink>
      <ActionLink href={hrefs.raw} icon="upload">
        Raw Upload
      </ActionLink>
      {onRefresh ? (
        <SecondaryButton type="button" disabled={refreshing} onClick={onRefresh}>
          <Icon name="history" size={14} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </SecondaryButton>
      ) : null}
      {addHref && addLabel ? (
        <PrimaryLink href={addHref} className={cn("whitespace-nowrap px-2.5", variant === "toolbar" ? "ml-0.5" : "ml-1")}>
          <Icon name="plus" size={14} />
          {addLabel}
        </PrimaryLink>
      ) : null}
    </div>
  );
}

export function DataUtilityPage({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[980px] flex-col gap-3">
      <div className="flex shrink-0 flex-col gap-3 rounded-[16px] border border-[var(--border)] bg-[var(--card-bg)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:px-5">
        <div className="min-w-0">
          <h1 className="text-[18px] font-semibold leading-7 tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-0.5 text-[13px] leading-5 text-[var(--text-muted)]">{subtitle}</p> : null}
        </div>
        {actions ? (
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">{actions}</div>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-4 scrollbar-thin">{children}</div>
    </div>
  );
}

export function DataCard({
  title,
  description,
  children,
  className,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-[16px] border border-[var(--border)] bg-[var(--card-bg)]", className)}>
      {(title || description) && (
        <div className="border-b border-[var(--border)] px-4 py-3 md:px-5">
          {title ? <h2 className="text-[14px] font-semibold leading-5">{title}</h2> : null}
          {description ? <p className="mt-1 typo-helper">{description}</p> : null}
        </div>
      )}
      <div className="flex flex-col gap-4 px-4 py-4 md:px-5">{children}</div>
    </div>
  );
}
