"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { PrimaryButton } from "@/components/ui/buttons";
import { FormSection } from "@/components/ui/feedback";
import { DataUtilityPage } from "@/components/data/data-action-bar";
import { ResourceSelector } from "@/components/data/resource-selector";
import {
  ExportColumnSelector,
  ExportOptions,
  exportFiltersToApi,
  type ExportFilterOptions,
  type ExportFilters,
} from "@/components/data/export-options";
import { ImportSummary } from "@/components/data/import-summary";
import { UploadProgress } from "@/components/data/upload-progress";
import { useDataResourceParam } from "@/components/data/use-data-resource";
import { EXPORT_COLUMNS, getDataResource, type DataResourceId } from "@/lib/data-resources";
import { fetchExportPreview, jobDownloadUrl, queueExportCsv, settleJob } from "@/lib/jobs-api";
import { ApiError } from "@/lib/api-client";
import { getAccessToken } from "@/lib/auth-session";
import { fetchMealCategoriesAdmin } from "@/lib/meal-categories-api";
import { fetchWorkoutCategoriesAdmin } from "@/lib/workout-categories-api";
import { fetchWorkoutLevelsAdmin } from "@/lib/workout-levels-api";

const emptyFilters: ExportFilters = {
  scope: "all",
  gender: "all",
  category: "all",
  workoutLevel: "all",
  workoutCategory: "all",
};

function ExportCsvView() {
  const [resource, setResource] = useDataResourceParam();
  const [filters, setFilters] = useState<ExportFilters>(emptyFilters);
  const [selected, setSelected] = useState<string[]>(EXPORT_COLUMNS[resource].map((column) => column.key));
  const [filterOptions, setFilterOptions] = useState<ExportFilterOptions>({
    mealCategories: [],
    workoutLevels: [],
    workoutCategories: [],
  });
  const [recordCount, setRecordCount] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadJobId, setDownloadJobId] = useState<number | null>(null);

  const def = getDataResource(resource);
  const columns = EXPORT_COLUMNS[resource];
  const selectedColumns = columns.filter((column) => selected.includes(column.key));

  useEffect(() => {
    void (async () => {
      try {
        const [mealCategories, workoutLevels, workoutCategories] = await Promise.all([
          fetchMealCategoriesAdmin(),
          fetchWorkoutLevelsAdmin(),
          fetchWorkoutCategoriesAdmin(),
        ]);
        setFilterOptions({
          mealCategories: mealCategories.map((item) => ({ id: item.id, name: item.name })),
          workoutLevels: workoutLevels.map((item) => ({ id: item.id, name: item.name })),
          workoutCategories: workoutCategories.map((item) => ({ id: item.id, name: item.name })),
        });
      } catch {
        setFilterOptions({ mealCategories: [], workoutLevels: [], workoutCategories: [] });
      }
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const preview = await fetchExportPreview({
          resource,
          filters: exportFiltersToApi(filters),
        });
        setRecordCount(preview.total);
      } catch {
        setRecordCount(null);
      }
    })();
  }, [resource, filters]);

  const changeResource = (next: DataResourceId) => {
    setResource(next);
    setFilters(emptyFilters);
    setSelected(EXPORT_COLUMNS[next].map((column) => column.key));
    setNote("");
    setError("");
    setDownloadJobId(null);
  };

  const items = useMemo(
    () => [
      { label: "Resource", value: def.label },
      { label: "Records", value: recordCount == null ? "—" : String(recordCount) },
      { label: "Format", value: "CSV" },
      { label: "Selected Fields", value: String(selected.length) },
      { label: "Scope", value: filters.scope },
    ],
    [def.label, filters.scope, recordCount, selected.length],
  );

  async function handleExport() {
    if (selectedColumns.length === 0) {
      setError("Select at least one export column.");
      return;
    }

    setBusy(true);
    setError("");
    setNote("");
    setProgress(10);
    setDownloadJobId(null);

    try {
      setProgress(30);
      setNote("Building your CSV file…");
      const queued = await queueExportCsv({
        resource,
        columns: selectedColumns.map((column) => ({ key: column.key, label: column.label })),
        filters: exportFiltersToApi(filters),
      });
      const done = await settleJob(queued, (job) => {
        setProgress(Math.max(45, job.progress || 80));
      });

      if (done.status === "failed") {
        throw new Error(done.errorSummary ?? "Export failed");
      }

      setProgress(100);
      setDownloadJobId(done.id);
      setNote(`Export ready — ${done.successful} record(s). Download below.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Export failed");
      setProgress(0);
    } finally {
      setBusy(false);
    }
  }

  async function handleDownload() {
    if (!downloadJobId || !getAccessToken()) return;
    const response = await fetch(jobDownloadUrl(downloadJobId), {
      credentials: "include",
      headers: { Authorization: `Bearer ${getAccessToken()}` },
    });
    if (!response.ok) {
      setError("Download failed");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `export-${resource}-${downloadJobId}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <DataUtilityPage
      title="Export CSV"
      subtitle={`Download ${def.label.toLowerCase()} as a spreadsheet.`}
      actions={
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          {downloadJobId ? (
            <PrimaryButton type="button" className="w-full sm:w-auto" onClick={() => void handleDownload()}>
              Download CSV
            </PrimaryButton>
          ) : null}
          <PrimaryButton
            type="button"
            className="w-full sm:w-auto"
            disabled={selected.length === 0 || busy || recordCount === 0}
            loading={busy}
            loadingLabel="Exporting…"
            onClick={() => void handleExport()}
          >
            Export CSV
          </PrimaryButton>
        </div>
      }
    >
      <div className="overflow-hidden rounded-[8px] bg-[var(--card-bg)]">
        <FormSection title="Resource">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ResourceSelector hideLabel value={resource} onChange={changeResource} />
          </div>
        </FormSection>
        <FormSection title="Export options">
          <ExportOptions
            resource={def}
            filters={filters}
            options={filterOptions}
            onChange={setFilters}
          />
        </FormSection>
        <FormSection title="Export columns">
          <ExportColumnSelector columns={columns} selected={selected} onChange={setSelected} />
        </FormSection>
      </div>

      {busy ? (
        <UploadProgress progress={progress} label="Generating export" detail={note || "Building CSV…"} />
      ) : null}

      <ImportSummary title="Export Summary" items={items} />
      {error ? <p className="text-[12px] leading-[18px] text-[var(--bright-red)]">{error}</p> : null}
      {note ? <p className="text-[12px] leading-[18px] text-[var(--status-active)]">{note}</p> : null}
    </DataUtilityPage>
  );
}

export default function ExportCsvPage() {
  return (
    <Suspense fallback={<h1 className="text-[14px] font-semibold leading-5">Export CSV</h1>}>
      <ExportCsvView />
    </Suspense>
  );
}
