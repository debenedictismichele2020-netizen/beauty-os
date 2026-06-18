"use client";

import { useActionState, useState } from "react";

import { deleteCustomer, type DeleteCustomerState } from "../actions";

const initialState: DeleteCustomerState = {
  success: false,
  message: "",
};

export default function DeleteCustomerModal({
  customerId,
}: {
  customerId: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    deleteCustomer.bind(null, customerId),
    initialState,
  );

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <button
        className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 shadow-sm transition duration-200 hover:-translate-y-px hover:bg-rose-100"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        Elimina cliente
      </button>

      {!state.success && state.message ? (
        <p className="text-sm text-rose-700">{state.message}</p>
      ) : null}

      {isOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-black/45 px-5 backdrop-blur-sm"
          role="dialog"
        >
          <div className="w-full max-w-lg overflow-hidden rounded-[1.5rem] border border-white/20 bg-white shadow-[0_28px_90px_rgba(0,0,0,0.24)]">
            <div className="border-b border-black/10 p-5">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-rose-500">
                Conferma eliminazione
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-black">
                Eliminare cliente?
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                Questa operazione non può essere annullata.
              </p>
            </div>

            <form action={formAction} className="p-5">
              {!state.success && state.message ? (
                <p className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {state.message}
                </p>
              ) : null}

              <div className="flex flex-wrap justify-end gap-3">
                <button
                  className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50"
                  onClick={() => setIsOpen(false)}
                  type="button"
                >
                  Annulla
                </button>
                <button
                  className="rounded-full bg-rose-700 px-5 py-2 text-sm font-medium text-white shadow-[0_14px_35px_rgba(190,18,60,0.24)] transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:bg-rose-300"
                  disabled={isPending}
                  type="submit"
                >
                  {isPending ? "Eliminazione..." : "Elimina cliente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
