import type { ValidationState } from "@/lib/data-preview-types";

const map: Record<ValidationState, { label: string; color: string }> = {
  valid: { label: "Valid", color: "var(--status-active)" },
  warning: { label: "Warning", color: "var(--bright-orange)" },
  invalid: { label: "Invalid", color: "var(--bright-red)" },
};

export function ValidationBadge({ status }: { status: ValidationState }) {
  const item = map[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] leading-[18px]">
      <span className="size-1.5 rounded-full" style={{ background: item.color }} />
      {item.label}
    </span>
  );
}
