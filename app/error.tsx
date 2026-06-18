"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f7f5] px-5 text-zinc-950">
      <section className="w-full max-w-xl rounded-[1.5rem] border border-black/10 bg-white p-6 text-center shadow-[0_22px_70px_rgba(0,0,0,0.07)]">
        <p className="text-xs font-medium uppercase tracking-[0.28em] text-zinc-500">
          Errore dati
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-black">
          Non riesco a caricare i dati CRM
        </h1>
        <p className="mt-4 text-sm leading-6 text-zinc-600">
          {error.message ||
            "Si e verificato un problema durante la lettura dei dati da Supabase."}
        </p>
        <button
          className="mt-6 rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white shadow-[0_14px_35px_rgba(0,0,0,0.22)] transition hover:bg-zinc-800"
          onClick={reset}
          type="button"
        >
          Riprova
        </button>
      </section>
    </main>
  );
}
