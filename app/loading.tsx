export default function Loading() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f7f5] px-6 text-zinc-950">
      <div className="flex flex-col items-center text-center">
        <div className="grid size-12 place-items-center rounded-2xl bg-black text-sm font-semibold text-white shadow-[0_16px_45px_rgba(0,0,0,0.18)]">
          BO
        </div>
        <div className="mt-6 h-1 w-24 overflow-hidden rounded-full bg-black/10">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-black" />
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400">
          Verifica accesso
        </p>
      </div>
    </main>
  );
}
