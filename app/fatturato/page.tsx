import type { Metadata } from "next";
import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentSalon } from "@/lib/currentSalon";
import { PageShell } from "../components/BeautyUi";
import { formatCompactCurrency } from "../clients/data";

export const metadata: Metadata = {
  title: "Fatturato | Beauty OS",
  description: "Analisi economica reale per Beauty OS.",
};

export const dynamic = "force-dynamic";

type PeriodKey =
  | "questo-mese"
  | "mese-scorso"
  | "ultimi-3-mesi"
  | "ultimi-6-mesi"
  | "anno-corrente";

type FatturatoPageProps = {
  searchParams: Promise<{ periodo?: string }>;
};

type CustomerRevenueRow = {
  ai_status: string | null;
  first_name: string | null;
  id: string;
  last_name: string | null;
  recovery_probability?: number | null;
  total_spent: number | null;
};

type AppointmentRevenueRow = {
  appointment_date: string;
  customer_id: string;
  service_price?: number | string | null;
  amount?: number | string | null;
};

type PeriodRange = {
  end: string;
  key: PeriodKey;
  label: string;
  months: string[];
  start: string;
  trendGranularity: "day" | "week" | "month";
};

type DateRange = {
  end: string;
  start: string;
};

const periodOptions: Array<{ key: PeriodKey; label: string }> = [
  { key: "questo-mese", label: "Questo mese" },
  { key: "mese-scorso", label: "Mese scorso" },
  { key: "ultimi-3-mesi", label: "Ultimi 3 mesi" },
  { key: "ultimi-6-mesi", label: "Ultimi 6 mesi" },
  { key: "anno-corrente", label: "Anno corrente" },
];

const segmentOrder = ["VIP", "Fedele", "A rischio", "Perso"] as const;

const segmentStyles: Record<(typeof segmentOrder)[number], string> = {
  VIP: "bg-emerald-600",
  Fedele: "bg-sky-600",
  "A rischio": "bg-amber-500",
  Perso: "bg-rose-600",
};

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function toMonthKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function getMonthKeys(start: Date, end: Date) {
  const months: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);

  while (cursor <= last) {
    months.push(toMonthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
}

function getPeriodRange(periodKey: PeriodKey): PeriodRange {
  const today = new Date();
  const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  if (periodKey === "mese-scorso") {
    const start = addMonths(currentMonth, -1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);

    return {
      end: toDateKey(end),
      key: periodKey,
      label: "Mese scorso",
      months: getMonthKeys(start, end),
      start: toDateKey(start),
      trendGranularity: "day",
    };
  }

  if (periodKey === "ultimi-3-mesi") {
    const start = addMonths(currentMonth, -2);

    return {
      end: toDateKey(today),
      key: periodKey,
      label: "Ultimi 3 mesi",
      months: getMonthKeys(start, today),
      start: toDateKey(start),
      trendGranularity: "week",
    };
  }

  if (periodKey === "ultimi-6-mesi") {
    const start = addMonths(currentMonth, -5);

    return {
      end: toDateKey(today),
      key: periodKey,
      label: "Ultimi 6 mesi",
      months: getMonthKeys(start, today),
      start: toDateKey(start),
      trendGranularity: "month",
    };
  }

  if (periodKey === "anno-corrente") {
    const start = new Date(today.getFullYear(), 0, 1);

    return {
      end: toDateKey(today),
      key: periodKey,
      label: "Anno corrente",
      months: getMonthKeys(start, today),
      start: toDateKey(start),
      trendGranularity: "month",
    };
  }

  return {
    end: toDateKey(today),
    key: "questo-mese",
    label: "Questo mese",
    months: getMonthKeys(currentMonth, today),
    start: toDateKey(currentMonth),
    trendGranularity: "day",
  };
}

function getPreviousPeriodRange(period: PeriodRange): DateRange {
  const start = new Date(`${period.start}T00:00:00`);
  const end = new Date(`${period.end}T00:00:00`);
  const days = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1,
  );
  const previousEnd = new Date(start);

  previousEnd.setDate(previousEnd.getDate() - 1);

  const previousStart = new Date(previousEnd);

  previousStart.setDate(previousStart.getDate() - days + 1);

  return {
    end: toDateKey(previousEnd),
    start: toDateKey(previousStart),
  };
}

function normalizePeriod(period?: string): PeriodKey {
  return periodOptions.some((option) => option.key === period)
    ? (period as PeriodKey)
    : "questo-mese";
}

function getMoneyValue(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);

  return Number.isFinite(amount) ? amount : 0;
}

function getAppointmentValue(appointment: AppointmentRevenueRow) {
  return getMoneyValue(appointment.service_price ?? appointment.amount ?? 0);
}

function getStatus(customer: CustomerRevenueRow) {
  return typeof customer.ai_status === "string"
    ? customer.ai_status.trim()
    : "Non classificato";
}

function getMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);

  return new Intl.DateTimeFormat("it-IT", {
    month: "short",
  }).format(new Date(year, month - 1, 1));
}

function getDayLabel(dayKey: string) {
  const [, , day] = dayKey.split("-").map(Number);

  return `${day}`;
}

function getWeekStartDate(date: Date) {
  const weekStart = new Date(date);
  const day = weekStart.getDay();
  const offset = day === 0 ? -6 : 1 - day;

  weekStart.setDate(weekStart.getDate() + offset);

  return new Date(
    weekStart.getFullYear(),
    weekStart.getMonth(),
    weekStart.getDate(),
  );
}

function getWeekLabel(weekKey: string) {
  const weekStart = new Date(`${weekKey}T00:00:00`);
  const weekEnd = new Date(weekStart);

  weekEnd.setDate(weekEnd.getDate() + 6);

  const startLabel = new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
  }).format(weekStart);
  const endLabel = new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "short",
  }).format(weekEnd);

  return `${startLabel}-${endLabel}`;
}

async function getCustomers() {
  const supabase = createSupabaseServerClient();
  const currentSalon = await getCurrentSalon();

  if (!supabase || !currentSalon) {
    return [];
  }

  let selectFields =
    "id,first_name,last_name,birth_date,ai_status,total_spent,recovery_probability";
  const { data, error } = await supabase
    .from("customers")
    .select(selectFields)
    .eq("salon_id", currentSalon.id);

  if (
    error &&
    selectFields.includes("recovery_probability") &&
    error.message.includes("recovery_probability")
  ) {
    selectFields = "id,first_name,last_name,birth_date,ai_status,total_spent";
    const fallback = await supabase
      .from("customers")
      .select(selectFields)
      .eq("salon_id", currentSalon.id);

    if (fallback.error) {
      console.error("Errore Supabase fatturato customers:", fallback.error);
      return [];
    }

    return fallback.data as unknown as CustomerRevenueRow[];
  }

  if (error) {
    console.error("Errore Supabase fatturato customers:", error);
    return [];
  }

  return data as unknown as CustomerRevenueRow[];
}

async function getAppointments(period: DateRange) {
  const supabase = createSupabaseServerClient();
  const currentSalon = await getCurrentSalon();

  if (!supabase || !currentSalon) {
    return [];
  }

  const { data, error } = await supabase
    .from("appointments")
    .select("customer_id,appointment_date,service_price")
    .eq("salon_id", currentSalon.id)
    .gte("appointment_date", period.start)
    .lte("appointment_date", period.end)
    .order("appointment_date", { ascending: true });

  if (!error) {
    return data as unknown as AppointmentRevenueRow[];
  }

  const missingServicePrice =
    error.message.includes("service_price") ||
    error.details?.includes("service_price");

  if (!missingServicePrice) {
    console.error("Errore Supabase fatturato appointments:", error);
    return [];
  }

  const fallback = await supabase
    .from("appointments")
    .select("customer_id,appointment_date,amount")
    .eq("salon_id", currentSalon.id)
    .gte("appointment_date", period.start)
    .lte("appointment_date", period.end)
    .order("appointment_date", { ascending: true });

  if (fallback.error) {
    console.error("Errore Supabase fatturato appointments:", fallback.error);
    return [];
  }

  return fallback.data as unknown as AppointmentRevenueRow[];
}

function calculateTrendRevenue(
  appointments: AppointmentRevenueRow[],
  period: PeriodRange,
) {
  const revenueByBucket: Record<string, number> = {};

  appointments.forEach((appointment) => {
    const appointmentDate = new Date(`${appointment.appointment_date}T00:00:00`);
    const bucketKey =
      period.trendGranularity === "day"
        ? appointment.appointment_date
        : period.trendGranularity === "week"
          ? toDateKey(getWeekStartDate(appointmentDate))
          : appointment.appointment_date.slice(0, 7);

    revenueByBucket[bucketKey] =
      (revenueByBucket[bucketKey] ?? 0) + getAppointmentValue(appointment);
  });

  return Object.entries(revenueByBucket)
    .sort(([firstBucket], [secondBucket]) =>
      firstBucket.localeCompare(secondBucket),
    )
    .map(([bucket, value]) => ({
      key: bucket,
      label:
        period.trendGranularity === "day"
          ? getDayLabel(bucket)
          : period.trendGranularity === "week"
            ? getWeekLabel(bucket)
            : getMonthLabel(bucket),
      longLabel:
        period.trendGranularity === "day"
          ? new Intl.DateTimeFormat("it-IT", {
              day: "numeric",
              month: "short",
            }).format(new Date(`${bucket}T00:00:00`))
          : period.trendGranularity === "week"
            ? `Settimana ${getWeekLabel(bucket)}`
            : getMonthLabel(bucket),
      value,
    }));
}

function calculateSegmentRevenue(customers: CustomerRevenueRow[]) {
  const revenue = {
    VIP: 0,
    Fedele: 0,
    "A rischio": 0,
    Perso: 0,
  };

  customers.forEach((customer) => {
    const status = getStatus(customer);

    if (status && status in revenue) {
      revenue[status as keyof typeof revenue] += getMoneyValue(customer.total_spent);
    }
  });

  return segmentOrder.map((segment) => ({
    label: segment,
    value: revenue[segment],
  }));
}

function calculateSegmentCounts(customers: CustomerRevenueRow[]) {
  const counts = {
    VIP: 0,
    Fedele: 0,
    "A rischio": 0,
    Perso: 0,
  };

  customers.forEach((customer) => {
    const status = getStatus(customer);

    if (status && status in counts) {
      counts[status as keyof typeof counts] += 1;
    }
  });

  return segmentOrder.map((segment) => ({
    label: segment,
    value: counts[segment],
  }));
}

function PeriodSelector({
  activePeriod,
}: {
  activePeriod: PeriodKey;
}) {
  return (
    <div className="flex max-w-full gap-2 overflow-x-auto rounded-full border border-black/10 bg-white p-1 shadow-sm">
      {periodOptions.map((option) => (
        <Link
          className={`whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-medium transition ${
            option.key === activePeriod
              ? "bg-black text-white"
              : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950"
          }`}
          href={`/fatturato?periodo=${option.key}`}
          key={option.key}
        >
          {option.label}
        </Link>
      ))}
    </div>
  );
}

function getRecoverableAppointmentRevenue(
  customers: CustomerRevenueRow[],
  appointments: AppointmentRevenueRow[],
) {
  const recoverableCustomerIds = new Set(
    customers
      .filter((customer) => {
        const status = getStatus(customer);

        return status === "A rischio" || status === "Perso";
      })
      .map((customer) => customer.id),
  );

  return appointments.reduce((total, appointment) => {
    return recoverableCustomerIds.has(appointment.customer_id)
      ? total + getAppointmentValue(appointment)
      : total;
  }, 0);
}

function calculateChangePercent(currentValue: number, previousValue: number) {
  if (previousValue === 0) {
    return currentValue > 0 ? 100 : 0;
  }

  return Math.round(((currentValue - previousValue) / previousValue) * 100);
}

function formatChange(change: number) {
  if (change > 0) {
    return {
      label: `↑ +${change}% rispetto al periodo precedente`,
      styles: "text-emerald-700",
    };
  }

  if (change < 0) {
    return {
      label: `↓ ${change}% rispetto al periodo precedente`,
      styles: "text-rose-700",
    };
  }

  return {
    label: "0% rispetto al periodo precedente",
    styles: "text-zinc-500",
  };
}

function RevenueTrendChart({
  data,
}: {
  data: Array<{ key: string; label: string; longLabel: string; value: number }>;
}) {
  const maxValue = Math.max(...data.map((item) => item.value), 0);
  const chartWidth = 920;
  const chartHeight = 340;
  const padding = {
    bottom: 46,
    left: 72,
    right: 30,
    top: 28,
  };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;

  if (maxValue <= 0) {
    return (
      <div className="grid min-h-72 place-items-center rounded-[1.25rem] border border-dashed border-black/15 bg-[#f7f7f5] p-8 text-center">
        <div>
          <p className="text-base font-semibold tracking-tight text-black">
            Aggiungi più visite per visualizzare l’andamento.
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Il grafico usa le visite registrate nel periodo selezionato.
          </p>
        </div>
      </div>
    );
  }

  const yMax = Math.max(maxValue, 1);
  const points = data.map((item, index) => {
    const x =
      padding.left +
      (data.length === 1 ? plotWidth / 2 : (index / (data.length - 1)) * plotWidth);
    const y = padding.top + plotHeight - (item.value / yMax) * plotHeight;

    return {
      ...item,
      x,
      y,
    };
  });
  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath = `${linePath} L ${
    points[points.length - 1].x
  } ${padding.top + plotHeight} L ${points[0].x} ${
    padding.top + plotHeight
  } Z`;
  const yTicks = [0, 0.5, 1].map((ratio) => ({
    label: formatCompactCurrency(Math.round(yMax * ratio)),
    y: padding.top + plotHeight - ratio * plotHeight,
  }));
  const labelEvery = data.length > 10 ? Math.ceil(data.length / 6) : 1;

  return (
    <div className="overflow-hidden rounded-[1.25rem] border border-black/10 bg-[#f7f7f5] p-4 sm:p-5">
      <svg
        aria-label="Grafico lineare andamento fatturato"
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
      >
        <title>Andamento fatturato</title>
        <defs>
          <linearGradient id="revenueArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="black" stopOpacity="0.16" />
            <stop offset="100%" stopColor="black" stopOpacity="0" />
          </linearGradient>
        </defs>

        {yTicks.map((tick) => (
          <g key={tick.label}>
            <line
              stroke="rgba(24,24,27,0.10)"
              strokeWidth="1"
              x1={padding.left}
              x2={chartWidth - padding.right}
              y1={tick.y}
              y2={tick.y}
            />
            <text
              fill="rgb(113,113,122)"
              fontSize="12"
              textAnchor="end"
              x={padding.left - 14}
              y={tick.y + 4}
            >
              {tick.label}
            </text>
          </g>
        ))}

        <line
          stroke="rgba(24,24,27,0.18)"
          strokeWidth="1"
          x1={padding.left}
          x2={chartWidth - padding.right}
          y1={padding.top + plotHeight}
          y2={padding.top + plotHeight}
        />

        <path d={areaPath} fill="url(#revenueArea)" />
        <path
          d={linePath}
          fill="none"
          stroke="black"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="4"
        />

        {points.map((point, index) => {
          const showLabel = index % labelEvery === 0 || index === points.length - 1;
          const showValue = point.value > 0 && (points.length <= 8 || point.value === maxValue);

          return (
            <g key={point.key}>
              <circle
                cx={point.x}
                cy={point.y}
                fill="white"
                r="6"
                stroke="black"
                strokeWidth="3"
              >
                <title>
                  {point.longLabel}: {formatCompactCurrency(point.value)}
                </title>
              </circle>
              {showValue ? (
                <text
                  fill="black"
                  fontSize="12"
                  fontWeight="600"
                  textAnchor="middle"
                  x={point.x}
                  y={Math.max(14, point.y - 12)}
                >
                  {formatCompactCurrency(point.value)}
                </text>
              ) : null}
              {showLabel ? (
                <text
                  fill="rgb(113,113,122)"
                  fontSize="12"
                  textAnchor="middle"
                  x={point.x}
                  y={chartHeight - 14}
                >
                  {point.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function SegmentBarChart({
  data,
  emptyText,
  formatValue,
}: {
  data: Array<{ label: (typeof segmentOrder)[number]; value: number }>;
  emptyText: string;
  formatValue: (value: number) => string;
}) {
  const maxValue = Math.max(...data.map((item) => item.value), 0);

  if (maxValue <= 0) {
    return (
      <div className="rounded-[1.25rem] border border-dashed border-black/15 bg-[#f7f7f5] p-6 text-sm leading-6 text-zinc-500">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data.map((item) => {
        const width = Math.max(4, Math.round((item.value / maxValue) * 100));

        return (
          <div key={item.label}>
            <div className="mb-2 flex items-center justify-between gap-4">
              <p className="text-sm font-semibold text-black">{item.label}</p>
              <p className="text-sm font-medium text-zinc-500">
                {formatValue(item.value)}
              </p>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-zinc-100">
              <div
                className={`h-full rounded-full ${segmentStyles[item.label]}`}
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RevenueKpiCard({
  change,
  detail,
  label,
  value,
}: {
  change: number;
  detail: string;
  label: string;
  value: string | number;
}) {
  const formattedChange = formatChange(change);

  return (
    <article className="min-h-44 rounded-[1.35rem] border border-black/10 bg-white p-5 shadow-[0_18px_55px_rgba(0,0,0,0.06)]">
      <p className="text-sm font-medium text-zinc-500">{label}</p>
      <p className="mt-8 text-4xl font-semibold tracking-tight text-black">
        {value}
      </p>
      <p className="mt-3 text-sm leading-6 text-zinc-500">{detail}</p>
      <p className={`mt-4 text-sm font-semibold ${formattedChange.styles}`}>
        {formattedChange.label}
      </p>
    </article>
  );
}

function ForecastCard({
  detail,
  label,
  value,
}: {
  detail: string;
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-[1.35rem] border border-black/10 bg-white p-5 shadow-[0_18px_55px_rgba(0,0,0,0.06)]">
      <p className="text-sm font-medium text-zinc-500">{label}</p>
      <p className="mt-8 text-3xl font-semibold tracking-tight text-black">
        {value}
      </p>
      <p className="mt-3 text-sm leading-6 text-zinc-500">{detail}</p>
    </article>
  );
}

export default async function FatturatoPage({
  searchParams,
}: FatturatoPageProps) {
  const { periodo } = await searchParams;
  const activePeriod = normalizePeriod(periodo);
  const period = getPeriodRange(activePeriod);
  const previousPeriod = getPreviousPeriodRange(period);
  const [customers, appointments, previousAppointments] = await Promise.all([
    getCustomers(),
    getAppointments(period),
    getAppointments(previousPeriod),
  ]);
  const periodRevenue = appointments.reduce(
    (total, appointment) => total + getAppointmentValue(appointment),
    0,
  );
  const previousPeriodRevenue = previousAppointments.reduce(
    (total, appointment) => total + getAppointmentValue(appointment),
    0,
  );
  const averageTicket =
    appointments.length > 0 ? Math.round(periodRevenue / appointments.length) : 0;
  const previousAverageTicket =
    previousAppointments.length > 0
      ? Math.round(previousPeriodRevenue / previousAppointments.length)
      : 0;
  const recoverableRevenue = customers
    .filter((customer) => {
      const status = getStatus(customer);

      return status === "A rischio" || status === "Perso";
    })
    .reduce(
      (total, customer) => total + getMoneyValue(customer.total_spent),
      0,
    );
  const recoverableAppointmentRevenue = getRecoverableAppointmentRevenue(
    customers,
    appointments,
  );
  const previousRecoverableAppointmentRevenue = getRecoverableAppointmentRevenue(
    customers,
    previousAppointments,
  );
  const trendRevenue = calculateTrendRevenue(appointments, period);
  const segmentRevenue = calculateSegmentRevenue(customers);
  const segmentCounts = calculateSegmentCounts(customers);
  const topSegment = [...segmentRevenue].sort(
    (firstSegment, secondSegment) => secondSegment.value - firstSegment.value,
  )[0];
  const activeCustomerCount = customers.filter((customer) => {
    const status = getStatus(customer);

    return status === "VIP" || status === "Fedele";
  }).length;
  const forecastRevenue = averageTicket * activeCustomerCount;
  const forecastVisits = activeCustomerCount;
  const insight = `${period.label} il salone ha generato ${formatCompactCurrency(
    periodRevenue,
  )}. ${
    topSegment && topSegment.value > 0
      ? `Il segmento ${topSegment.label} produce la quota maggiore del fatturato nel periodo.`
      : "Non c’è ancora un segmento dominante nel periodo selezionato."
  } I clienti recuperabili rappresentano ${formatCompactCurrency(
    recoverableRevenue,
  )} di valore storico.`;
  const revenueChange = calculateChangePercent(
    periodRevenue,
    previousPeriodRevenue,
  );
  const ticketChange = calculateChangePercent(
    averageTicket,
    previousAverageTicket,
  );
  const visitsChange = calculateChangePercent(
    appointments.length,
    previousAppointments.length,
  );
  const recoverableChange = calculateChangePercent(
    recoverableAppointmentRevenue,
    previousRecoverableAppointmentRevenue,
  );

  return (
    <PageShell
      active="Fatturato"
      sidebarEyebrow="Fatturato"
      sidebarText="Leggi andamento, ticket medio e valore recuperabile partendo dalle visite realmente registrate."
    >
      <header className="mb-10 border-b border-black/10 pb-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 max-w-3xl">
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-zinc-500">
              Dashboard economica
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-black sm:text-5xl">
              Fatturato
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-500">
              Analisi economica del salone basata su visite, clienti e recupero.
            </p>
          </div>
          <div className="w-full xl:w-auto xl:max-w-[620px]">
            <PeriodSelector activePeriod={activePeriod} />
          </div>
        </div>
      </header>

      <section className="grid gap-4 pb-6 sm:grid-cols-2 xl:grid-cols-4">
        <RevenueKpiCard
          change={revenueChange}
          detail={period.label}
          label="Fatturato periodo"
          value={formatCompactCurrency(periodRevenue)}
        />
        <RevenueKpiCard
          change={ticketChange}
          detail="Fatturato diviso visite"
          label="Ticket medio"
          value={formatCompactCurrency(averageTicket)}
        />
        <RevenueKpiCard
          change={visitsChange}
          detail="Appuntamenti nel periodo"
          label="Visite registrate"
          value={appointments.length}
        />
        <RevenueKpiCard
          change={recoverableChange}
          detail="Valore storico clienti A rischio + Persi"
          label="Fatturato recuperabile"
          value={formatCompactCurrency(recoverableRevenue)}
        />
      </section>

      <section className="pb-6">
        <article className="rounded-[1.5rem] border border-black/10 bg-white p-5 shadow-[0_22px_70px_rgba(0,0,0,0.07)]">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-400">
                Andamento fatturato
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-black">
                Andamento fatturato
              </h2>
            </div>
            <span className="w-fit rounded-full border border-black/10 bg-[#f7f7f5] px-3 py-1.5 text-xs font-medium text-zinc-700">
              {period.label}
            </span>
          </div>
          <RevenueTrendChart data={trendRevenue} />
        </article>
      </section>

      <section className="rounded-[1.5rem] border border-black/10 bg-black p-6 text-white shadow-[0_22px_70px_rgba(0,0,0,0.18)]">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-500">
          Lettura AI del fatturato
        </p>
        <p className="mt-5 max-w-5xl text-xl font-semibold leading-8 tracking-tight text-white">
          {insight}
        </p>
      </section>

      <section className="grid gap-5 py-6 xl:grid-cols-2">
        <article className="rounded-[1.5rem] border border-black/10 bg-white p-5 shadow-[0_22px_70px_rgba(0,0,0,0.07)]">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-400">
            Fatturato per segmento
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-black">
            Distribuzione clienti
          </h2>
          <div className="mt-6">
            <SegmentBarChart
              data={segmentRevenue}
              emptyText="Nessun fatturato per segmento disponibile."
              formatValue={formatCompactCurrency}
            />
          </div>
        </article>

        <article className="rounded-[1.5rem] border border-black/10 bg-white p-5 shadow-[0_22px_70px_rgba(0,0,0,0.07)]">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-400">
            Distribuzione clienti per segmento
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-black">
            Composizione database
          </h2>
          <div className="mt-6">
            <SegmentBarChart
              data={segmentCounts}
              emptyText="Nessun cliente classificato per segmento."
              formatValue={(value) => `${value} clienti`}
            />
          </div>
        </article>
      </section>

      <section className="py-6">
        <div className="mb-4">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-400">
            Forecast AI
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-black">
            Previsione economica
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ForecastCard
            detail="Stima basata su ticket medio e clienti attivi"
            label="Fatturato previsto"
            value={formatCompactCurrency(forecastRevenue)}
          />
          <ForecastCard
            detail="Valore storico dei segmenti A rischio e Persi"
            label="Rischio fatturato"
            value={formatCompactCurrency(recoverableRevenue)}
          />
          <ForecastCard
            detail="Stima visite dai clienti attivi classificati"
            label="Visite previste"
            value={`${forecastVisits}`}
          />
          <ForecastCard
            detail={
              topSegment && topSegment.value > 0
                ? `Il segmento ${topSegment.label} resta il motore economico principale.`
                : "Registra più visite per rendere la previsione più solida."
            }
            label="Indicazione AI"
            value={topSegment && topSegment.value > 0 ? topSegment.label : "In attesa"}
          />
        </div>
      </section>
    </PageShell>
  );
}
