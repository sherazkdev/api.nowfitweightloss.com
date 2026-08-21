"use client";

import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/icon";

export function UploadProgress({
  progress,
  label,
  detail,
  tone = "busy",
  className,
}: {
  progress: number;
  label: string;
  detail?: string;
  tone?: "busy" | "done" | "error";
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, progress));
  const bar =
    tone === "done"
      ? "bg-[var(--status-active)]"
      : tone === "error"
        ? "bg-[var(--bright-red)]"
        : "wl-progress-fill bg-[var(--bright-blue)]";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[16px] border px-4 py-4 md:px-5",
        tone === "done"
          ? "border-[rgb(34_197_94/0.28)] bg-[rgb(34_197_94/0.08)]"
          : tone === "error"
            ? "border-[rgb(255_71_71/0.28)] bg-[rgb(255_71_71/0.08)]"
            : "border-[var(--border)] bg-[var(--card-bg)]",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full",
            tone === "done"
              ? "bg-[var(--status-active)] text-white"
              : tone === "error"
                ? "bg-[var(--bright-red)] text-white"
                : "bg-[var(--pastel-blue)] text-[var(--static-black)]",
          )}
        >
          {tone === "busy" ? (
            <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <Icon name={tone === "done" ? "check" : "warning"} size={16} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[14px] font-medium leading-5">{label}</p>
            <span className="tabular-nums text-[13px] text-[var(--text-muted)]">{clamped}%</span>
          </div>
          {detail ? <p className="mt-0.5 text-[12px] leading-[18px] text-[var(--text-muted)]">{detail}</p> : null}
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--black-05)]">
            <div
              className={cn("h-full rounded-full transition-[width] duration-500 ease-out", bar)}
              style={{ width: `${clamped}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
