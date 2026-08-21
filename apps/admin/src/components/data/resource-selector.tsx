"use client";

import { FormField, Select } from "@/components/ui/fields";
import { DATA_RESOURCES, type DataResourceId } from "@/lib/data-resources";

export function ResourceSelector({
  value,
  onChange,
  hideLabel = false,
}: {
  value: DataResourceId;
  onChange: (next: DataResourceId) => void;
  hideLabel?: boolean;
}) {
  const select = (
    <Select value={value} onChange={(event) => onChange(event.target.value as DataResourceId)}>
      {DATA_RESOURCES.map((resource) => (
        <option key={resource.id} value={resource.id}>
          {resource.label}
        </option>
      ))}
    </Select>
  );

  if (hideLabel) return select;

  return (
    <FormField label="Content type" required>
      {select}
    </FormField>
  );
}
