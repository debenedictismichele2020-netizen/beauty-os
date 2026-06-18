"use client";

import { useState } from "react";

import {
  buildFinalWhatsAppMessage,
  buildWhatsAppUrl,
  cleanWhatsAppMessage,
  cleanWhatsAppPhone,
  isMobileDevice,
} from "@/lib/whatsapp";
import { generateAiRecoveryMessage } from "../actions";

type RecoveryMessageModalProps = {
  buttonVariant?: "dark" | "light";
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerStatus: string;
  retentionScore: number;
  daysSinceLastVisit: number;
  generatedMessage: string;
};

const statusLabels: Record<string, string> = {
  VIP: "VIP",
  Loyal: "Fedele",
  "At Risk": "A rischio",
  Lost: "Perso",
};

export default function RecoveryMessageModal({
  buttonVariant = "dark",
  customerId,
  customerName,
  customerPhone,
  customerStatus,
  retentionScore,
  daysSinceLastVisit,
  generatedMessage,
}: RecoveryMessageModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState(cleanWhatsAppMessage(generatedMessage));
  const [errorMessage, setErrorMessage] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Copia messaggio");
  const finalMessage = buildFinalWhatsAppMessage(message, customerStatus);

  async function generateMessage() {
    setIsGenerating(true);
    setErrorMessage("");
    setCopyLabel("Copia messaggio");

    const result = await generateAiRecoveryMessage(customerId);

    if (result.success) {
      setMessage(cleanWhatsAppMessage(result.message));
      setErrorMessage("");
    } else {
      setMessage(cleanWhatsAppMessage(generatedMessage));
      setErrorMessage(result.message);
    }

    setIsGenerating(false);
  }

  function openModal() {
    setMessage("");
    setErrorMessage("");
    setCopyLabel("Copia messaggio");
    setIsOpen(true);
    void generateMessage();
  }

  function regenerateMessage() {
    void generateMessage();
  }

  async function copyMessage() {
    if (!finalMessage) {
      return;
    }

    await navigator.clipboard.writeText(finalMessage);
    setCopyLabel("Copiato");
  }

  function cleanPhoneNumber(phone: string) {
    return cleanWhatsAppPhone(phone);
  }

  function openWhatsApp() {
    const cleanedPhone = cleanPhoneNumber(customerPhone);

    if (!cleanedPhone) {
      setErrorMessage("Numero di telefono non disponibile per questo cliente.");
      return;
    }

    if (!finalMessage) {
      setErrorMessage("Genera un messaggio prima di aprire WhatsApp.");
      return;
    }

    setErrorMessage("");
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
      setErrorMessage(
        "Il browser ha bloccato WhatsApp. Messaggio copiato negli appunti.",
      );
    }
  }

  return (
    <>
      <button
        className={
          buttonVariant === "light"
            ? "w-full rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-medium text-white shadow-sm transition duration-200 hover:-translate-y-px hover:bg-white/15"
            : "rounded-full bg-black px-4 py-2 text-xs font-medium text-white shadow-[0_14px_35px_rgba(0,0,0,0.22)] transition duration-200 hover:-translate-y-px hover:bg-zinc-800"
        }
        onClick={openModal}
        type="button"
      >
        Genera messaggio
      </button>

      {isOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-black/45 px-5 backdrop-blur-sm"
          role="dialog"
        >
          <div className="w-full max-w-2xl overflow-hidden rounded-[1.5rem] border border-white/20 bg-white shadow-[0_28px_90px_rgba(0,0,0,0.24)]">
            <div className="border-b border-black/10 p-5">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-500">
                AI di fidelizzazione
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-black">
                Messaggio di recupero per {customerName}
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Bozza WhatsApp personalizzata sui segnali CRM di fidelizzazione.
              </p>
            </div>

            <div className="p-5">
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-[1rem] border border-black/10 bg-[#f7f7f5] p-4">
                  <p className="text-xs font-medium text-zinc-500">Cliente</p>
                  <p className="mt-2 text-sm font-semibold text-black">
                    {customerName}
                  </p>
                </div>
                <div className="rounded-[1rem] border border-black/10 bg-[#f7f7f5] p-4">
                  <p className="text-xs font-medium text-zinc-500">Stato</p>
                  <p className="mt-2 text-sm font-semibold text-black">
                    {statusLabels[customerStatus] ?? customerStatus}
                  </p>
                </div>
                <div className="rounded-[1rem] border border-black/10 bg-[#f7f7f5] p-4">
                  <p className="text-xs font-medium text-zinc-500">Punteggio</p>
                  <p className="mt-2 text-sm font-semibold text-black">
                    {retentionScore}/100
                  </p>
                </div>
                <div className="rounded-[1rem] border border-black/10 bg-[#f7f7f5] p-4">
                  <p className="text-xs font-medium text-zinc-500">Inattiva</p>
                  <p className="mt-2 text-sm font-semibold text-black">
                    {daysSinceLastVisit} giorni
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-[1.25rem] border border-black/10 bg-[#f7f7f5] p-5">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                  Messaggio WhatsApp generato
                </p>
                {isGenerating ? (
                  <p className="mt-4 text-sm leading-7 text-zinc-500">
                    Generazione del messaggio in corso...
                  </p>
                ) : (
                  <p className="mt-4 text-sm leading-7 text-zinc-800">
                    {finalMessage}
                  </p>
                )}
              </div>

              {errorMessage ? (
                <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {errorMessage}
                </p>
              ) : null}

              <div className="mt-5 flex flex-wrap justify-end gap-3">
                <button
                  className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-400"
                  disabled={isGenerating}
                  onClick={regenerateMessage}
                  type="button"
                >
                  {isGenerating ? "Generazione..." : "Rigenera messaggio"}
                </button>
                <button
                  className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-400"
                  disabled={!finalMessage || isGenerating}
                  onClick={copyMessage}
                  type="button"
                >
                  {copyLabel}
                </button>
                <button
                  className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-400"
                  disabled={isGenerating}
                  onClick={openWhatsApp}
                  type="button"
                >
                  Apri WhatsApp
                </button>
                <button
                  className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white shadow-[0_14px_35px_rgba(0,0,0,0.18)] transition hover:bg-zinc-800"
                  onClick={() => setIsOpen(false)}
                  type="button"
                >
                  Chiudi
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
