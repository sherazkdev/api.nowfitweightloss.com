"use client";

import { useRef, useState, type DragEvent } from "react";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/buttons";
import { cn } from "@/lib/cn";

export type SelectedFile = {
  name: string;
  sizeLabel: string;
  file: File;
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CsvDropzone({
  file,
  onSelect,
  onRemove,
}: {
  file: SelectedFile | null;
  onSelect: (file: SelectedFile) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const takeFile = (next: File | undefined) => {
    if (!next) return;
    onSelect({ name: next.name, sizeLabel: formatSize(next.size), file: next });
  };

  const onDragOver = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setDragging(true);
  };

  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-[8px] border border-[var(--border)] bg-[var(--page-bg)] px-3 py-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-[var(--pastel-blue)] text-[var(--static-black)]">
          <Icon name="fileCsv" size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] leading-5">{file.name}</p>
          <p className="typo-helper">{file.sizeLabel}</p>
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
        className="hidden"
        onChange={(event) => {
          takeFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={onDragOver}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          takeFile(event.dataTransfer.files?.[0]);
        }}
        className={cn(
          "flex w-full items-center gap-3 rounded-[8px] border border-dashed bg-[var(--black-05)] px-3 py-4 text-left transition-colors hover:bg-[var(--surface-hover)]",
          dragging ? "border-[var(--border-strong)] bg-[var(--nav-hover-bg)]" : "border-[var(--border-strong)]",
        )}
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-[var(--pastel-blue)] text-[var(--static-black)]">
          <Icon name="upload" size={16} />
        </div>
        <div className="min-w-0">
          <p className="text-[14px] leading-5">Drop a CSV file here, or browse</p>
          <p className="typo-helper">Drag & drop or choose a file to preview rows.</p>
        </div>
      </button>
    </div>
  );
}
