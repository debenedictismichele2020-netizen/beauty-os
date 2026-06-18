"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { customerGenderOptions } from "@/lib/gender";
import { addCustomer, type AddCustomerState } from "./actions";

const initialState: AddCustomerState = {
  success: false,
  message: "",
};

export default function AddCustomerModal() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    addCustomer,
    initialState,
  );

  useEffect(() => {
    if (!state.success) {
      return;
    }

    const timeout = window.setTimeout(() => {
      formRef.current?.reset();
      setIsOpen(false);
      router.refresh();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [router, state.success]);

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <button
        className="w-fit rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        Aggiungi cliente
      </button>

      {state.message ? (
        <p
          className={`text-sm ${
            state.success ? "text-emerald-700" : "text-rose-700"
          }`}
        >
          {state.message}
        </p>
      ) : null}

      {isOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/45 px-5 py-8 backdrop-blur-sm"
          role="dialog"
        >
          <div className="w-full max-w-3xl overflow-hidden rounded-[1.5rem] border border-white/20 bg-white shadow-[0_28px_90px_rgba(0,0,0,0.24)]">
            <div className="border-b border-black/10 p-5">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-500">
                Nuovo profilo CRM
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-black">
                Aggiungi cliente
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Inserisci i dati principali per avviare la fidelizzazione AI.
              </p>
            </div>

            <form action={formAction} className="p-5" ref={formRef}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-zinc-700">
                  Nome
                  <input
                    className="mt-2 w-full rounded-2xl border border-black/10 bg-[#f7f7f5] px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-black/30"
                    name="first_name"
                    required
                    type="text"
                  />
                </label>

                <label className="text-sm font-medium text-zinc-700">
                  Cognome
                  <input
                    className="mt-2 w-full rounded-2xl border border-black/10 bg-[#f7f7f5] px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-black/30"
                    name="last_name"
                    required
                    type="text"
                  />
                </label>

                <label className="text-sm font-medium text-zinc-700">
                  Telefono
                  <input
                    className="mt-2 w-full rounded-2xl border border-black/10 bg-[#f7f7f5] px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-black/30"
                    name="phone"
                    type="tel"
                  />
                </label>

                <label className="text-sm font-medium text-zinc-700">
                  Email
                  <input
                    className="mt-2 w-full rounded-2xl border border-black/10 bg-[#f7f7f5] px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-black/30"
                    name="email"
                    type="email"
                  />
                </label>

                <label className="text-sm font-medium text-zinc-700">
                  Genere
                  <select
                    className="mt-2 w-full rounded-2xl border border-black/10 bg-[#f7f7f5] px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-black/30"
                    defaultValue="Non specificato"
                    name="gender"
                  >
                    {customerGenderOptions.map((gender) => (
                      <option key={gender} value={gender}>
                        {gender}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm font-medium text-zinc-700">
                  Data di nascita
                  <input
                    className="mt-2 w-full rounded-2xl border border-black/10 bg-[#f7f7f5] px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-black/30"
                    name="birth_date"
                    type="date"
                  />
                </label>

                <label className="text-sm font-medium text-zinc-700 sm:col-span-2">
                  Note
                  <textarea
                    className="mt-2 min-h-28 w-full resize-none rounded-2xl border border-black/10 bg-[#f7f7f5] px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-black/30"
                    name="notes"
                  />
                </label>
              </div>

              {!state.success && state.message ? (
                <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {state.message}
                </p>
              ) : null}

              <div className="mt-5 flex flex-wrap justify-end gap-3">
                <button
                  className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50"
                  onClick={() => setIsOpen(false)}
                  type="button"
                >
                  Annulla
                </button>
                <button
                  className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white shadow-[0_14px_35px_rgba(0,0,0,0.18)] transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
                  disabled={isPending}
                  type="submit"
                >
                  {isPending ? "Salvataggio..." : "Salva cliente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
