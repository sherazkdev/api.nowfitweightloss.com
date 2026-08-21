"use client";

import { useRef } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/icon";

export const MEAL_CATEGORY_ICONS = [
  { label: "Fork and knife", path: "/assets/commerce/ForkKnife.svg" },
  { label: "Cooking pot", path: "/assets/commerce/CookingPot.svg" },
  { label: "Bowl", path: "/assets/commerce/BowlFood.svg" },
  { label: "Coffee", path: "/assets/commerce/Coffee.svg" },
  { label: "Pizza", path: "/assets/commerce/Pizza.svg" },
  { label: "Hamburger", path: "/assets/commerce/Hamburger.svg" },
  { label: "Egg", path: "/assets/commerce/Egg.svg" },
  { label: "Fish", path: "/assets/weather-&-nature/Fish.svg" },
  { label: "Carrot", path: "/assets/commerce/Carrot.svg" },
  { label: "Orange", path: "/assets/commerce/OrangeSlice.svg" },
  { label: "Grains", path: "/assets/commerce/Grains.svg" },
  { label: "Cookie", path: "/assets/commerce/Cookie.svg" },
  { label: "Ice cream", path: "/assets/commerce/IceCream.svg" },
  { label: "Pepper", path: "/assets/commerce/Pepper.svg" },
  { label: "Popcorn", path: "/assets/commerce/Popcorn.svg" },
  { label: "Drink", path: "/assets/commerce/Wine.svg" },
] as const;

const PRESET_PATHS = new Set<string>(MEAL_CATEGORY_ICONS.map((item) => item.path));

export function isPresetCategoryIcon(value: string | null) {
  return Boolean(value && PRESET_PATHS.has(value));
}

export function IconPicker({
  value,
  onChange,
  onUpload,
  uploading = false,
}: {
  value: string | null;
  onChange: (path: string | null) => void;
  onUpload?: (file: File) => void;
  uploading?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const customSelected = Boolean(value && !isPresetCategoryIcon(value));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={cn(
            "flex h-10 min-w-10 items-center rounded-[8px] border px-3 text-[12px] leading-[18px] transition-colors",
            !value
              ? "border-[var(--text-primary)] bg-[var(--black-05)]"
              : "border-[var(--border)] hover:bg-[var(--surface-hover)]",
          )}
        >
          None
        </button>
        {MEAL_CATEGORY_ICONS.map((item) => {
          const selected = value === item.path;
          return (
            <button
              key={item.path}
              type="button"
              title={item.label}
              aria-label={item.label}
              aria-pressed={selected}
              onClick={() => onChange(item.path)}
              className={cn(
                "flex size-10 items-center justify-center rounded-[8px] border transition-colors",
                selected
                  ? "border-[var(--text-primary)] bg-[var(--black-05)]"
                  : "border-[var(--border)] hover:bg-[var(--surface-hover)]",
              )}
            >
              <span
                className="inline-block size-4 bg-current"
                style={{
                  WebkitMask: `url("${encodeURI(item.path)}") center / contain no-repeat`,
                  mask: `url("${encodeURI(item.path)}") center / contain no-repeat`,
                }}
              />
            </button>
          );
        })}
        {onUpload ? (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onUpload(file);
                event.target.value = "";
              }}
            />
            <button
              type="button"
              title="Upload custom icon"
              aria-label="Upload custom icon"
              aria-pressed={customSelected}
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className={cn(
                "flex size-10 items-center justify-center rounded-[8px] border transition-colors disabled:opacity-40",
                customSelected
                  ? "border-[var(--text-primary)] bg-[var(--black-05)]"
                  : "border-dashed border-[var(--border-strong)] hover:bg-[var(--surface-hover)]",
              )}
            >
              {customSelected && value ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={value} alt="" className="size-5 object-contain" />
              ) : (
                <Icon name="upload" size={14} />
              )}
            </button>
          </>
        ) : null}
      </div>
      <p className="text-[12px] leading-[18px] text-[var(--text-muted)]">
        Choose a preset, or upload a custom icon if none of these fit. PNG, JPG, WebP, or GIF.
      </p>
    </div>
  );
}
