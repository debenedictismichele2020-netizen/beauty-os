"use client";

import { useEffect, useState } from "react";

import { getTodayDateKey, readOperationalTasks } from "@/lib/operationalTasks";

type CustomerRetentionTrendProps = {
  customerId: string;
  defaultTrend: "In peggioramento" | "In recupero" | "Stabile";
};

function getTrendMarker(trend: CustomerRetentionTrendProps["defaultTrend"]) {
  if (trend === "In recupero") {
    return "↑";
  }

  if (trend === "In peggioramento") {
    return "↓";
  }

  return "→";
}

export default function CustomerRetentionTrend({
  customerId,
  defaultTrend,
}: CustomerRetentionTrendProps) {
  const [trend, setTrend] = useState(defaultTrend);

  useEffect(() => {
    function refreshTrend() {
      const today = getTodayDateKey();
      const isManagedToday = readOperationalTasks().some(
        (task) =>
          task.customerId === customerId &&
          task.type === "recovery" &&
          task.date === today &&
          task.status === "completed",
      );

      if (isManagedToday) {
        setTrend("In recupero");
      }
    }

    const timeoutId = window.setTimeout(refreshTrend, 0);

    window.addEventListener("beauty-os-customer-managed", refreshTrend);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("beauty-os-customer-managed", refreshTrend);
    };
  }, [customerId]);

  return (
    <p className="mt-2 text-sm font-semibold text-zinc-700">
      Trend: {getTrendMarker(trend)} {trend}
    </p>
  );
}
