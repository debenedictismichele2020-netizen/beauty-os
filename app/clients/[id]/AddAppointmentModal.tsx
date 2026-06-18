"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { addAppointment, type AddAppointmentState } from "../actions";
import AppointmentServiceFields from "./AppointmentServiceFields";

const initialState: AddAppointmentState = {
  success: false,
  message: "",
};

export default function AddAppointmentModal({
  customerId,
}: {
  customerId: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const addAppointmentAction = addAppointment.bind(null, customerId);
  const [state, formAction, isPending] = useActionState(
    addAppointmentAction,
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
        className="w-fit rounded-full bg-black px-4 py-2 text-sm font-medium text-white shadow-[0_14px_35px_rgba(0,0,0,0.18)] transition duration-200 hover:-translate-y-px hover:bg-zinc-800"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        Aggiungi visita
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
          <div className="w-full max-w-2xl overflow-hidden rounded-[1.5rem] border border-white/20 bg-white shadow-[0_28px_90px_rgba(0,0,0,0.24)]">
            <div className="border-b border-black/10 p-5">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-500">
                Nuova visita
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-black">
                Aggiungi visita
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Registra servizio, importo, data e note per lo storico cliente.
              </p>
            </div>

            <form action={formAction} className="p-5" ref={formRef}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <AppointmentServiceFields />
                </div>
                <label className="text-sm font-medium text-zinc-700 sm:col-span-2">
                  Data visita
                  <input
                    className="mt-2 w-full rounded-2xl border border-black/10 bg-[#f7f7f5] px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-black/30"
                    name="appointment_date"
                    required
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
                  className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition duration-200 hover:-translate-y-px hover:bg-zinc-50"
                  onClick={() => setIsOpen(false)}
                  type="button"
                >
                  Annulla
                </button>
                <button
                  className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white shadow-[0_14px_35px_rgba(0,0,0,0.18)] transition duration-200 hover:-translate-y-px hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400 disabled:hover:translate-y-0"
                  disabled={isPending}
                  type="submit"
                >
                  {isPending ? "Salvataggio..." : "Salva visita"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
