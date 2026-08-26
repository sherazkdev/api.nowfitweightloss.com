"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/icon";
import { SecondaryButton } from "@/components/ui/buttons";
import { TextInput } from "@/components/ui/fields";
import { LottiePreview } from "@/components/ui/lottie-preview";

export type MediaUploadVariant = "video" | "lottie";

const VARIANT_CONFIG: Record<
  MediaUploadVariant,
  {
    accept: string;
    maxMb: number;
    emptyTitle: string;
    emptyHint: string;
    uploadingLabel: string;
    readyLabel: string;
    urlPlaceholder: string;
    invalidTypeMessage: string;
    validate: (file: File) => boolean;
  }
> = {
  video: {
    accept: "video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov",
    maxMb: 100,
    emptyTitle: "Drop video here or click to browse",
    emptyHint: "MP4, WebM, MOV · max 100MB",
    uploadingLabel: "Uploading video…",
    readyLabel: "Video ready",
    urlPlaceholder: "https://cdn.example.com/exercises/squat.mp4",
    invalidTypeMessage: "Please choose a video file (MP4, WebM, or MOV).",
    validate: (file) =>
      file.type.startsWith("video/") ||
      /\.(mp4|webm|mov)$/i.test(file.name),
  },
  lottie: {
    accept: "application/json,.json",
    maxMb: 10,
    emptyTitle: "Drop Lottie JSON here or click to browse",
    emptyHint: "Lottie .json · max 10MB",
    uploadingLabel: "Uploading Lottie…",
    readyLabel: "Lottie ready",
    urlPlaceholder: "https://cdn.example.com/exercises/squat.json",
    invalidTypeMessage: "Please choose a Lottie JSON file (.json).",
    validate: (file) =>
      file.type === "application/json" ||
      file.type === "text/json" ||
      file.name.toLowerCase().endsWith(".json"),
  },
};

function fileLabel(url: string): string {
  try {
    const path = new URL(url).pathname;
    return path.split("/").pop() || url;
  } catch {
    return url.length > 48 ? `${url.slice(0, 45)}…` : url;
  }
}

function UploadMark({ variant }: { variant: MediaUploadVariant }) {
  if (variant === "video") {
    return (
      <svg viewBox="0 0 48 48" className="size-12 text-ink" aria-hidden>
        <rect x="8" y="12" width="32" height="24" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M22 20l10 6-10 6V20z" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 48 48" className="size-12 text-ink" aria-hidden>
      <path
        d="M14 10h20a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4V14a4 4 0 0 1 4-4z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M18 18h12M18 24h8M18 30h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function MediaFileUpload({
  variant,
  value,
  onUrlChange,
  onFileSelect,
  uploading = false,
  error,
}: {
  variant: MediaUploadVariant;
  value: string | null;
  onUrlChange: (url: string | null) => void;
  onFileSelect: (file: File) => void;
  uploading?: boolean;
  error?: string;
}) {
  const config = VARIANT_CONFIG[variant];
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState("");
  const [lottieData, setLottieData] = useState<unknown>(null);

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    setLocalError("");
    if (!config.validate(file)) {
      setLocalError(config.invalidTypeMessage);
      return;
    }
    if (file.size > config.maxMb * 1024 * 1024) {
      setLocalError(`File must be ${config.maxMb}MB or smaller.`);
      return;
    }
    if (variant === "lottie") {
      void file.text().then((text) => {
        try {
          setLottieData(JSON.parse(text));
        } catch {
          setLottieData(null);
          setLocalError("This JSON file is not valid Lottie animation data.");
        }
      });
    }
    onFileSelect(file);
  };

  const handleUrlChange = (url: string | null) => {
    setLottieData(null);
    onUrlChange(url);
  };

  const displayError = error || localError;
  const isVideoPreview = variant === "video" && value && !value.startsWith("data:");
  const isLottiePreview = variant === "lottie" && (lottieData != null || Boolean(value));

  return (
    <div className="flex w-full flex-col gap-4">
      <input
        ref={inputRef}
        type="file"
        accept={config.accept}
        className="hidden"
        onChange={(event) => {
          pickFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      <div
        className={cn(
          "relative w-full overflow-hidden rounded-[16px] border-2 border-dashed transition-colors duration-200",
          dragOver
            ? "border-[var(--border-strong)] bg-[var(--nav-hover-bg)]"
            : value
              ? "border-[var(--border)] bg-[var(--page-bg)]"
              : "border-[var(--border-strong)] bg-[var(--page-bg)]",
        )}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          pickFile(event.dataTransfer.files?.[0]);
        }}
      >
        {uploading ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[var(--card-bg)]/90">
            <span className="size-8 animate-pulse rounded-full bg-[var(--pastel-purple)]" />
            <p className="text-[13px] font-medium">{config.uploadingLabel}</p>
          </div>
        ) : null}

        {value || lottieData ? (
          <div className="grid w-full gap-4 p-4 sm:grid-cols-[220px_minmax(0,1fr)] sm:items-center">
            <div className="relative mx-auto aspect-square w-full max-w-[240px] overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--card-bg)] sm:mx-0 sm:max-w-none">
              {isVideoPreview ? (
                <video src={value!} className="size-full object-cover" controls muted playsInline />
              ) : isLottiePreview ? (
                <LottiePreview
                  src={lottieData == null ? value : null}
                  animationData={lottieData}
                  className="bg-[var(--card-bg)]"
                />
              ) : (
                <div className="flex size-full flex-col items-center justify-center gap-2 px-3 text-center">
                  <Icon name={variant === "video" ? "video" : "file"} size={24} />
                  <p className="text-[11px] leading-4 text-[var(--text-muted)]">
                    {variant === "lottie" ? "Lottie JSON" : "Media file"}
                  </p>
                </div>
              )}
            </div>
            <div className="min-w-0 text-center sm:text-left">
              <p className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--status-active)]">
                <Icon name="check" size={14} />
                {config.readyLabel}
              </p>
              <p className="mt-1 truncate text-[12px] text-[var(--text-muted)]" title={value ?? ""}>
                {value ? fileLabel(value) : "Previewing selected file"}
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                <SecondaryButton type="button" disabled={uploading} onClick={() => inputRef.current?.click()}>
                  <Icon name="upload" size={14} />
                  Replace
                </SecondaryButton>
                <SecondaryButton
                  type="button"
                  disabled={uploading}
                  className="text-[var(--bright-red)]"
                  onClick={() => handleUrlChange(null)}
                >
                  <Icon name="trash" size={14} />
                  Remove
                </SecondaryButton>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="flex min-h-[180px] w-full flex-col items-center justify-center gap-3 px-4 py-8 text-center transition-colors duration-200 hover:bg-[var(--surface-hover)] disabled:opacity-50 md:min-h-[220px] md:py-12"
          >
            <span className="flex size-16 items-center justify-center rounded-[16px] bg-[var(--card-bg)]">
              <UploadMark variant={variant} />
            </span>
            <div>
              <p className="text-[14px] font-medium leading-5">{config.emptyTitle}</p>
              <p className="mt-1 text-[12px] leading-[18px] text-[var(--text-muted)]">{config.emptyHint}</p>
            </div>
          </button>
        )}
      </div>

      <div>
        <p className="mb-1.5 text-[12px] font-medium leading-[18px] text-[var(--text-muted)]">
          Or paste hosted URL
        </p>
        <TextInput
          value={value ?? ""}
          placeholder={config.urlPlaceholder}
          onChange={(event) => handleUrlChange(event.target.value.trim() || null)}
        />
      </div>

      {displayError ? (
        <p className="flex items-center gap-1.5 text-[12px] leading-[18px] text-[var(--bright-red)]">
          <Icon name="warning" size={14} />
          {displayError}
        </p>
      ) : null}
    </div>
  );
}
