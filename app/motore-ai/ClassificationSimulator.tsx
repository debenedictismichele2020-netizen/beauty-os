"use client";

import { useMemo, useState } from "react";

type EstimatedStatus = "VIP" | "Fedele" | "A rischio" | "Perso";

export type ThresholdPreviewCustomer = {
  id: string;
  retentionScore: number;
  status: EstimatedStatus;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getEstimatedStatus(score: number): EstimatedStatus {
  if (score >= 90) {
    return "VIP";
  }

  if (score >= 70) {
    return "Fedele";
  }

  if (score >= 40) {
    return "A rischio";
  }

  return "Perso";
}

function getPreviewStatus({
  atRiskThreshold,
  score,
  vipThreshold,
}: {
  atRiskThreshold: number;
  score: number;
  vipThreshold: number;
}): EstimatedStatus {
  if (score >= vipThreshold) {
    return "VIP";
  }

  if (score >= 70) {
    return "Fedele";
  }

  if (score >= atRiskThreshold) {
    return "A rischio";
  }

  return "Perso";
}

function getStatusStyles(status: EstimatedStatus) {
  if (status === "VIP") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "Fedele") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  if (status === "A rischio") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  return "border-rose-200 bg-rose-50 text-rose-700";
}

function calculateEstimatedScore({
  daysSinceLastVisit,
  frequencyDays,
  totalSpent,
}: {
  daysSinceLastVisit: number;
  frequencyDays: number;
  totalSpent: number;
}) {
  const safeFrequency = Math.max(1, frequencyDays);
  const missedCycles = daysSinceLastVisit / safeFrequency;
  const frequencyScore = clamp(100 - Math.max(0, missedCycles - 1) * 28, 0, 100);
  const valueScore = clamp((totalSpent / 1200) * 100, 0, 100);
  const recencyScore = clamp(100 - daysSinceLastVisit * 1.4, 0, 100);

  return Math.round(
    frequencyScore * 0.4 + valueScore * 0.4 + recencyScore * 0.2,
  );
}

function getExplanation({
  daysSinceLastVisit,
  frequencyDays,
  status,
}: {
  daysSinceLastVisit: number;
  frequencyDays: number;
  status: EstimatedStatus;
}) {
  const delay = daysSinceLastVisit - frequencyDays;

  if (status === "VIP") {
    return "Questo cliente sarebbe classificato VIP perché combina valore elevato e segnali di ritorno molto solidi.";
  }

  if (status === "Fedele") {
    return "Questo cliente sarebbe classificato Fedele perché mantiene una relazione regolare con il salone.";
  }

  if (status === "A rischio") {
    return delay > 0
      ? "Questo cliente sarebbe classificato A rischio perché ha superato la frequenza abituale."
      : "Questo cliente sarebbe classificato A rischio perché alcuni segnali non sono ancora abbastanza forti.";
  }

  return "Questo cliente sarebbe classificato Perso perché l’inattività è molto superiore alla frequenza abituale.";
}

function InfoButton({
  expanded,
  onClick,
}: {
  expanded: boolean;
  onClick: () => void;
}) {
  return (
    <button
      aria-expanded={expanded}
      className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm transition hover:border-black/20 hover:bg-zinc-50 hover:text-black"
      onClick={onClick}
      type="button"
    >
      Info
    </button>
  );
}

function InfoPanel({
  example,
  text,
  title,
}: {
  example: string;
  text: string;
  title: string;
}) {
  return (
    <div className="mt-4 rounded-[1.15rem] border border-black/10 bg-[#f7f7f5] p-4 text-sm leading-6 text-zinc-600">
      <p className="font-semibold text-black">{title}</p>
      <p className="mt-2">{text}</p>
      <p className="mt-3 text-zinc-500">{example}</p>
    </div>
  );
}

export function ThresholdPreview({
  customers,
}: {
  customers: ThresholdPreviewCustomer[];
}) {
  const [vipThreshold, setVipThreshold] = useState("90");
  const [atRiskThreshold, setAtRiskThreshold] = useState("40");
  const [showInfo, setShowInfo] = useState(false);
  const preview = useMemo(() => {
    const normalizedVipThreshold = clamp(Number(vipThreshold) || 90, 71, 100);
    const normalizedAtRiskThreshold = clamp(
      Number(atRiskThreshold) || 40,
      1,
      69,
    );
    const updatedCustomers = customers.map((customer) => ({
      ...customer,
      previewStatus: getPreviewStatus({
        atRiskThreshold: normalizedAtRiskThreshold,
        score: customer.retentionScore,
        vipThreshold: normalizedVipThreshold,
      }),
    }));

    return {
      atRiskCount: updatedCustomers.filter(
        (customer) => customer.previewStatus === "A rischio",
      ).length,
      changedCount: updatedCustomers.filter(
        (customer) => customer.previewStatus !== customer.status,
      ).length,
      vipCount: updatedCustomers.filter(
        (customer) => customer.previewStatus === "VIP",
      ).length,
    };
  }, [atRiskThreshold, customers, vipThreshold]);

  return (
    <section className="rounded-[1.5rem] border border-black/10 bg-white p-5 shadow-[0_22px_70px_rgba(0,0,0,0.07)]">
      <div className="border-b border-black/10 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-400">
              Preview modifica soglie
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-black">
              Cosa succede se cambi le regole
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              Simulazione locale sui clienti attuali. Nessun salvataggio.
            </p>
          </div>
          <InfoButton
            expanded={showInfo}
            onClick={() => setShowInfo((current) => !current)}
          />
        </div>
        {showInfo ? (
          <InfoPanel
            example="Esempio: se abbassi la soglia VIP da 90 a 85, più clienti potrebbero diventare VIP. Se alzi la soglia A rischio, meno clienti verranno segnalati come fragili."
            text="Questa simulazione ti fa vedere cosa accadrebbe se cambiassi le soglie del motore AI. Non modifica i dati e non salva nulla. Serve per capire quanto sarebbe più severa o più morbida la classificazione clienti."
            title="A cosa serve la preview soglie?"
          />
        ) : null}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-zinc-600">Soglia VIP</span>
          <input
            className="mt-2 h-12 w-full rounded-2xl border border-black/10 bg-[#f7f7f5] px-4 text-sm font-medium text-black outline-none transition focus:border-black/30 focus:bg-white"
            max="100"
            min="71"
            onChange={(event) => setVipThreshold(event.target.value)}
            type="number"
            value={vipThreshold}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-zinc-600">
            Soglia A rischio
          </span>
          <input
            className="mt-2 h-12 w-full rounded-2xl border border-black/10 bg-[#f7f7f5] px-4 text-sm font-medium text-black outline-none transition focus:border-black/30 focus:bg-white"
            max="69"
            min="1"
            onChange={(event) => setAtRiskThreshold(event.target.value)}
            type="number"
            value={atRiskThreshold}
          />
        </label>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[1rem] border border-black/10 bg-[#f7f7f5] p-4">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-400">
            Diventerebbero VIP
          </p>
          <p className="mt-3 text-3xl font-semibold text-black">
            {preview.vipCount}
          </p>
        </div>
        <div className="rounded-[1rem] border border-black/10 bg-[#f7f7f5] p-4">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-400">
            Diventerebbero a rischio
          </p>
          <p className="mt-3 text-3xl font-semibold text-black">
            {preview.atRiskCount}
          </p>
        </div>
        <div className="rounded-[1rem] border border-black/10 bg-[#f7f7f5] p-4">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-400">
            Cambierebbero categoria
          </p>
          <p className="mt-3 text-3xl font-semibold text-black">
            {preview.changedCount}
          </p>
        </div>
      </div>

      <p className="mt-5 rounded-[1rem] border border-black/10 bg-white p-4 text-sm leading-6 text-zinc-600">
        Con queste soglie, {preview.changedCount} clienti cambierebbero
        classificazione.
      </p>
    </section>
  );
}

export function ClassificationSimulator() {
  const [totalSpent, setTotalSpent] = useState("650");
  const [frequencyDays, setFrequencyDays] = useState("30");
  const [daysSinceLastVisit, setDaysSinceLastVisit] = useState("62");
  const [hasSimulated, setHasSimulated] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const result = useMemo(() => {
    const score = calculateEstimatedScore({
      daysSinceLastVisit: Number(daysSinceLastVisit) || 0,
      frequencyDays: Number(frequencyDays) || 1,
      totalSpent: Number(totalSpent) || 0,
    });
    const status = getEstimatedStatus(score);

    return {
      explanation: getExplanation({
        daysSinceLastVisit: Number(daysSinceLastVisit) || 0,
        frequencyDays: Number(frequencyDays) || 1,
        status,
      }),
      score,
      status,
    };
  }, [daysSinceLastVisit, frequencyDays, totalSpent]);

  return (
    <section className="rounded-[1.75rem] border border-black/10 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.08)]">
      <div className="grid gap-0 lg:grid-cols-[1fr_0.9fr]">
        <div className="border-b border-black/10 p-5 sm:p-6 lg:border-b-0 lg:border-r">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-400">
                Simulatore classificazione premium
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-black">
                Simula un cliente prima di agire
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
                Il simulatore è locale, non salva nulla e non scrive su
                Supabase.
              </p>
            </div>
            <InfoButton
              expanded={showInfo}
              onClick={() => setShowInfo((current) => !current)}
            />
          </div>
          {showInfo ? (
            <InfoPanel
              example="Esempio: se un cliente torna ogni 30 giorni ma manca da 70 giorni, il sistema potrebbe segnalarlo come A rischio."
              text="Ti permette di provare un cliente ipotetico prima di salvarlo nel CRM. Inserisci spesa totale, frequenza media e giorni dall’ultima visita: Beauty OS ti mostra quale stato AI avrebbe quel cliente. È utile per capire se un cliente verrebbe classificato come VIP, Fedele, A rischio o Perso."
              title="A cosa serve questo simulatore?"
            />
          ) : null}

          <div className="mt-6 grid gap-4">
            <label className="block">
              <span className="text-sm font-medium text-zinc-600">
                Spesa totale cliente
              </span>
              <input
                className="mt-2 h-12 w-full rounded-2xl border border-black/10 bg-[#f7f7f5] px-4 text-sm font-medium text-black outline-none transition focus:border-black/30 focus:bg-white"
                min="0"
                onChange={(event) => setTotalSpent(event.target.value)}
                type="number"
                value={totalSpent}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-600">
                Frequenza media visite in giorni
              </span>
              <input
                className="mt-2 h-12 w-full rounded-2xl border border-black/10 bg-[#f7f7f5] px-4 text-sm font-medium text-black outline-none transition focus:border-black/30 focus:bg-white"
                min="1"
                onChange={(event) => setFrequencyDays(event.target.value)}
                type="number"
                value={frequencyDays}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-600">
                Giorni dall’ultima visita
              </span>
              <input
                className="mt-2 h-12 w-full rounded-2xl border border-black/10 bg-[#f7f7f5] px-4 text-sm font-medium text-black outline-none transition focus:border-black/30 focus:bg-white"
                min="0"
                onChange={(event) => setDaysSinceLastVisit(event.target.value)}
                type="number"
                value={daysSinceLastVisit}
              />
            </label>
            <button
              className="h-12 w-fit rounded-full bg-black px-5 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(0,0,0,0.18)] transition hover:bg-zinc-800"
              onClick={() => setHasSimulated(true)}
              type="button"
            >
              Simula classificazione
            </button>
          </div>
        </div>

        <div className="flex min-h-80 flex-col justify-center bg-[#f7f7f5] p-5 sm:p-6">
          {hasSimulated ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium text-zinc-500">
                  Risultato stimato
                </p>
                <span
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${getStatusStyles(result.status)}`}
                >
                  {result.status}
                </span>
              </div>
              <p className="mt-7 text-6xl font-semibold tracking-tight text-black">
                {result.score}
                <span className="text-2xl text-zinc-400">/100</span>
              </p>
              <p className="mt-5 text-sm leading-7 text-zinc-600">
                {result.explanation}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-zinc-500">
                Risultato in attesa
              </p>
              <p className="mt-5 text-5xl font-semibold tracking-tight text-black">
                --
                <span className="text-2xl text-zinc-400">/100</span>
              </p>
              <p className="mt-5 text-sm leading-7 text-zinc-500">
                Inserisci i dati e avvia la simulazione per visualizzare score,
                stato AI e motivazione.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
