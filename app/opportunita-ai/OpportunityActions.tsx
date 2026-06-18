"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import {
  buildFinalWhatsAppMessage,
  buildWhatsAppUrl,
  cleanWhatsAppMessage,
  cleanWhatsAppPhone as normalizeWhatsAppPhone,
  isMobileDevice,
} from "@/lib/whatsapp";
import { upsertOperationalTask } from "@/lib/operationalTasks";
import { generateOpportunityMessage } from "./actions";

type OpportunityActionsProps = {
  customerId: string;
  customerName: string;
  estimatedValue: number;
  phone: string;
  priority: "Alta" | "Media" | "Bassa";
  reason: string;
  recoveryProbability: number;
  today: string;
};

function cleanWhatsAppPhone(phone: string) {
  const digits = normalizeWhatsAppPhone(phone);

  if (!digits) {
    return "";
  }

  return digits;
}

export default function OpportunityActions({
  customerId,
  customerName,
  estimatedValue,
  phone,
  priority,
  reason,
  recoveryProbability,
  today,
}: OpportunityActionsProps) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const cleanedPhone = cleanWhatsAppPhone(phone);
  const finalMessage = buildFinalWhatsAppMessage(message, "recupero");

  function savePendingOperationalTask() {
    upsertOperationalTask({
      customerId,
      customerName,
      date: today,
      estimatedValue,
      id: `recovery:${customerId}:${today}`,
      phone,
      priority,
      profileHref: `/clients/${customerId}`,
      reason,
      recoveryProbability,
      status: "pending",
      title: `Contatta ${customerName}`,
      type: "recovery",
    });
  }

  function generateMessage() {
    setError("");
    setMessage("");
    setIsOpen(true);
    savePendingOperationalTask();

    startTransition(async () => {
      const result = await generateOpportunityMessage(customerId);

      if (result.success) {
        setMessage(cleanWhatsAppMessage(result.message));
        return;
      }

      setError(result.error || "Messaggio non generato. Riprova.");
    });
  }

  function openWhatsApp() {
    if (!cleanedPhone) {
      setError("Numero di telefono non disponibile per questo cliente.");
      setIsOpen(true);
      return;
    }

    if (!finalMessage) {
      setError("Genera prima il messaggio AI per questo cliente.");
      setIsOpen(true);
      return;
    }

    setError("");
    savePendingOperationalTask();
    const whatsappUrl = buildWhatsAppUrl({
      phone: cleanedPhone,
      message: finalMessage,
      target: isMobileDevice() ? "mobile" : "web",
    });
    const openedWindow = window.open(
      whatsappUrl,
      "_blank",
      "noopener,noreferrer",
    );

    if (!openedWindow) {
      void navigator.clipboard.writeText(finalMessage);
      setError("Il browser ha bloccato WhatsApp. Messaggio copiato negli appunti.");
    }
  }

  async function copyMessage() {
    if (!finalMessage) {
      setError("Messaggio non disponibile.");
      return;
    }

    await navigator.clipboard.writeText(finalMessage);
    setError("Messaggio copiato.");
  }

  return (
    <>
      <div className="flex flex-nowrap items-center gap-2">
        <button
          className="whitespace-nowrap rounded-full bg-black px-3.5 py-2 text-xs font-medium text-white shadow-[0_12px_28px_rgba(0,0,0,0.16)] transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
          disabled={isPending}
          onClick={generateMessage}
          type="button"
        >
          {isPending ? "..." : "WhatsApp"}
        </button>
        <Link
          className="whitespace-nowrap rounded-full border border-black/10 bg-white px-3.5 py-2 text-xs font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50"
          href={`/clients/${customerId}`}
        >
          Profilo
        </Link>
      </div>

      {isOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/45 px-5 py-8 backdrop-blur-sm"
          role="dialog"
        >
          <div className="w-full max-w-2xl overflow-hidden rounded-[1.5rem] border border-white/20 bg-white shadow-[0_28px_90px_rgba(0,0,0,0.24)]">
            <div className="border-b border-black/10 p-5">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-500">
                Messaggio di recupero
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-black">
                {customerName}
              </h2>
            </div>

            <div className="p-5">
              {isPending ? (
                <div className="rounded-[1.25rem] border border-black/10 bg-[#f7f7f5] p-5 text-sm font-medium text-zinc-600">
                  Generazione messaggio AI in corso...
                </div>
              ) : null}

              {!isPending && message ? (
                <p className="whitespace-pre-wrap rounded-[1.25rem] border border-black/10 bg-[#f7f7f5] p-5 text-sm leading-7 text-zinc-800">
                  {finalMessage}
                </p>
              ) : null}

              {!isPending && error ? (
                <p
                  className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                    error === "Messaggio copiato."
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-rose-200 bg-rose-50 text-rose-700"
                  }`}
                >
                  {error}
                </p>
              ) : null}

              <div className="mt-5 flex flex-wrap justify-end gap-3">
                <button
                  className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50"
                  onClick={() => setIsOpen(false)}
                  type="button"
                >
                  Chiudi
                </button>
                <button
                  className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-400"
                  disabled={!finalMessage}
                  onClick={copyMessage}
                  type="button"
                >
                  Copia messaggio
                </button>
                <button
                  className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white shadow-[0_14px_35px_rgba(0,0,0,0.18)] transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
                  disabled={!finalMessage}
                  onClick={openWhatsApp}
                  type="button"
                >
                  Apri WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
