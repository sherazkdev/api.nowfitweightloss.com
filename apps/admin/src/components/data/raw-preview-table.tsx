import type { RawPreview } from "@/lib/data-preview-types";
import { ValidationBadge } from "@/components/data/validation-badge";
import { EmptyState } from "@/components/ui/feedback";

export function RawPreviewTable({ preview }: { preview: RawPreview | null }) {
  if (!preview) {
    return (
      <EmptyState
        title="No preview yet"
        description="Paste JSON or drag & drop a .json file to preview records."
      />
    );
  }

  return (
    <div className="max-h-[320px] overflow-auto rounded-[12px] border border-[var(--border)] scrollbar-thin">
      <table className="w-full min-w-[480px] table-fixed border-separate border-spacing-0 [&_td]:align-middle [&_th]:align-middle">
        <thead className="sticky top-0 bg-[var(--card-bg)]">
          <tr className="typo-table-head">
            {preview.columns.map((column) => (
              <th key={column} className="px-3 py-2 text-left font-normal">
                {column}
              </th>
            ))}
            <th className="px-3 py-2 text-left font-normal">Validation</th>
          </tr>
        </thead>
        <tbody>
          {preview.rows.map((row, index) => (
            <tr key={index} className="typo-table-body hover:bg-[var(--table-row-hover)]">
              {row.values.map((value, cell) => (
                <td key={`${index}-${cell}`} className="h-10 border-t border-[var(--border)] px-3">
                  {value || <span className="text-[var(--text-muted)]">—</span>}
                </td>
              ))}
              <td className="h-10 border-t border-[var(--border)] px-3">
                <ValidationBadge status={row.validation} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
