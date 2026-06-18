"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function CustomerSearch({ initialQuery }: { initialQuery: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      const trimmedQuery = query.trim();

      if (trimmedQuery) {
        params.set("q", trimmedQuery);
      } else {
        params.delete("q");
      }

      params.delete("deleted");

      startTransition(() => {
        const nextUrl = params.toString()
          ? `${pathname}?${params.toString()}`
          : pathname;

        router.replace(nextUrl, { scroll: false });
      });
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [pathname, query, router, searchParams]);

  return (
    <label className="block border-b border-black/[0.06] p-5">
      <span className="sr-only">Cerca cliente</span>
      <input
        className="w-full rounded-full border border-black/10 bg-[#f7f7f5] px-5 py-3 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-black/30 focus:bg-white"
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Cerca cliente..."
        type="search"
        value={query}
      />
    </label>
  );
}
