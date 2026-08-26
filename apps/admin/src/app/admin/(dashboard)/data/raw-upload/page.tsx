"use client";

import { Suspense, useMemo, useState } from "react";
import { PrimaryButton, SecondaryButton } from "@/components/ui/buttons";
import { Icon } from "@/components/ui/icon";
import { FormSection } from "@/components/ui/feedback";
import { DataCard, DataUtilityPage } from "@/components/data/data-action-bar";
import { ResourceSelector } from "@/components/data/resource-selector";
import { RawDataEditor } from "@/components/data/raw-data-editor";
import { RawUploadDropzone, type RawUploadFile } from "@/components/data/raw-upload-dropzone";
import { RawPreviewTable } from "@/components/data/raw-preview-table";
import { UploadProgress } from "@/components/data/upload-progress";
import { useDataResourceParam } from "@/components/data/use-data-resource";
import { parseRawUploadInput } from "@/lib/raw-upload-parser";
import { queueRawImport, settleJob } from "@/lib/jobs-api";
import { ApiError } from "@/lib/api-client";
import { getAccessToken } from "@/lib/auth-session";
import { getDataResource, sampleRawHref } from "@/lib/data-resources";
import { cn } from "@/lib/cn";

type Mode = "paste" | "file";
type UploadPhase = "idle" | "uploading" | "done" | "error";

function RawUploadView() {
  const [resource, setResource] = useDataResourceParam();
  const [mode, setMode] = useState<Mode>("file");
  const [paste, setPaste] = useState("");
  const [file, setFile] = useState<RawUploadFile | null>(null);
  const [inputError, setInputError] = useState("");
  const [validated, setValidated] = useState(false);
  const [note, setNote] = useState("");
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusDetail, setStatusDetail] = useState("");

  const def = getDataResource(resource);
  const sourceText = mode === "paste" ? paste : (file?.content ?? "");

  const parsed = useMemo(
    () => (sourceText.trim() ? parseRawUploadInput(resource, sourceText) : null),
    [resource, sourceText],
  );

  const preview = parsed?.ok ? parsed.preview : null;
  const parseError = parsed && !parsed.ok ? parsed.error : inputError;
  const hasInput = sourceText.trim().length > 0;
  const draftKey = `${resource}\0${mode}\0${sourceText}`;
  const [statusKey, setStatusKey] = useState(draftKey);
  const live =
    statusKey === draftKey
      ? { validated, note, uploadPhase, uploadProgress, statusDetail }
      : {
          validated: false,
          note: "",
          uploadPhase: "idle" as UploadPhase,
          uploadProgress: 0,
          statusDetail: "",
        };

  const clear = () => {
    setPaste("");
    setFile(null);
    setInputError("");
    setValidated(false);
    setNote("");
    setUploadPhase("idle");
    setUploadProgress(0);
    setStatusDetail("");
  };

  const runValidate = () => {
    if (!parsed?.ok) {
      setInputError(parsed?.error ?? "Add JSON data first.");
      setValidated(false);
      return;
    }
    setInputError("");
    setStatusKey(draftKey);
    setValidated(true);
    setNote(`${parsed.preview.valid} valid, ${parsed.preview.invalid} invalid — ready to import.`);
  };

  const runUpload = () => {
    if (!parsed?.ok) {
      setInputError(parsed?.error ?? "Fix JSON before uploading.");
      setStatusKey(draftKey);
      setUploadPhase("error");
      return;
    }

    if (!getAccessToken()) {
      setInputError("Please sign in first — raw upload requires admin auth.");
      setStatusKey(draftKey);
      setUploadPhase("error");
      return;
    }

    setInputError("");
    setStatusKey(draftKey);
    setValidated(true);
    setUploadPhase("uploading");
    setUploadProgress(12);
    setStatusDetail(`Preparing ${parsed.preview.valid} ${def.label.toLowerCase()} record(s)…`);
    setNote("");

    void (async () => {
      try {
        setUploadProgress(40);
        setStatusDetail("Saving records to the database…");
        const queued = await queueRawImport({ resource, payload: parsed.sourceText });
        const result = await settleJob(queued, (job) => {
          setUploadProgress(Math.max(55, job.progress || 70));
          setStatusDetail(
            job.status === "processing"
              ? "Writing records…"
              : job.status === "queued"
                ? "Almost there…"
                : `Saved ${job.successful} record(s).`,
          );
        });
        setUploadProgress(100);
        if (result.status === "failed") {
          throw new Error(result.errorSummary ?? "Import failed");
        }
        setUploadPhase("done");
        setStatusDetail("MongoDB is up to date.");
        setNote(
          `Imported ${result.successful} ${def.label.toLowerCase()} record(s)${
            result.failed > 0 ? ` · ${result.failed} failed` : ""
          }.`,
        );
      } catch (error) {
        setUploadPhase("error");
        setUploadProgress(100);
        if (error instanceof ApiError && error.code === "UNAUTHORIZED") {
          setInputError("Session expired — please sign in again at /admin/login");
        } else {
          setInputError(
            error instanceof ApiError
              ? error.message
              : error instanceof Error
                ? error.message
                : "Upload failed. Is the API running on port 5000?",
          );
        }
      }
    })();
  };

  const busy = live.uploadPhase === "uploading";

  return (
    <DataUtilityPage
      title="Raw Upload"
      subtitle={`Import JSON into ${def.label}. Records save immediately — other languages fill in shortly after.`}
      actions={
        <>
          <SecondaryButton type="button" className="flex-1 sm:flex-none" onClick={clear} disabled={busy}>
            Clear
          </SecondaryButton>
          <SecondaryButton
            type="button"
            className="flex-1 sm:flex-none"
            disabled={!hasInput || busy}
            onClick={runValidate}
          >
            Validate
          </SecondaryButton>
          <PrimaryButton
            type="button"
            className="flex-1 sm:flex-none"
            disabled={!hasInput || busy}
            loading={busy}
            loadingLabel="Importing…"
            onClick={runUpload}
          >
            <Icon name="upload" size={14} />
            Upload Data
          </PrimaryButton>
        </>
      }
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="overflow-hidden rounded-[16px] border border-[var(--border)] bg-[var(--card-bg)]">
          <FormSection title="Content type" description="Choose where these records should land.">
            <ResourceSelector
              hideLabel
              value={resource}
              onChange={(next) => {
                setResource(next);
                setValidated(false);
                setNote("");
                setUploadPhase("idle");
                setUploadProgress(0);
              }}
            />
          </FormSection>
          <FormSection title="Source" description="Drop a JSON file or paste an array of records.">
            <div className="flex h-9 w-fit items-center rounded-[8px] bg-[var(--toolbar-bg)] p-0.5">
              {(
                [
                  ["file", "Upload File"],
                  ["paste", "Paste Data"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setMode(value);
                    setInputError("");
                    setValidated(false);
                    setNote("");
                  }}
                  className={cn(
                    "h-8 rounded-[6px] px-3 text-[14px] leading-5",
                    mode === value ? "bg-[var(--page-bg)] text-ink shadow-sm" : "text-[var(--text-muted)]",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {mode === "paste" ? (
              <RawDataEditor
                value={paste}
                onChange={(next) => {
                  setPaste(next);
                  setInputError("");
                }}
              />
            ) : (
              <RawUploadDropzone
                file={file}
                onSelect={(next) => {
                  setFile(next);
                  setPaste("");
                  setInputError("");
                }}
                onRemove={() => {
                  setFile(null);
                  setInputError("");
                }}
                onError={setInputError}
              />
            )}
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] leading-[18px] text-[var(--text-muted)]">
              <button
                type="button"
                disabled={busy}
                className="text-[var(--bright-purple)] hover:underline disabled:opacity-40"
                onClick={() => {
                  void (async () => {
                    try {
                      const response = await fetch(sampleRawHref(resource));
                      if (!response.ok) throw new Error("Sample file not found");
                      const text = await response.text();
                      setMode("paste");
                      setPaste(text);
                      setFile(null);
                      setInputError("");
                    } catch (error) {
                      setInputError(
                        error instanceof Error ? error.message : "Could not load sample JSON",
                      );
                    }
                  })();
                }}
              >
                Load sample JSON
              </button>
              <a href={sampleRawHref(resource)} download={`${resource}.json`} className="hover:underline">
                Download
              </a>
              <span>IDs match the CSV samples — import categories before meals.</span>
            </p>
            {parseError ? (
              <p className="text-[12px] leading-[18px] text-[var(--bright-red)]">{parseError}</p>
            ) : (
              <p className="text-[12px] leading-[18px] text-[var(--text-muted)]">
                Use English <code className="rounded bg-[var(--surface-muted)] px-1">name</code> or{" "}
                <code className="rounded bg-[var(--surface-muted)] px-1">title</code>. Optional translations are
                merged; slug, image, and numbers stay shared.
              </p>
            )}
          </FormSection>
        </div>

        <div className="flex flex-col gap-3">
          {live.uploadPhase !== "idle" ? (
            <UploadProgress
              progress={live.uploadProgress}
              tone={live.uploadPhase === "done" ? "done" : live.uploadPhase === "error" ? "error" : "busy"}
              label={
                live.uploadPhase === "done"
                  ? "Import complete"
                  : live.uploadPhase === "error"
                    ? "Import stopped"
                    : "Importing raw data"
              }
              detail={live.uploadPhase === "error" ? inputError || "Something went wrong." : live.statusDetail}
            />
          ) : null}

          {preview ? (
            <DataCard
              title="Preview"
              description={`${preview.valid} valid · ${preview.invalid} invalid · ${preview.detected} detected`}
            >
              <div className="grid grid-cols-3 gap-2">
                {[
                  ["Detected", preview.detected],
                  ["Valid", preview.valid],
                  ["Invalid", preview.invalid],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[12px] bg-[var(--black-05)] px-3 py-2.5">
                    <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
                    <p className="text-[18px] font-semibold leading-7 tabular-nums">{value}</p>
                  </div>
                ))}
              </div>
              <RawPreviewTable preview={preview} />
            </DataCard>
          ) : (
            <DataCard title="Preview" description="Load JSON to see records before they are saved.">
              <div className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-[12px] bg-[var(--black-05)] px-4 text-center">
                <Icon name="file" size={22} className="text-[var(--text-muted)]" />
                <p className="text-[13px] text-[var(--text-muted)]">No records yet</p>
              </div>
            </DataCard>
          )}

          {live.validated && preview && live.uploadPhase === "idle" ? (
            <p className="text-[12px] leading-[18px] text-[var(--text-muted)]">{live.note}</p>
          ) : null}
          {live.uploadPhase === "done" && live.note ? (
            <p className="text-[13px] leading-5 text-[var(--status-active)]">{live.note}</p>
          ) : null}
        </div>
      </div>
    </DataUtilityPage>
  );
}

export default function RawUploadPage() {
  return (
    <Suspense fallback={<h1 className="text-[18px] font-semibold leading-7">Raw Upload</h1>}>
      <RawUploadView />
    </Suspense>
  );
}
