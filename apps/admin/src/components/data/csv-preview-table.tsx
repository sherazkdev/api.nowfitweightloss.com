import type { CsvPreview } from "@/lib/data-preview-types";
import { ValidationBadge } from "@/components/data/validation-badge";
import { EmptyState } from "@/components/ui/feedback";

export function CsvPreviewTable({ preview }: { preview: CsvPreview | null }) {
  if (!preview) {
    return (
      <EmptyState
        title="No file selected"
        description="Choose a CSV file to see a preview of the first rows."
      />
    );
  }

  return (
    <div className="max-h-[320px] overflow-auto rounded-[12px] border border-[var(--border)] scrollbar-thin">
      <table className="w-full min-w-[520px] table-fixed border-separate border-spacing-0 [&_td]:align-middle [&_th]:align-middle">
        <thead className="sticky top-0 bg-[var(--card-bg)]">
          <tr className="typo-table-head">
            <th className="w-14 px-3 py-2 text-left font-normal">Row</th>
            {preview.columns.map((column) => (
              <th key={column} className="px-3 py-2 text-left font-normal">
                {column}
              </th>
            ))}
            <th className="px-3 py-2 text-left font-normal">Validation</th>
          </tr>
        </thead>
        <tbody>
          {preview.rows.map((row) => (
            <tr key={row.row} className="typo-table-body hover:bg-[var(--table-row-hover)]">
              <td className="h-10 border-t border-[var(--border)] px-3 text-[var(--text-muted)]">{row.row}</td>
              {row.values.map((value, index) => (
                <td key={`${row.row}-${index}`} className="h-10 border-t border-[var(--border)] px-3">
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
