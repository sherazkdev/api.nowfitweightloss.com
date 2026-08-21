"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Checkbox, FormField } from "@/components/ui/fields";
import { FormSection } from "@/components/ui/feedback";
import { PrimaryButton, SecondaryButton } from "@/components/ui/buttons";
import { DataCard, DataUtilityPage } from "@/components/data/data-action-bar";
import { ResourceSelector } from "@/components/data/resource-selector";
import { CsvDropzone, type SelectedFile } from "@/components/data/csv-dropzone";
import { CsvPreviewTable } from "@/components/data/csv-preview-table";
import { ImportSummary } from "@/components/data/import-summary";
import { UploadProgress } from "@/components/data/upload-progress";
import { useDataResourceParam } from "@/components/data/use-data-resource";
import { getDataResource, sampleCsvHref } from "@/lib/data-resources";
import { parseCsvPreview } from "@/lib/csv-preview";
import { queueImportCsv, settleJob } from "@/lib/jobs-api";
import { ApiError } from "@/lib/api-client";

function ImportCsvView() {
  const router = useRouter();
  const [resource, setResource] = useDataResourceParam();
  const [file, setFile] = useState<SelectedFile | null>(null);
  const [fileText, setFileText] = useState("");
  const [headers, setHeaders] = useState(true);
  const [skipInvalid, setSkipInvalid] = useState(true);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const def = getDataResource(resource);

  const preview = useMemo(() => {
    if (!fileText) return null;
    const parsed = parseCsvPreview(fileText, headers, resource);
    return {
      columns: parsed.columns,
      rows: parsed.rows,
      fileName: file?.name ?? "upload.csv",
      fileSize: file?.sizeLabel ?? "—",
    };
  }, [file, fileText, headers, resource]);

  const summaryItems = useMemo(() => {
    if (!preview) return [];
    const valid = preview.rows.filter((row) => row.validation === "valid").length;
    const invalid = preview.rows.filter((row) => row.validation === "invalid").length;
    return [
      { label: "Resource", value: def.label },
      { label: "File", value: preview.fileName },
      { label: "Rows", value: String(preview.rows.length) },
      { label: "Valid", value: String(valid) },
      { label: "Invalid", value: String(invalid) },
    ];
  }, [def.label, preview]);

  async function handleImport() {
    if (!file) {
      setError("Select a CSV file first.");
      return;
    }

    setBusy(true);
    setError("");
    setNote("");
    setProgress(5);

    try {
      setProgress(25);
      setNote("Saving CSV rows to the database…");
      const queued = await queueImportCsv(resource, file.file, { hasHeaders: headers, skipInvalid });
      const done = await settleJob(queued, (job) => {
        setProgress(Math.max(40, job.progress || 70));
        setNote(job.status === "completed" ? "Finishing up…" : "Writing records…");
      });

      if (done.status === "failed") {
        throw new Error(done.errorSummary ?? "Import failed");
      }

      setProgress(100);
      setNote(
        `Import complete — ${done.successful} saved (${done.failed > 0 ? `${done.failed} failed` : "no failures"}).`,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Import failed");
      setProgress(0);
    } finally {
      setBusy(false);
    }
  }

  return (
    <DataUtilityPage
      title="Import CSV"
      subtitle={`Bring ${def.label.toLowerCase()} in from a spreadsheet. English columns are enough.`}
      actions={
        <>
          <SecondaryButton
            type="button"
            className="flex-1 sm:flex-none"
            onClick={() => router.push(def.listHref)}
            disabled={busy}
          >
            Cancel
          </SecondaryButton>
          <PrimaryButton
            type="button"
            className="flex-1 sm:flex-none"
            disabled={!file || busy}
            loading={busy}
            loadingLabel="Importing…"
            onClick={() => void handleImport()}
          >
            Import CSV
          </PrimaryButton>
        </>
      }
    >
      <div className="overflow-hidden rounded-[8px] bg-[var(--card-bg)]">
        <FormSection title="Source">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ResourceSelector
              hideLabel
              value={resource}
              onChange={(next) => {
                setResource(next);
                setNote("");
                setError("");
              }}
            />
          </div>
          <FormField label="CSV File" required>
            <CsvDropzone
              file={file}
              onSelect={(next) => {
                setFile(next);
                setNote("");
                setError("");
                void next.file.text().then(setFileText);
              }}
              onRemove={() => {
                setFile(null);
                setFileText("");
                setNote("");
                setError("");
              }}
            />
          </FormField>
          <div className="flex flex-col gap-2">
            <label className="flex h-8 items-center gap-2">
              <Checkbox checked={headers} onChange={() => setHeaders((value) => !value)} />
              <span className="text-[14px] leading-5">First row contains headers</span>
            </label>
            <label className="flex h-8 items-center gap-2">
              <Checkbox checked={skipInvalid} onChange={() => setSkipInvalid((value) => !value)} />
              <span className="text-[14px] leading-5">Skip invalid rows</span>
            </label>
            <p className="text-[12px] leading-[18px] text-[var(--text-muted)]">
              English columns are enough. Optional locale columns such as{" "}
              <code className="rounded bg-[var(--surface-muted)] px-1">title_hi</code> or a{" "}
              <code className="rounded bg-[var(--surface-muted)] px-1">translations</code> JSON cell
              add more languages — you do not need all 15. Unknown locales are skipped.{" "}
              <a
                href={sampleCsvHref(resource)}
                download={`${resource}.csv`}
                className="text-[var(--bright-purple)] hover:underline"
              >
                Download sample CSV
              </a>
              {" "}
              (same IDs as raw JSON — import categories before meals,{" "}
              <code className="rounded bg-[var(--surface-muted)] px-1">1|2</code> for multiple ids).
            </p>
          </div>
        </FormSection>
      </div>

      {busy ? (
        <UploadProgress progress={progress} label="Importing CSV" detail={note || "Saving records…"} />
      ) : null}

      {preview ? (
        <DataCard title="CSV Preview">
          <CsvPreviewTable preview={preview} />
        </DataCard>
      ) : null}

      {preview ? <ImportSummary title="Import Summary" items={summaryItems} /> : null}
      {error ? <p className="text-[12px] leading-[18px] text-[var(--bright-red)]">{error}</p> : null}
      {note ? <p className="text-[12px] leading-[18px] text-[var(--status-active)]">{note}</p> : null}
    </DataUtilityPage>
  );
}

export default function ImportCsvPage() {
  return (
    <Suspense fallback={<h1 className="text-[14px] font-semibold leading-5">Import CSV</h1>}>
      <ImportCsvView />
    </Suspense>
  );
}
