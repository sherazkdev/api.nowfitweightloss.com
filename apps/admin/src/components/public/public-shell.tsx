"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { IconButton, PrimaryLink } from "@/components/ui/buttons";
import { Icon } from "@/components/ui/icon";
import { useTheme } from "@/components/theme/theme-provider";
import { adminPath } from "@/lib/admin-path";
import { API_BASE_URL } from "@/lib/api-config";

export function PublicShell({
  children,
  active,
}: {
  children: ReactNode;
  active?: "home" | "endpoints";
}) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="relative h-full bg-[var(--page-bg)]">
      <div className="absolute inset-0 flex flex-col">
        <header className="flex h-[var(--header-height)] shrink-0 items-center justify-between border-b border-[var(--border)] px-5 md:px-8">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-[var(--pastel-blue)] text-[var(--static-black)]">
                <Icon name="leaf" size={16} />
              </span>
              <span className="text-[14px] font-semibold leading-5 tracking-[-0.01em]">WeightLoss Pro</span>
            </Link>
            <nav className="hidden items-center gap-5 text-[13px] leading-5 sm:flex">
              <Link
                href="/"
                className={active === "home" ? "font-medium text-ink" : "text-[var(--text-muted)] hover:text-ink"}
              >
                Home
              </Link>
              <Link
                href="/endpoints"
                className={
                  active === "endpoints" ? "font-medium text-ink" : "text-[var(--text-muted)] hover:text-ink"
                }
              >
                API
              </Link>
              <a
                href={`${API_BASE_URL}/docs/public`}
                target="_blank"
                rel="noreferrer"
                className="text-[var(--text-muted)] hover:text-ink"
              >
                Swagger
              </a>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <IconButton aria-label="Toggle theme" onClick={toggleTheme}>
              <Icon name={theme === "dark" ? "moon" : "sun"} size={16} />
            </IconButton>
            <PrimaryLink href={adminPath("/login")} className="h-8 px-3">
              Admin
            </PrimaryLink>
          </div>
        </header>
        <div className="wl-page-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
          {children}
        </div>
        <footer className="shrink-0 border-t border-[var(--border)] px-5 py-4 text-[12px] leading-[18px] text-[var(--text-muted)] md:px-8">
          WeightLoss Pro · meals &amp; workouts content API
        </footer>
      </div>
    </div>
  );
}
