"use client";

import { useMemo, useState } from "react";

export type RetentionHistoryPoint = {
  amount: number;
  date: string;
  event: string;
  label: string;
  score: number;
};

type RetentionHistoryDrawerProps = {
  customerName: string;
  currentScore: number;
  favoriteService: string;
  historicalValue: string;
  points: RetentionHistoryPoint[];
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("it-IT", {
    currency: "EUR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function parseDateValue(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function formatShortDate(value: string | null | undefined) {
  const date = parseDateValue(value);

  if (!date) {
    return "—";
  }

  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getPointChange(points: RetentionHistoryPoint[], currentScore: number) {
  if (points.length < 2) {
    return 0;
  }

  const latestDate = parseDateValue(points[points.length - 1].date);

  if (!latestDate) {
    return 0;
  }

  const cutoffDate = new Date(latestDate);

  cutoffDate.setDate(cutoffDate.getDate() - 90);

  const comparisonPoint =
    [...points].reverse().find((point) => {
      const pointDate = parseDateValue(point.date);

      return Boolean(pointDate && pointDate <= cutoffDate);
    }) ?? points[0];

  return currentScore - comparisonPoint.score;
}

function RetentionLineChart({
  compact = false,
  points,
}: {
  compact?: boolean;
  points: RetentionHistoryPoint[];
}) {
  const chartWidth = compact ? 300 : 920;
  const chartHeight = compact ? 70 : 340;
  const padding = compact
    ? { bottom: 8, left: 8, right: 8, top: 8 }
    : { bottom: 46, left: 56, right: 28, top: 28 };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;

  if (points.length < 2) {
    return (
      <div className="grid h-16 place-items-center rounded-[0.9rem] border border-dashed border-black/15 bg-[#f7f7f5] text-xs font-medium text-zinc-500">
        Storico non sufficiente
      </div>
    );
  }

  const chartPoints = points.map((point, index) => {
    const x =
      padding.left +
      (points.length === 1
        ? plotWidth / 2
        : (index / (points.length - 1)) * plotWidth);
    const y = padding.top + plotHeight - (point.score / 100) * plotHeight;

    return { ...point, x, y };
  });
  const linePath = chartPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath = `${linePath} L ${
    chartPoints[chartPoints.length - 1].x
  } ${padding.top + plotHeight} L ${chartPoints[0].x} ${
    padding.top + plotHeight
  } Z`;
  const labelEvery = points.length > 8 ? Math.ceil(points.length / 5) : 1;

  return (
    <div
      className={
        compact
          ? "overflow-hidden rounded-[0.9rem] border border-black/10 bg-[#f7f7f5] p-2"
          : "overflow-hidden rounded-[1.25rem] border border-black/10 bg-[#f7f7f5] p-4 sm:p-5"
      }
    >
      <svg
        aria-label="Grafico andamento retention score"
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
      >
        <title>Andamento retention score</title>
        <defs>
          <linearGradient id={compact ? "retentionAreaMini" : "retentionArea"} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="black" stopOpacity="0.14" />
            <stop offset="100%" stopColor="black" stopOpacity="0" />
          </linearGradient>
        </defs>
        {!compact
          ? [0, 50, 100].map((tick) => {
              const y = padding.top + plotHeight - (tick / 100) * plotHeight;

              return (
                <g key={tick}>
                  <line
                    stroke="rgba(24,24,27,0.10)"
                    strokeWidth="1"
                    x1={padding.left}
                    x2={chartWidth - padding.right}
                    y1={y}
                    y2={y}
                  />
                  <text
                    fill="rgb(113,113,122)"
                    fontSize="12"
                    textAnchor="end"
                    x={padding.left - 12}
                    y={y + 4}
                  >
                    {tick}
                  </text>
                </g>
              );
            })
          : null}
        <path d={areaPath} fill={`url(#${compact ? "retentionAreaMini" : "retentionArea"})`} />
        <path
          d={linePath}
          fill="none"
          stroke="black"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={compact ? "3" : "4"}
        />
        {chartPoints.map((point, index) => {
          const showLabel = !compact && (index % labelEvery === 0 || index === points.length - 1);
          const showScore = !compact && (points.length <= 7 || index === points.length - 1);

          return (
            <g key={`${point.date}-${index}`}>
              <circle
                cx={point.x}
                cy={point.y}
                fill="white"
                r={compact ? "3" : "6"}
                stroke="black"
                strokeWidth={compact ? "2" : "3"}
              />
              {showScore ? (
                <text
                  fill="black"
                  fontSize="12"
                  fontWeight="600"
                  textAnchor="middle"
                  x={point.x}
                  y={Math.max(14, point.y - 12)}
                >
                  {point.score}
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
                  {formatShortDate(point.date)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function RetentionHistoryDrawer({
  customerName,
  currentScore,
  favoriteService,
  historicalValue,
  points,
}: RetentionHistoryDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const variation = useMemo(
    () => getPointChange(points, currentScore),
    [currentScore, points],
  );
  const insightBullets = [
    points.length >= 2
      ? `Il punteggio è ${
          variation >= 0 ? "salito" : "sceso"
        } di ${Math.abs(variation)} punti negli ultimi 90 giorni.`
      : "",
    variation < 0 ? "Il cliente ha superato la frequenza abituale." : "",
    favoriteService !== "Non disponibile"
      ? `Il servizio più ricorrente è ${favoriteService}.`
      : "",
  ].filter(Boolean).slice(0, 3);

  return (
    <>
      <div className="mt-3 border-t border-black/10 pt-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">
            Storico score
          </p>
          <span className="rounded-full bg-black px-2.5 py-1 text-xs font-semibold text-white">
            {currentScore}
          </span>
        </div>
        <div className="mt-2">
          <RetentionLineChart compact points={points} />
        </div>
        <button
          className="mt-2 text-xs font-semibold text-black underline-offset-4 transition hover:underline"
          onClick={() => setIsOpen(true)}
          type="button"
        >
          Visualizza andamento
        </button>
      </div>

      {isOpen ? (
        <div aria-modal="true" className="fixed inset-0 z-50" role="dialog">
          <button
            aria-label="Chiudi storico fidelizzazione"
            className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"
            onClick={() => setIsOpen(false)}
            type="button"
          />
          <aside className="absolute inset-y-0 right-0 flex h-screen w-full flex-col overflow-hidden bg-white shadow-[0_30px_100px_rgba(0,0,0,0.24)] sm:w-[640px]">
            <header className="shrink-0 border-b border-black/10 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-500">
                    Storico Fidelizzazione
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-black">
                    {customerName}
                  </h2>
                </div>
                <button
                  className="grid size-9 place-items-center rounded-full border border-black/10 bg-white text-lg font-semibold text-black transition hover:bg-zinc-50"
                  onClick={() => setIsOpen(false)}
                  type="button"
                >
                  ×
                </button>
              </div>
            </header>
            <div className="flex-1 overflow-y-auto p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1rem] border border-black/10 bg-[#f7f7f5] p-4">
                  <p className="text-xs text-zinc-500">Score attuale</p>
                  <p className="mt-1 text-2xl font-semibold text-black">{currentScore}</p>
                </div>
                <div className="rounded-[1rem] border border-black/10 bg-[#f7f7f5] p-4">
                  <p className="text-xs text-zinc-500">Ultimi 90 giorni</p>
                  <p className="mt-1 text-2xl font-semibold text-black">
                    {variation > 0 ? "+" : ""}{variation} punti
                  </p>
                </div>
                <div className="rounded-[1rem] border border-black/10 bg-[#f7f7f5] p-4">
                  <p className="text-xs text-zinc-500">Visite analizzate</p>
                  <p className="mt-1 text-2xl font-semibold text-black">{Math.max(0, points.length - 1)}</p>
                </div>
                <div className="rounded-[1rem] border border-black/10 bg-[#f7f7f5] p-4">
                  <p className="text-xs text-zinc-500">Valore storico</p>
                  <p className="mt-1 text-2xl font-semibold text-black">{historicalValue}</p>
                </div>
              </div>

              <div className="mt-5">
                {points.length < 2 ? (
                  <div className="rounded-[1.25rem] border border-dashed border-black/15 bg-[#f7f7f5] p-8 text-center">
                    <p className="text-base font-semibold tracking-tight text-black">
                      Servono almeno 2 visite per visualizzare un andamento affidabile.
                    </p>
                  </div>
                ) : (
                  <RetentionLineChart points={points} />
                )}
              </div>

              <article className="mt-5 rounded-[1.2rem] border border-black/10 bg-black p-4 text-white">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  L’AI ha rilevato
                </p>
                <ul className="mt-3 space-y-2">
                  {insightBullets.length > 0 ? (
                    insightBullets.map((bullet) => (
                      <li className="flex gap-2 text-sm leading-6 text-zinc-200" key={bullet}>
                        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-white" />
                        <span>{bullet}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-sm text-zinc-300">
                      Aggiungi visite per generare insight più affidabili.
                    </li>
                  )}
                </ul>
              </article>

              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
                  Timeline eventi
                </p>
                <div className="mt-3 space-y-3">
                  {points.map((point, index) => (
                    <article
                      className="rounded-[1rem] border border-black/10 bg-white p-4"
                      key={`${point.date}-${index}`}
                    >
                      <p className="text-sm font-semibold text-black">
                        {formatShortDate(point.date)}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-zinc-600">
                        Score {point.score} · {point.label}
                        {point.amount > 0 ? ` · ${formatCurrency(point.amount)}` : ""}
                      </p>
                      <p className="mt-1 text-xs font-medium text-zinc-400">
                        {point.event}
                      </p>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
