"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";

import type { Appointment } from "../data";
import {
  deleteAppointment,
  type DeleteAppointmentState,
  type EditAppointmentState,
  updateAppointment,
} from "../actions";
import AppointmentServiceFields from "./AppointmentServiceFields";

const initialEditState: EditAppointmentState = {
  success: false,
  message: "",
};

const initialDeleteState: DeleteAppointmentState = {
  success: false,
  message: "",
};

export default function AppointmentActionsModal({
  appointment,
  customerId,
}: {
  appointment: Appointment;
  customerId: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"edit" | "delete" | null>(null);
  const updateAppointmentAction = updateAppointment.bind(
    null,
    customerId,
    appointment.id,
  );
  const deleteAppointmentAction = deleteAppointment.bind(
    null,
    customerId,
    appointment.id,
  );
  const [editState, editFormAction, isEditPending] = useActionState(
    updateAppointmentAction,
    initialEditState,
  );
  const [deleteState, deleteFormAction, isDeletePending] = useActionState(
    deleteAppointmentAction,
    initialDeleteState,
  );
  const activeState = mode === "delete" ? deleteState : editState;
  const modal =
    mode ? (
      <div
        aria-modal="true"
        className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/45 px-4 py-6 backdrop-blur-sm sm:px-5 sm:py-8"
        role="dialog"
      >
        <div className="w-full max-w-2xl overflow-hidden rounded-[1.5rem] border border-white/20 bg-white shadow-[0_28px_90px_rgba(0,0,0,0.24)]">
          {mode === "edit" ? (
            <>
              <div className="border-b border-black/10 p-5">
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-500">
                  Storico visite
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-black">
                  Modifica visita
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  I KPI cliente verranno ricalcolati automaticamente.
                </p>
              </div>

              <form action={editFormAction} className="p-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <AppointmentServiceFields
                      initialPrice={appointment.amountValue}
                      initialServiceName={appointment.serviceName}
                    />
                  </div>

                  <label className="text-sm font-medium text-zinc-700 sm:col-span-2">
                    Data visita
                    <input
                      className="mt-2 w-full rounded-2xl border border-black/10 bg-[#f7f7f5] px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-black/30"
                      defaultValue={appointment.appointmentDate}
                      name="appointment_date"
                      required
                      type="date"
                    />
                  </label>

                  <label className="text-sm font-medium text-zinc-700 sm:col-span-2">
                    Note
                    <textarea
                      className="mt-2 min-h-28 w-full resize-none rounded-2xl border border-black/10 bg-[#f7f7f5] px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-black/30"
                      defaultValue={
                        appointment.notes ===
                        "Nessuna nota inserita per questa visita."
                          ? ""
                          : appointment.notes
                      }
                      name="notes"
                    />
                  </label>
                </div>

                {!editState.success && editState.message ? (
                  <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {editState.message}
                  </p>
                ) : null}

                <div className="mt-5 flex flex-wrap justify-end gap-3">
                  <button
                    className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition duration-200 hover:-translate-y-px hover:bg-zinc-50"
                    onClick={() => setMode(null)}
                    type="button"
                  >
                    Annulla
                  </button>
                  <button
                    className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white shadow-[0_14px_35px_rgba(0,0,0,0.18)] transition duration-200 hover:-translate-y-px hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400 disabled:hover:translate-y-0"
                    disabled={isEditPending}
                    type="submit"
                  >
                    {isEditPending ? "Salvataggio..." : "Salva modifiche"}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <>
              <div className="border-b border-black/10 p-5">
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-500">
                  Storico visite
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-black">
                  Eliminare visita?
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Questa operazione aggiornerà automaticamente i KPI cliente.
                </p>
              </div>

              <form action={deleteFormAction} className="p-5">
                <div className="rounded-[1.25rem] border border-black/10 bg-[#f7f7f5] p-4">
                  <p className="text-sm font-semibold text-black">
                    {appointment.serviceName}
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">
                    {appointment.formattedDate} · {appointment.amount}
                  </p>
                </div>

                {!deleteState.success && deleteState.message ? (
                  <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {deleteState.message}
                  </p>
                ) : null}

                <div className="mt-5 flex flex-wrap justify-end gap-3">
                  <button
                    className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition duration-200 hover:-translate-y-px hover:bg-zinc-50"
                    onClick={() => setMode(null)}
                    type="button"
                  >
                    Annulla
                  </button>
                  <button
                    className="rounded-full bg-rose-700 px-5 py-2 text-sm font-medium text-white shadow-[0_14px_35px_rgba(190,18,60,0.18)] transition duration-200 hover:-translate-y-px hover:bg-rose-800 disabled:cursor-not-allowed disabled:bg-rose-300 disabled:hover:translate-y-0"
                    disabled={isDeletePending}
                    type="submit"
                  >
                    {isDeletePending ? "Eliminazione..." : "Elimina visita"}
                  </button>
                </div>
              </form>
            </>
          )}

          {activeState.success && activeState.message ? (
            <p className="border-t border-black/10 px-5 py-4 text-sm text-emerald-700">
              {activeState.message}
            </p>
          ) : null}
        </div>
      </div>
    ) : null;

  useEffect(() => {
    if (!editState.success && !deleteState.success) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setMode(null);
      router.refresh();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [deleteState.success, editState.success, router]);

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <button
        className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-medium text-zinc-700 transition duration-200 hover:-translate-y-px hover:bg-zinc-50"
        onClick={() => setMode("edit")}
        type="button"
      >
        Modifica
      </button>
      <button
        className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 transition duration-200 hover:-translate-y-px hover:bg-rose-50"
        onClick={() => setMode("delete")}
        type="button"
      >
        Elimina
      </button>

      {modal ? createPortal(modal, document.body) : null}
    </div>
  );
}
