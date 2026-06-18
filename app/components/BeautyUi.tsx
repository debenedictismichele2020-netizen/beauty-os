import type { ReactNode } from "react";

import { CollapsibleSidebarShell } from "./CollapsibleSidebarShell";

export type BeautyPage =
  | "Panoramica"
  | "Agenda AI"
  | "Clienti"
  | "Fidelizzazione"
  | "Campagne"
  | "Catalogo"
  | "Fatturato"
  | "Opportunità AI"
  | "Impostazioni AI"
  | "Impostazioni";

export function PageShell({
  active,
  children,
}: {
  active: BeautyPage;
  children: ReactNode;
  sidebarEyebrow: string;
  sidebarText: string;
}) {
  return (
    <CollapsibleSidebarShell active={active}>
      {children}
    </CollapsibleSidebarShell>
  );
}

export function PageHeader({
  actions,
  eyebrow,
  subtitle,
  title,
}: {
  actions?: ReactNode;
  eyebrow: string;
  subtitle?: string;
  title: string;
}) {
  return (
    <header className="flex flex-col gap-5 border-b border-black/10 pb-6 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-[0.28em] text-zinc-500">
          {eyebrow}
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-black sm:text-5xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-3 md:justify-end">
          {actions}
        </div>
      ) : null}
    </header>
  );
}

export function MetricCard({
  badge,
  detail,
  label,
  value,
}: {
  badge?: string;
  detail: string;
  label: string;
  value: ReactNode;
}) {
  return (
    <article className="min-h-44 rounded-[1.35rem] border border-black/10 bg-white p-5 shadow-[0_18px_55px_rgba(0,0,0,0.06)]">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm font-medium text-zinc-500">{label}</p>
        {badge ? (
          <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
            {badge}
          </span>
        ) : null}
      </div>
      <p className="mt-8 break-words text-4xl font-semibold tracking-tight text-black">
        {value}
      </p>
      <p className="mt-3 text-sm leading-6 text-zinc-500">{detail}</p>
    </article>
  );
}

export function SectionCard({
  action,
  children,
  className = "",
  description,
  eyebrow,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  description?: string;
  eyebrow?: string;
  title?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-[1.5rem] border border-black/10 bg-white shadow-[0_22px_70px_rgba(0,0,0,0.07)] ${className}`}
    >
      {title || eyebrow || description || action ? (
        <div className="flex flex-col gap-3 border-b border-black/10 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            {eyebrow ? (
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-400">
                {eyebrow}
              </p>
            ) : null}
            {title ? (
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-black">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-1 text-sm leading-6 text-zinc-500">
                {description}
              </p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function InsightPanel({
  badge,
  children,
  eyebrow = "Insight AI",
  title,
}: {
  badge?: string;
  children: ReactNode;
  eyebrow?: string;
  title: string;
}) {
  return (
    <aside className="rounded-[1.5rem] border border-black/10 bg-black p-5 text-white shadow-[0_22px_70px_rgba(0,0,0,0.18)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-500">
            {eyebrow}
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">{title}</h2>
        </div>
        {badge ? (
          <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-semibold text-black">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="mt-5 text-sm leading-7 text-zinc-300">{children}</div>
    </aside>
  );
}
