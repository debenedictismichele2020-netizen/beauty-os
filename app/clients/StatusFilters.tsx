import Link from "next/link";

const filters = [
  { label: "Tutti", value: "" },
  { label: "VIP", value: "VIP" },
  { label: "Fedele", value: "Fedele" },
  { label: "A rischio", value: "A rischio" },
  { label: "Perso", value: "Perso" },
];

export default function StatusFilters({
  activeStatus,
  searchQuery,
}: {
  activeStatus: string;
  searchQuery: string;
}) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-black/[0.06] px-5 pb-6 pt-5">
      {filters.map((filter) => {
        const params = new URLSearchParams();

        if (searchQuery) {
          params.set("q", searchQuery);
        }

        if (filter.value) {
          params.set("status", filter.value);
        }

        const href = params.toString()
          ? `/clients?${params.toString()}`
          : "/clients";
        const isActive = activeStatus === filter.value;

        return (
          <Link
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              isActive
                ? "bg-black text-white shadow-sm"
                : "border border-black/10 bg-white text-zinc-600 shadow-sm hover:bg-zinc-50 hover:text-zinc-950"
            }`}
            href={href}
            key={filter.label}
          >
            {filter.label}
          </Link>
        );
      })}
    </div>
  );
}
