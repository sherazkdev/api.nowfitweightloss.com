import type { RawImportResource } from "@weightloss/database";

export type ImportCsvJobPayload = {
  jobId: number;
  adminId: number;
  resource: RawImportResource;
  fileKey: string;
  options: {
    hasHeaders: boolean;
    skipInvalid: boolean;
  };
};

export type ExportCsvJobPayload = {
  jobId: number;
  adminId: number;
  resource: RawImportResource;
  columns: Array<{ key: string; label: string }>;
  filters: {
    scope: "all" | "active" | "inactive" | "challenge";
    gender: "all" | "male" | "female" | "both";
    categoryId: number | null;
    workoutLevelId: number | null;
    workoutCategoryId: number | null;
  };
};

export type RawImportJobPayload = {
  jobId: number;
  adminId: number;
  resource: RawImportResource;
  fileKey: string;
};

export type QueueJobPayload = ImportCsvJobPayload | ExportCsvJobPayload | RawImportJobPayload;

export const QUEUE_SUFFIX = {
  import: "import",
  export: "export",
  raw: "raw",
} as const;

export const JOB_NAMES = {
  importCsv: "import-csv",
  exportCsv: "export-csv",
  rawImport: "raw-import",
} as const;
