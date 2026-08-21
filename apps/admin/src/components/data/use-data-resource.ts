"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { parseDataResource, type DataResourceId } from "@/lib/data-resources";

export function useDataResourceParam() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const resource = parseDataResource(searchParams.get("resource"));

  const setResource = (next: DataResourceId) => {
    router.replace(`${pathname}?resource=${next}`, { scroll: false });
  };

  return [resource, setResource] as const;
}
