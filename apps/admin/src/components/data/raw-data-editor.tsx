"use client";

import { cn } from "@/lib/cn";

export function RawDataEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Paste raw data here..."
      spellCheck={false}
      className={cn(
        "min-h-[220px] w-full resize-y rounded-[8px] border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2.5 text-[13px] leading-5 text-ink outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--border-strong)]",
        "font-mono",
      )}
    />
  );
}
