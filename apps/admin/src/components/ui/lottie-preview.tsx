"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/icon";

type LottiePreviewProps = {
  src?: string | null;
  animationData?: unknown;
  className?: string;
};

export function LottiePreview({ src, animationData, className }: LottiePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let animation: { destroy: () => void } | null = null;

    async function play() {
      setStatus("loading");
      try {
        let data = animationData;
        if (data == null) {
          if (!src) throw new Error("missing_lottie");
          const response = await fetch(src);
          if (!response.ok) throw new Error("lottie_fetch_failed");
          data = await response.json();
        }
        if (cancelled || !containerRef.current) return;
        if (!data || typeof data !== "object") throw new Error("invalid_lottie");

        const { default: lottie } = await import("lottie-web");
        if (cancelled || !containerRef.current) return;

        containerRef.current.replaceChildren();
        animation = lottie.loadAnimation({
          container: containerRef.current,
          renderer: "svg",
          loop: true,
          autoplay: true,
          animationData: data,
        });
        if (!cancelled) setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    void play();

    return () => {
      cancelled = true;
      animation?.destroy();
      animation = null;
    };
  }, [src, animationData]);

  return (
    <div className={cn("relative size-full", className)}>
      <div ref={containerRef} className="size-full [&_svg]:size-full" />
      {status !== "ready" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-[var(--card-bg)] px-2 text-center">
          {status === "error" ? (
            <>
              <Icon name="file" size={20} />
              <p className="text-[11px] leading-4 text-[var(--text-muted)]">Could not play Lottie</p>
            </>
          ) : (
            <span className="size-6 animate-pulse rounded-full bg-[var(--pastel-purple)]" />
          )}
        </div>
      ) : null}
    </div>
  );
}
