"use client";

import { useRef, useState, type DragEvent } from "react";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/buttons";
import { cn } from "@/lib/cn";

export type RawUploadFile = {
  name: string;
  sizeLabel: string;
  content: string;
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isJsonFile(file: File) {
  const lower = file.name.toLowerCase();
  return lower.endsWith(".json") || file.type === "application/json" || file.type === "text/json";
}

export function RawUploadDropzone({
  file,
  onSelect,
  onRemove,
  onError,
}: {
  file: RawUploadFile | null;
  onSelect: (file: RawUploadFile) => void;
  onRemove: () => void;
  onError: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);

  const readFile = (next: File | undefined) => {
    if (!next) return;

    if (!isJsonFile(next)) {
      onError("Only .json files are supported for raw upload.");
      return;
    }

    setReading(true);
    onError("");

    const reader = new FileReader();
    reader.onload = () => {
      setReading(false);
      const content = typeof reader.result === "string" ? reader.result : "";
      if (!content.trim()) {
        onError("Selected file is empty.");
        return;
      }
      onSelect({
        name: next.name,
        sizeLabel: formatSize(next.size),
        content,
      });
    };
    reader.onerror = () => {
      setReading(false);
      onError("Could not read the selected file.");
    };
    reader.readAsText(next);
  };

  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-[8px] border border-[var(--border)] bg-[var(--page-bg)] px-3 py-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-[var(--pastel-purple)] text-[var(--static-black)]">
          <Icon name="file" size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] leading-5">{file.name}</p>
          <p className="typo-helper">{file.sizeLabel} · JSON loaded</p>
        </div>
        <IconButton aria-label="Remove file" onClick={onRemove}>
          <Icon name="x" size={14} />
        </IconButton>
      </div>
    );
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json,text/json"
        className="hidden"
        onChange={(event) => {
          readFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <div
        role="button"
        tabIndex={0}
        onClick={() => !reading && inputRef.current?.click()}
        onKeyDown={(event) => {
          if (reading) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(event: DragEvent<HTMLDivElement>) => {
          event.preventDefault();
          event.stopPropagation();
          setDragging(true);
        }}
        onDragOver={(event: DragEvent<HTMLDivElement>) => {
          event.preventDefault();
          event.stopPropagation();
          setDragging(true);
        }}
        onDragLeave={(event: DragEvent<HTMLDivElement>) => {
          event.preventDefault();
          event.stopPropagation();
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
          setDragging(false);
        }}
        onDrop={(event: DragEvent<HTMLDivElement>) => {
          event.preventDefault();
          event.stopPropagation();
          setDragging(false);
          if (reading) return;
          readFile(event.dataTransfer.files?.[0]);
        }}
        className={cn(
          "flex w-full cursor-pointer items-center gap-3 rounded-[8px] border border-dashed px-3 py-6 text-left transition-all duration-150",
          reading
            ? "border-[var(--border-strong)] bg-[var(--nav-hover-bg)]"
            : dragging
              ? "scale-[1.01] border-[var(--bright-blue)] bg-[var(--pastel-blue)] shadow-sm"
              : "border-[var(--border-strong)] bg-[var(--black-05)] hover:bg-[var(--surface-hover)]",
        )}
      >
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-[8px] text-[var(--static-black)] transition-transform duration-150",
            dragging ? "scale-110 bg-[var(--bright-blue)]" : "bg-[var(--pastel-purple)]",
          )}
        >
          {reading ? (
            <span className="size-4 animate-spin rounded-full border-2 border-[var(--static-black)] border-t-transparent" />
          ) : (
            <Icon name="upload" size={18} />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-[14px] leading-5">
            {reading ? "Reading file…" : dragging ? "Drop JSON file here" : "Drag & drop JSON here"}
          </p>
          <p className="typo-helper">
            {reading ? "Please wait" : "or click to browse · .json only"}
          </p>
        </div>
      </div>
    </div>
  );
}
