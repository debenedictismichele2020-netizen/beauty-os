"use client";

import Link from "next/link";
import {
  BarChart3,
  BookOpen,
  CalendarCheck,
  Check,
  LayoutDashboard,
  Megaphone,
  PanelLeft,
  Settings,
  Sparkles,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import SidebarAccountPanel from "./SidebarAccountPanel";

const navigation: Array<{ href: string; icon: LucideIcon; label: string }> = [
  { href: "/", icon: LayoutDashboard, label: "Panoramica" },
  { href: "/agenda-ai", icon: CalendarCheck, label: "Agenda AI" },
  { href: "/clients", icon: Users, label: "Clienti" },
  { href: "/campagne", icon: Megaphone, label: "Campagne" },
  { href: "/catalogo", icon: BookOpen, label: "Catalogo" },
  { href: "/fatturato", icon: BarChart3, label: "Fatturato" },
  { href: "/opportunita-ai", icon: Target, label: "Opportunità AI" },
  { href: "/impostazioni-ai", icon: Sparkles, label: "Impostazioni AI" },
  { href: "/impostazioni", icon: Settings, label: "Impostazioni" },
];

const systemStatus = [
  "CRM aggiornato",
  "AI attiva",
  "WhatsApp collegato",
  "Database sincronizzato",
];

type CollapsibleSidebarShellProps = {
  active: string;
  children: ReactNode;
};

export function CollapsibleSidebarShell({
  active,
  children,
}: CollapsibleSidebarShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-zinc-950">
      <aside
        className={`fixed inset-x-0 top-0 z-40 flex flex-col border-b border-black/10 bg-white/95 px-5 py-4 shadow-[0_18px_60px_rgba(0,0,0,0.06)] backdrop-blur transition-[width,padding] duration-300 ease-in-out lg:inset-y-0 lg:left-0 lg:right-auto lg:h-screen lg:border-b-0 lg:border-r lg:py-7 ${
          sidebarCollapsed
            ? "lg:w-20 lg:px-3"
            : "lg:w-[280px] lg:px-6"
        }`}
      >
        <div
          className={`flex items-center gap-3 ${
            sidebarCollapsed
              ? "lg:flex-col lg:justify-start"
              : "justify-between"
          }`}
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-black text-sm font-semibold text-white shadow-sm">
              BO
            </div>
            <div
              className={`min-w-0 overflow-hidden transition-all duration-300 ease-in-out ${
                sidebarCollapsed
                  ? "lg:w-0 lg:opacity-0"
                  : "w-auto opacity-100"
              }`}
            >
              <p className="whitespace-nowrap text-sm font-semibold tracking-tight">
                Beauty OS
              </p>
              <p className="whitespace-nowrap text-xs text-zinc-500">
                CRM beauty con AI
              </p>
            </div>
          </div>

          <button
            aria-label={sidebarCollapsed ? "Apri menu" : "Chiudi menu"}
            className="grid size-9 shrink-0 place-items-center rounded-full border border-black/10 bg-white text-sm font-semibold text-zinc-700 shadow-sm transition hover:border-black/20 hover:bg-zinc-50"
            onClick={() => setSidebarCollapsed((current) => !current)}
            type="button"
          >
            <PanelLeft aria-hidden="true" size={18} strokeWidth={2} />
          </button>
        </div>

        <nav
          className={`mt-6 flex gap-2 overflow-x-auto pb-1 transition-all duration-300 ease-in-out lg:mt-10 lg:flex-col lg:overflow-visible lg:pb-0 ${
            sidebarCollapsed ? "lg:items-center" : ""
          }`}
        >
          {navigation.map((item) => {
            const isActive = item.label === active;
            const Icon = item.icon;

            return (
              <Link
                aria-label={item.label}
                className={`group relative flex h-11 shrink-0 items-center rounded-full text-sm font-medium transition ${
                  sidebarCollapsed
                    ? "w-11 justify-center px-0"
                    : "justify-start gap-3 px-4"
                } ${
                  isActive
                    ? "bg-black text-white shadow-sm"
                    : "text-[#6b7280] hover:bg-[#f5f5f5] hover:text-[#111111]"
                }`}
                href={item.href}
                key={item.label}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <span className="grid size-5 shrink-0 place-items-center">
                  <Icon
                    aria-hidden="true"
                    size={18}
                    strokeWidth={2}
                  />
                </span>
                <span
                  className={`whitespace-nowrap transition-all duration-300 ease-in-out ${
                    sidebarCollapsed
                      ? "lg:w-0 lg:overflow-hidden lg:opacity-0"
                      : "opacity-100"
                  }`}
                >
                  {item.label}
                </span>
                {sidebarCollapsed ? (
                  <span className="pointer-events-none absolute left-[calc(100%+12px)] top-1/2 z-50 hidden -translate-y-1/2 whitespace-nowrap rounded-lg border border-black/10 bg-black px-3 py-2 text-xs font-semibold text-white opacity-0 shadow-[0_18px_50px_rgba(0,0,0,0.2)] transition duration-200 group-hover:opacity-100 lg:block">
                    {item.label}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="mt-4 lg:hidden">
          <SidebarAccountPanel />
        </div>

        <div
          className="mt-auto hidden space-y-4 pt-6 transition-all duration-300 ease-in-out lg:block"
        >
          <div
            className={`overflow-hidden rounded-[1.25rem] border border-black/10 bg-[#fafafa] shadow-[0_18px_60px_rgba(0,0,0,0.06)] transition-all duration-300 ${
              sidebarCollapsed
                ? "pointer-events-none h-0 border-transparent p-0 opacity-0"
                : "h-auto p-4 opacity-100"
            }`}
          >
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-400">
              Stato sistema
            </p>
            <div className="mt-4 space-y-2 text-sm leading-6 text-zinc-700">
              {systemStatus.map((item) => (
                <p className="flex items-center gap-2" key={item}>
                  <Check
                    aria-hidden="true"
                    className="shrink-0 text-zinc-700"
                    size={14}
                    strokeWidth={2}
                  />
                  <span>{item}</span>
                </p>
              ))}
            </div>
          </div>

          <SidebarAccountPanel />
        </div>
      </aside>

      <section
        className={`min-w-0 px-5 pb-5 pt-56 transition-[margin,padding] duration-300 ease-in-out sm:px-8 lg:px-10 lg:py-8 ${
          sidebarCollapsed ? "lg:ml-20" : "lg:ml-[280px]"
        }`}
      >
        <div className="mx-auto w-full max-w-[1200px]">{children}</div>
      </section>
    </main>
  );
}
