export function ImportSummary({
  title = "Summary",
  items,
}: {
  title?: string;
  items: { label: string; value: string }[];
}) {
  return (
    <div className="overflow-hidden rounded-[8px] bg-[var(--card-bg)]">
      <div className="px-4 py-4 md:px-6 md:py-5">
        <h2 className="typo-section-title mb-4">{title}</h2>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-[140px_1fr]">
          {items.map((item) => (
            <div key={item.label} className="contents">
              <dt className="text-[12px] leading-[18px] text-[var(--text-muted)]">{item.label}</dt>
              <dd className="text-[14px] leading-5">{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
