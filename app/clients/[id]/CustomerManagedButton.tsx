"use client";

import { useEffect, useState } from "react";

import {
  getTodayDateKey,
  readOperationalTasks,
  upsertOperationalTask,
} from "@/lib/operationalTasks";

type CustomerManagedButtonProps = {
  customerId: string;
  customerName: string;
  estimatedValue: number;
  reason: string;
  recoveryProbability: number;
  variant?: "button" | "badge";
};

export default function CustomerManagedButton({
  customerId,
  customerName,
  estimatedValue,
  reason,
  recoveryProbability,
  variant = "button",
}: CustomerManagedButtonProps) {
  const [isManaged, setIsManaged] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    function refreshManagedState() {
      const today = getTodayDateKey();

      setIsManaged(
        readOperationalTasks().some(
          (task) =>
            task.customerId === customerId &&
            task.type === "recovery" &&
            task.date === today &&
            task.status === "completed",
          ),
      );
    }

    const timeoutId = window.setTimeout(refreshManagedState, 0);

    window.addEventListener("beauty-os-customer-managed", refreshManagedState);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener(
        "beauty-os-customer-managed",
        refreshManagedState,
      );
    };
  }, [customerId]);

  function markAsManaged() {
    const today = getTodayDateKey();

    upsertOperationalTask({
      customerId,
      customerName,
      date: today,
      estimatedValue,
      id: `recovery:${customerId}:${today}`,
      priority:
        estimatedValue >= 300 || recoveryProbability >= 70
          ? "Alta"
          : estimatedValue >= 100 || recoveryProbability >= 40
            ? "Media"
            : "Bassa",
      profileHref: `/clients/${customerId}`,
      reason,
      recoveryProbability,
      status: "completed",
      title: `Gestisci ${customerName}`,
      type: "recovery",
    });
    setIsManaged(true);
    setMessage("Cliente segnato come gestito");
    window.dispatchEvent(new Event("beauty-os-customer-managed"));
  }

  if (variant === "badge") {
    return (
      <span
        className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${
          isManaged
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-amber-200 bg-amber-50 text-amber-800"
        }`}
      >
        {isManaged ? "Gestito oggi" : "Da gestire"}
      </span>
    );
  }

  return (
    <div className="w-full">
      <button
        className={`w-full justify-center rounded-full border px-4 py-2 text-xs font-medium shadow-sm transition duration-200 ${
          isManaged
            ? "border-black/10 bg-zinc-100 text-zinc-500"
            : "border-black/10 bg-white text-zinc-800 hover:-translate-y-px hover:bg-zinc-50"
        }`}
        disabled={isManaged}
        onClick={markAsManaged}
        type="button"
      >
        {isManaged ? "Gestito oggi" : "Segna come gestito"}
      </button>
      {message ? (
        <p className="mt-2 text-center text-xs font-medium text-emerald-300">
          {message}
        </p>
      ) : null}
    </div>
  );
}
