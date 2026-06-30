"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  buildFinalWhatsAppMessage,
  buildWhatsAppUrl,
  isMobileDevice,
} from "@/lib/whatsapp";
import {
  completeOperationalTaskForSalon,
  type OperationalTask,
  readOperationalTasksForSalon,
  snoozeOperationalTaskForSalon,
  upsertOperationalTaskForSalon,
} from "@/lib/operationalTasks";

export type AgendaTask = {
  campaignHref?: string;
  category:
    | "Recupero"
    | "Monitorare"
    | "Fidelizzazione"
    | "Campagna"
    | "Qualità dati"
    | "Compleanno";
  customerId?: string;
  customerName?: string;
  description: string;
  id: string;
  phone?: string;
  potentialValue?: string;
  priority: "Alta" | "Media" | "Bassa";
  birthDate?: string;
  birthdayAge?: number;
  daysSinceLastVisit?: number | null;
  estimatedValue?: number;
  lastVisitDate?: string | null;
  operationalTaskId?: string;
  scheduledMonthDay?: string;
  recoveryProbability?: number;
  reason?: string;
  title: string;
  whatsappHref?: string;
};

type ScheduledTask = AgendaTask & {
  dateKey: string;
};

const dayLabels = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const completedTasksStorageKey = "beauty_os_completed_agenda_tasks";
const completedBirthdayTasksStorageKey = "beauty_os_completed_birthday_tasks";

const legendItems = [
  { color: "bg-rose-500", label: "Rosso Recupero urgente" },
  { color: "bg-amber-500", label: "Arancione Monitorare" },
  { color: "bg-emerald-500", label: "Verde Fidelizzazione" },
  { color: "bg-sky-500", label: "Blu Campagna" },
  { color: "bg-zinc-400", label: "Grigio Qualità dati" },
  { color: "bg-violet-500", label: "Viola Compleanno" },
];

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatLongDate(date: Date) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatMonthTitle(date: Date) {
  return new Intl.DateTimeFormat("it-IT", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number | undefined) {
  return new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: 0,
    style: "percent",
  }).format((value ?? 0) / 100);
}

function getPotentialValueNumber(value: string | undefined) {
  if (!value) {
    return 0;
  }

  const normalized = value
    .replace(/[^\d,.]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const amount = Number(normalized);

  return Number.isFinite(amount) ? amount : 0;
}

function getMonthCells(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingEmptyCells = (firstDay.getDay() + 6) % 7;
  const cells: Array<Date | null> = Array.from(
    { length: leadingEmptyCells },
    () => null,
  );

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, month, day));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

function getPriorityRank(priority: AgendaTask["priority"]) {
  if (priority === "Alta") {
    return 0;
  }

  if (priority === "Media") {
    return 1;
  }

  return 2;
}

function getTaskColor(task: Pick<AgendaTask, "category" | "priority">) {
  if (task.category === "Compleanno") {
    return {
      badge: "border-violet-200 bg-violet-50 text-violet-700",
      dot: "bg-violet-500",
    };
  }

  if (task.category === "Campagna") {
    return { badge: "border-sky-200 bg-sky-50 text-sky-700", dot: "bg-sky-500" };
  }

  if (task.category === "Fidelizzazione") {
    return {
      badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
      dot: "bg-emerald-500",
    };
  }

  if (task.category === "Qualità dati") {
    return { badge: "border-zinc-200 bg-zinc-50 text-zinc-700", dot: "bg-zinc-400" };
  }

  if (task.priority === "Alta") {
    return { badge: "border-rose-200 bg-rose-50 text-rose-700", dot: "bg-rose-500" };
  }

  return {
    badge: "border-amber-200 bg-amber-50 text-amber-800",
    dot: "bg-amber-500",
  };
}

function getSchedulingStartDay(monthDate: Date, priority: AgendaTask["priority"]) {
  const today = new Date();
  const isCurrentMonth =
    monthDate.getFullYear() === today.getFullYear() &&
    monthDate.getMonth() === today.getMonth();
  const baseDay = isCurrentMonth ? today.getDate() : 1;

  if (priority === "Alta") {
    return baseDay;
  }

  if (priority === "Media") {
    return baseDay + 3;
  }

  return baseDay + 10;
}

function distributeTasks(tasks: AgendaTask[], monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const scheduledByDate = new Map<string, ScheduledTask[]>();
  const sortedTasks = [...tasks].sort(
    (first, second) =>
      getPriorityRank(first.priority) - getPriorityRank(second.priority),
  );

  function findSlot(preferredStartDay: number) {
    const safeStart = Math.min(Math.max(1, preferredStartDay), daysInMonth);

    for (let day = safeStart; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day);
      const weekDay = date.getDay();

      if (weekDay === 0 || weekDay === 6) {
        continue;
      }

      const key = toDateKey(date);
      const dayTasks = scheduledByDate.get(key) ?? [];

      if (dayTasks.length < 4) {
        return key;
      }
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day);
      const key = toDateKey(date);
      const dayTasks = scheduledByDate.get(key) ?? [];

      if (dayTasks.length < 4) {
        return key;
      }
    }

    return toDateKey(new Date(year, month, daysInMonth));
  }

  sortedTasks.forEach((task, index) => {
    if (task.scheduledMonthDay) {
      const [scheduledMonth, scheduledDay] = task.scheduledMonthDay
        .split("-")
        .map(Number);

      if (scheduledMonth === month + 1) {
        const safeDay = Math.min(Math.max(1, scheduledDay), daysInMonth);
        const dateKey = toDateKey(new Date(year, month, safeDay));
        const dayTasks = scheduledByDate.get(dateKey) ?? [];
        const birthdayAge = task.birthDate
          ? getBirthdayAge(task.birthDate, year)
          : task.birthdayAge;

        scheduledByDate.set(dateKey, [
          ...dayTasks,
          { ...task, birthdayAge, dateKey },
        ]);
      }

      return;
    }

    const offset =
      task.priority === "Alta" ? index : task.priority === "Media" ? index * 2 : index * 3;
    const dateKey = findSlot(
      getSchedulingStartDay(monthDate, task.priority) + offset,
    );
    const dayTasks = scheduledByDate.get(dateKey) ?? [];

    scheduledByDate.set(dateKey, [...dayTasks, { ...task, dateKey }]);
  });

  return scheduledByDate;
}

function getBirthdayAge(birthDate: string, year: number) {
  const parsedBirthDate = new Date(`${birthDate}T00:00:00`);

  if (Number.isNaN(parsedBirthDate.getTime())) {
    return undefined;
  }

  const age = year - parsedBirthDate.getFullYear();

  return age >= 0 ? age : undefined;
}

function getStableTaskId(task: ScheduledTask) {
  const owner = task.customerId ?? task.title;

  return `${owner}::${task.category}::${task.dateKey}`;
}

function getOperationalType(task: Pick<AgendaTask, "category">) {
  if (task.category === "Compleanno") {
    return "birthday" as const;
  }

  if (task.category === "Campagna") {
    return "campaign" as const;
  }

  if (task.category === "Qualità dati") {
    return "data_quality" as const;
  }

  return "recovery" as const;
}

function getOperationalTaskId(task: ScheduledTask) {
  if (task.operationalTaskId) {
    return task.operationalTaskId;
  }

  const owner = task.customerId ?? task.id;

  return `${getOperationalType(task)}:${owner}:${task.dateKey}`;
}

function getNextDateKey(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`);

  date.setDate(date.getDate() + 1);

  return toDateKey(date);
}

function operationalTaskToAgendaTask(task: OperationalTask): ScheduledTask {
  const category =
    task.type === "birthday"
      ? "Compleanno"
      : task.type === "campaign"
        ? "Campagna"
        : task.type === "data_quality"
          ? "Qualità dati"
          : "Recupero";

  return {
    category,
    customerId: task.customerId,
    customerName: task.customerName,
    dateKey: task.date,
    daysSinceLastVisit: task.daysSinceLastVisit,
    description: task.reason,
    estimatedValue: task.estimatedValue,
    id: task.id,
    lastVisitDate: task.lastVisitDate,
    operationalTaskId: task.id,
    phone: task.phone,
    potentialValue: task.estimatedValue
      ? formatCurrency(task.estimatedValue)
      : undefined,
    priority: task.priority ?? "Media",
    reason: task.reason,
    recoveryProbability: task.recoveryProbability,
    title: task.title ?? (task.customerName ? `Contatta ${task.customerName}` : "Azione operativa"),
    whatsappHref: task.phone ? buildWhatsAppUrl({ phone: task.phone, message: "", target: "web" }) : "",
  };
}

function readCompletedTasks() {
  try {
    const storedValue = window.localStorage.getItem(completedTasksStorageKey);

    if (!storedValue) {
      return new Set<string>();
    }

    const parsedValue = JSON.parse(storedValue);

    if (!Array.isArray(parsedValue)) {
      return new Set<string>();
    }

    return new Set(
      parsedValue.filter((taskId): taskId is string => typeof taskId === "string"),
    );
  } catch {
    return new Set<string>();
  }
}

function readCompletedBirthdayTasks() {
  try {
    const storedValue = window.localStorage.getItem(
      completedBirthdayTasksStorageKey,
    );

    if (!storedValue) {
      return new Set<string>();
    }

    const parsedValue = JSON.parse(storedValue);

    if (!Array.isArray(parsedValue)) {
      return new Set<string>();
    }

    return new Set(
      parsedValue.filter((taskId): taskId is string => typeof taskId === "string"),
    );
  } catch {
    return new Set<string>();
  }
}

function saveCompletedTasks(taskIds: Set<string>) {
  window.localStorage.setItem(
    completedTasksStorageKey,
    JSON.stringify([...taskIds]),
  );
}

function saveCompletedBirthdayTasks(taskIds: Set<string>) {
  window.localStorage.setItem(
    completedBirthdayTasksStorageKey,
    JSON.stringify([...taskIds]),
  );
}

function getSuggestedWhatsappMessage(task: ScheduledTask) {
  if (task.category === "Compleanno") {
    const name = task.customerName ?? "";

    return `Ciao ${name}, tanti auguri! Ti auguriamo una splendida giornata. Per festeggiare, abbiamo pensato a una piccola coccola beauty per te nei prossimi giorni.`;
  }

  const greeting = task.customerName ? `Ciao ${task.customerName},` : "Ciao,";

  if (task.category === "Recupero") {
    return `${greeting} ti scrivo perché mi farebbe piacere aiutarti a riprendere il tuo percorso beauty con una proposta semplice e su misura.`;
  }

  if (task.category === "Fidelizzazione") {
    return `${greeting} ho pensato a te per un controllo o un trattamento dedicato, così manteniamo il risultato nel momento giusto.`;
  }

  if (task.category === "Monitorare") {
    return `${greeting} passo solo per capire come stai e se vuoi fissare il prossimo appuntamento quando ti è comodo.`;
  }

  return `${greeting} ti scrivo per proporti il prossimo passo più utile in base al tuo percorso con noi.`;
}

function getWhatsappUrl(
  task: ScheduledTask,
  message: string,
  target: "web" | "mobile" = "web",
) {
  if (!task.whatsappHref && !task.phone) {
    return "";
  }

  const [baseUrl] = (task.whatsappHref ?? "").split("?");
  const finalMessage = buildFinalWhatsAppMessage(message, task.category);
  const phone = task.phone || baseUrl.replace("https://wa.me/", "");

  return buildWhatsAppUrl({ phone, message: finalMessage, target });
}

function DrawerTaskCard({
  copied,
  completing = false,
  onComplete,
  onCopy,
  onSnooze,
  task,
}: {
  copied?: boolean;
  completing?: boolean;
  onComplete?: () => void;
  onCopy?: () => void;
  onSnooze?: () => void;
  task: ScheduledTask;
}) {
  const taskColor = getTaskColor(task);
  const suggestedMessage = getSuggestedWhatsappMessage(task);
  const whatsappUrl = getWhatsappUrl(task, suggestedMessage);

  return (
    <article
      className={`relative overflow-hidden rounded-[1.1rem] border p-4 transition ${
        completing
          ? "border-emerald-200 bg-emerald-50"
          : "border-black/10 bg-[#f7f7f5]"
      }`}
    >
      {completing ? (
        <div className="absolute right-4 top-4 grid size-8 place-items-center rounded-full bg-emerald-600 text-white shadow-sm">
          <span className="text-base font-semibold">✓</span>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${taskColor.badge}`}
        >
          {task.category}
        </span>
        <span className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-600">
          {task.priority}
        </span>
      </div>
      <h3 className="mt-3 pr-10 text-sm font-semibold text-black">
        {task.title}
      </h3>
      {task.customerName ? (
        <p className="mt-1 text-sm text-zinc-500">
          Cliente: {task.customerName}
        </p>
      ) : null}
      {task.phone ? (
        <p className="mt-1 text-sm text-zinc-500">
          Telefono: {task.phone}
        </p>
      ) : null}
      {task.potentialValue ? (
        <p className="mt-2 text-sm font-semibold text-black">
          Recupero stimato: {task.potentialValue}
        </p>
      ) : null}
      {task.recoveryProbability !== undefined ? (
        <p className="mt-1 text-sm text-zinc-500">
          Possibilità recupero: {formatPercent(task.recoveryProbability)}
        </p>
      ) : null}
      {task.lastVisitDate ? (
        <p className="mt-1 text-sm text-zinc-500">
          Ultima visita:{" "}
          {new Intl.DateTimeFormat("it-IT", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }).format(new Date(`${task.lastVisitDate}T00:00:00`))}
        </p>
      ) : task.daysSinceLastVisit !== undefined &&
        task.daysSinceLastVisit !== null ? (
        <p className="mt-1 text-sm text-zinc-500">
          Assente da {task.daysSinceLastVisit} giorni
        </p>
      ) : null}
      {task.category === "Compleanno" && task.birthdayAge !== undefined ? (
        <p className="mt-2 text-sm font-semibold text-black">
          Compie {task.birthdayAge} anni
        </p>
      ) : null}
      <p className="mt-2 text-sm leading-6 text-zinc-500">
        {task.description}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {whatsappUrl ? (
          <>
            <button
              className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:border-black/20 hover:bg-zinc-50"
              onClick={onCopy}
              type="button"
            >
              {copied ? "Copiato" : "Copia"}
            </button>
            <a
              className="rounded-full bg-black px-3 py-2 text-xs font-semibold text-white transition hover:bg-zinc-800"
              href={whatsappUrl}
              onClick={(event) => {
                event.preventDefault();

                const targetUrl = getWhatsappUrl(
                  task,
                  suggestedMessage,
                  isMobileDevice() ? "mobile" : "web",
                );
                const openedWindow = window.open(
                  targetUrl,
                  "_blank",
                  "noopener,noreferrer",
                );

                if (!openedWindow) {
                  onCopy?.();
                }
              }}
              rel="noreferrer"
              target="_blank"
            >
              Invia WhatsApp
            </a>
          </>
        ) : task.category === "Compleanno" ? (
          <button
            className="cursor-not-allowed rounded-full bg-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-500"
            disabled
            type="button"
          >
            Invia WhatsApp
          </button>
        ) : null}
        {task.customerId ? (
          <Link
            className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-black transition hover:border-black/20 hover:bg-zinc-50"
            href={`/clients/${task.customerId}`}
          >
            Apri cliente
          </Link>
        ) : null}
        {task.campaignHref ? (
          <Link
            className="rounded-full bg-black px-3 py-2 text-xs font-semibold text-white transition hover:bg-zinc-800"
            href={task.campaignHref}
          >
            Apri campagna
          </Link>
        ) : null}
        <button
          className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
          onClick={onComplete}
          type="button"
        >
          Segna completato
        </button>
        <button
          className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:border-black/20 hover:bg-zinc-50"
          onClick={onSnooze}
          type="button"
        >
          Rimanda
        </button>
      </div>
    </article>
  );
}

export function AgendaCalendar({
  salonId,
  tasks,
}: {
  salonId: string;
  tasks: AgendaTask[];
}) {
  const today = useMemo(() => new Date(), []);
  const todayKey = toDateKey(today);
  const [visibleMonth, setVisibleMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);
  const [completedTaskIds, setCompletedTaskIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [copiedTaskId, setCopiedTaskId] = useState("");
  const [operationalTasks, setOperationalTasks] = useState<OperationalTask[]>([]);
  const [recentlyCompletedTaskIds, setRecentlyCompletedTaskIds] = useState<
    Set<string>
  >(() => new Set());

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        const nextOperationalTasks = await readOperationalTasksForSalon(salonId);

        setCompletedTaskIds(
          new Set([...readCompletedTasks(), ...readCompletedBirthdayTasks()]),
        );
        setOperationalTasks(nextOperationalTasks);
      })();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [salonId]);

  const monthCells = useMemo(() => getMonthCells(visibleMonth), [visibleMonth]);
  const distributedByDate = useMemo(
    () => distributeTasks(tasks, visibleMonth),
    [tasks, visibleMonth],
  );
  const scheduledByDate = useMemo(() => {
    const nextScheduledByDate = new Map<string, ScheduledTask[]>();
    const operationalTasksById = new Map(
      operationalTasks.map((task) => [task.id, task]),
    );

    distributedByDate.forEach((dayTasks, dateKey) => {
      const filteredTasks = dayTasks.filter((task) => {
        const operationalTask = operationalTasksById.get(getOperationalTaskId(task));

        return !operationalTask;
      });

      if (filteredTasks.length > 0) {
        nextScheduledByDate.set(dateKey, filteredTasks);
      }
    });

    operationalTasks
      .filter((task) => task.status !== "completed")
      .map(operationalTaskToAgendaTask)
      .forEach((task) => {
        const taskDate = new Date(`${task.dateKey}T00:00:00`);

        if (
          taskDate.getFullYear() !== visibleMonth.getFullYear() ||
          taskDate.getMonth() !== visibleMonth.getMonth()
        ) {
          return;
        }

        const dayTasks = nextScheduledByDate.get(task.dateKey) ?? [];

        nextScheduledByDate.set(task.dateKey, [...dayTasks, task]);
      });

    return nextScheduledByDate;
  }, [distributedByDate, operationalTasks, visibleMonth]);
  const pendingByDate = useMemo(() => {
    const nextPendingByDate = new Map<string, ScheduledTask[]>();

    scheduledByDate.forEach((dayTasks, dateKey) => {
      const pendingTasks = dayTasks.filter(
        (task) => !completedTaskIds.has(getStableTaskId(task)),
      );

      if (pendingTasks.length > 0) {
        nextPendingByDate.set(dateKey, pendingTasks);
      }
    });

    return nextPendingByDate;
  }, [completedTaskIds, scheduledByDate]);
  const selectedDate = new Date(`${selectedDateKey}T00:00:00`);
  const selectedScheduledTasks = scheduledByDate.get(selectedDateKey) ?? [];
  const selectedTasks = [...(pendingByDate.get(selectedDateKey) ?? [])].sort(
    (first, second) =>
      getPriorityRank(first.priority) - getPriorityRank(second.priority),
  );
  const recentlyCompletedSelectedTasks = selectedScheduledTasks.filter((task) =>
    recentlyCompletedTaskIds.has(getStableTaskId(task)),
  );
  const drawerTasks = [...selectedTasks, ...recentlyCompletedSelectedTasks];
  const selectedPotentialValue = selectedTasks.reduce(
    (total, task) => total + getPotentialValueNumber(task.potentialValue),
    0,
  );
  const todayTasks = [...(pendingByDate.get(todayKey) ?? [])].sort(
    (first, second) =>
      getPriorityRank(first.priority) - getPriorityRank(second.priority),
  );
  const topTodayTask = todayTasks[0] ?? null;
  const todayRecoveryValue = todayTasks.reduce(
    (total, task) => total + getPotentialValueNumber(task.potentialValue),
    0,
  );
  const todayBirthdays = todayTasks.filter(
    (task) => task.category === "Compleanno",
  ).length;
  const todayCampaigns = todayTasks.filter(
    (task) => task.category === "Campagna",
  ).length;
  const selectedCompletedCount = Math.max(
    0,
    selectedScheduledTasks.length - selectedTasks.length,
  );
  const selectedProgress =
    selectedScheduledTasks.length > 0
      ? (selectedCompletedCount / selectedScheduledTasks.length) * 100
      : 0;
  const selectedDayCompleted =
    selectedScheduledTasks.length > 0 && selectedTasks.length === 0;

  useEffect(() => {
    if (!drawerOpen || !selectedDayCompleted) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setDrawerOpen(false);
    }, 1500);

    return () => window.clearTimeout(timeoutId);
  }, [drawerOpen, selectedDayCompleted]);

  function moveMonth(offset: number) {
    const nextMonth = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth() + offset,
      1,
    );

    setVisibleMonth(nextMonth);
    setSelectedDateKey(toDateKey(nextMonth));
  }

  function openDay(dateKey: string) {
    setSelectedDateKey(dateKey);
    setDrawerOpen(true);
  }

  async function completeTask(task: ScheduledTask) {
    const taskId = getStableTaskId(task);
    const operationalTaskId = getOperationalTaskId(task);

    setRecentlyCompletedTaskIds((currentTaskIds) => {
      const nextTaskIds = new Set(currentTaskIds);

      nextTaskIds.add(taskId);

      return nextTaskIds;
    });

    setCompletedTaskIds((currentTaskIds) => {
      const nextTaskIds = new Set(currentTaskIds);

      nextTaskIds.add(taskId);

      return nextTaskIds;
    });

    await upsertOperationalTaskForSalon({
      customerId: task.customerId,
      customerName: task.customerName,
      date: task.dateKey,
      estimatedValue:
        task.estimatedValue ?? getPotentialValueNumber(task.potentialValue),
      id: operationalTaskId,
      lastVisitDate: task.lastVisitDate,
      phone: task.phone,
      priority: task.priority,
      profileHref: task.customerId ? `/clients/${task.customerId}` : undefined,
      reason: task.reason ?? task.description,
      recoveryProbability: task.recoveryProbability ?? 0,
      status: "completed",
      title: task.title,
      type: getOperationalType(task),
    }, salonId);
    await completeOperationalTaskForSalon(operationalTaskId, salonId);
    setOperationalTasks(await readOperationalTasksForSalon(salonId));

    window.setTimeout(() => {
      setRecentlyCompletedTaskIds((currentTaskIds) => {
        const nextTaskIds = new Set(currentTaskIds);

        nextTaskIds.delete(taskId);

        return nextTaskIds;
      });
    }, 650);
  }

  async function snoozeTask(task: ScheduledTask) {
    const operationalTaskId = getOperationalTaskId(task);
    const nextDate = getNextDateKey(task.dateKey);

    await upsertOperationalTaskForSalon({
      customerId: task.customerId,
      customerName: task.customerName,
      date: task.dateKey,
      estimatedValue:
        task.estimatedValue ?? getPotentialValueNumber(task.potentialValue),
      id: operationalTaskId,
      lastVisitDate: task.lastVisitDate,
      phone: task.phone,
      priority: task.priority,
      profileHref: task.customerId ? `/clients/${task.customerId}` : undefined,
      reason: task.reason ?? task.description,
      recoveryProbability: task.recoveryProbability ?? 0,
      status: "pending",
      title: task.title,
      type: getOperationalType(task),
    }, salonId);
    await snoozeOperationalTaskForSalon(operationalTaskId, nextDate, salonId);
    setOperationalTasks(await readOperationalTasksForSalon(salonId));
  }

  function copySuggestedMessage(task: ScheduledTask) {
    const taskId = getStableTaskId(task);
    const safeMessage = buildFinalWhatsAppMessage(
      getSuggestedWhatsappMessage(task),
      task.category,
    );

    void navigator.clipboard.writeText(safeMessage);
    setCopiedTaskId(taskId);

    window.setTimeout(() => {
      setCopiedTaskId((currentTaskId) =>
        currentTaskId === taskId ? "" : currentTaskId,
      );
    }, 1400);
  }

  return (
    <>
      <section className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Attività oggi", value: todayTasks.length },
            { label: "Recupero stimato", value: formatCurrency(todayRecoveryValue) },
            { label: "Compleanni", value: todayBirthdays },
            { label: "Campagne", value: todayCampaigns },
          ].map((item) => (
            <article
              className="rounded-[1.1rem] border border-black/10 bg-white px-4 py-3 shadow-[0_12px_38px_rgba(0,0,0,0.05)]"
              key={item.label}
            >
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-400">
                {item.label}
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-black">
                {item.value}
              </p>
            </article>
          ))}
        </div>

        <article className="rounded-[1.5rem] border border-black/10 bg-black p-5 text-white shadow-[0_24px_80px_rgba(0,0,0,0.16)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-white/45">
                Priorità del giorno
              </p>
              {topTodayTask ? (
                <>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                    {topTodayTask.customerName ?? topTodayTask.title}
                  </h2>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-white/70">
                    <span>{topTodayTask.category}</span>
                    <span>·</span>
                    <span>
                      {topTodayTask.potentialValue ?? "Valore non disponibile"}
                    </span>
                    {topTodayTask.recoveryProbability !== undefined ? (
                      <>
                        <span>·</span>
                        <span>
                          {formatPercent(topTodayTask.recoveryProbability)}
                        </span>
                      </>
                    ) : null}
                  </div>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">
                    {topTodayTask.reason ?? topTodayTask.description}
                  </p>
                </>
              ) : (
                <>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                    Nessuna priorità urgente oggi
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">
                    Beauty OS continuerà a monitorare clienti, compleanni e
                    campagne.
                  </p>
                </>
              )}
            </div>
            {topTodayTask ? (
              <div className="flex flex-wrap gap-2 lg:justify-end">
                {topTodayTask.phone ? (
                  <button
                    className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:-translate-y-0.5 hover:bg-zinc-100"
                    onClick={() => {
                      const targetUrl = getWhatsappUrl(
                        topTodayTask,
                        getSuggestedWhatsappMessage(topTodayTask),
                        isMobileDevice() ? "mobile" : "web",
                      );

                      window.open(targetUrl, "_blank", "noopener,noreferrer");
                    }}
                    type="button"
                  >
                    Contatta ora
                  </button>
                ) : null}
                {topTodayTask.customerId ? (
                  <Link
                    className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/10"
                    href={`/clients/${topTodayTask.customerId}`}
                  >
                    Apri cliente
                  </Link>
                ) : null}
                <button
                  className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/10"
                  onClick={() => snoozeTask(topTodayTask)}
                  type="button"
                >
                  Rimanda
                </button>
              </div>
            ) : null}
          </div>
        </article>

        <article className="w-full rounded-[1.75rem] border border-black/10 bg-white p-5 shadow-[0_24px_80px_rgba(0,0,0,0.08)]">
          <div className="flex flex-col gap-4 border-b border-black/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-400">
                Calendario operativo
              </p>
              <h2 className="mt-2 text-2xl font-semibold capitalize tracking-tight text-black">
                {formatMonthTitle(visibleMonth)}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-black transition hover:border-black/20 hover:bg-zinc-50"
                onClick={() => moveMonth(-1)}
                type="button"
              >
                Mese precedente
              </button>
              <button
                className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
                onClick={() => moveMonth(1)}
                type="button"
              >
                Mese successivo
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-7 gap-2">
            {dayLabels.map((day) => (
              <div
                className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400"
                key={day}
              >
                {day}
              </div>
            ))}
            {monthCells.map((date, index) => {
              if (!date) {
                return (
                  <div
                    className="min-h-24 rounded-[1rem] border border-transparent sm:min-h-28 lg:min-h-32"
                    key={`empty-${index}`}
                  />
                );
              }

              const dateKey = toDateKey(date);
              const dayTasks = pendingByDate.get(dateKey) ?? [];
              const allDayTasks = scheduledByDate.get(dateKey) ?? [];
              const isCompletedDay =
                allDayTasks.length > 0 && dayTasks.length === 0;
              const isToday = dateKey === todayKey;
              const isSelected = dateKey === selectedDateKey;
              const hiddenTaskCount = Math.max(0, dayTasks.length - 3);

              return (
                <button
                  className={`relative min-h-24 rounded-[1rem] border p-3 text-left transition hover:border-black/20 hover:bg-white sm:min-h-28 lg:min-h-32 ${
                    isSelected
                      ? "border-black bg-[#f7f7f5]"
                      : "border-black/10 bg-white"
                  }`}
                  key={dateKey}
                  onClick={() => openDay(dateKey)}
                  type="button"
                >
                  <span
                    className={`grid size-8 place-items-center rounded-full text-sm font-semibold ${
                      isToday ? "bg-black text-white" : "text-black"
                    }`}
                  >
                    {date.getDate()}
                  </span>
                  {isCompletedDay ? (
                    <span className="absolute bottom-3 left-3 grid size-6 place-items-center rounded-full bg-emerald-600 text-xs font-semibold text-white">
                      ✓
                    </span>
                  ) : dayTasks.length > 0 ? (
                    <div className="absolute bottom-3 left-3 flex items-center gap-1">
                      {dayTasks.slice(0, 3).map((task) => {
                        const taskColor = getTaskColor(task);

                        return (
                          <span
                            className={`relative flex size-2.5 rounded-full ${taskColor.dot}`}
                            key={`${dateKey}-${task.id}`}
                          >
                            <span
                              className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-30 ${taskColor.dot}`}
                            />
                          </span>
                        );
                      })}
                      {hiddenTaskCount > 0 ? (
                        <span className="ml-1 text-xs font-semibold text-zinc-500">
                          +{hiddenTaskCount}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </article>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[1rem] border border-black/10 bg-white px-4 py-3 text-xs text-zinc-600 shadow-[0_10px_35px_rgba(0,0,0,0.04)]">
          <span className="font-semibold uppercase tracking-[0.16em] text-zinc-400">
            Legenda
          </span>
          {legendItems.map((item) => (
            <span className="flex items-center gap-2" key={item.label}>
              <span className={`size-2 rounded-full ${item.color}`} />
              {item.label}
            </span>
          ))}
        </div>
      </section>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50">
          <button
            aria-label="Chiudi agenda del giorno"
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
            onClick={() => setDrawerOpen(false)}
            type="button"
          />
          <aside className="absolute inset-y-0 right-0 flex w-full flex-col bg-white shadow-[0_30px_100px_rgba(0,0,0,0.28)] sm:w-[480px]">
            <div className="border-b border-black/10 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.22em] text-zinc-400">
                    Agenda del giorno
                  </p>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight text-black">
                    {formatLongDate(selectedDate)}
                  </h2>
                </div>
                <button
                  className="grid size-9 place-items-center rounded-full border border-black/10 bg-white text-lg font-semibold text-black transition hover:border-black/20 hover:bg-zinc-50"
                  onClick={() => setDrawerOpen(false)}
                  type="button"
                >
                  ×
                </button>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-[1rem] border border-black/10 bg-[#f7f7f5] p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-400">
                    Attività totali
                  </p>
                  <p className="mt-2 text-xl font-semibold text-black">
                    {selectedScheduledTasks.length}
                  </p>
                </div>
                <div className="rounded-[1rem] border border-black/10 bg-[#f7f7f5] p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-400">
                    Valore potenziale
                  </p>
                  <p className="mt-2 text-xl font-semibold text-black">
                    {formatCurrency(selectedPotentialValue)}
                  </p>
                </div>
                <div className="col-span-2 rounded-[1rem] border border-black/10 bg-[#f7f7f5] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-400">
                      Completate
                    </p>
                    <p className="text-sm font-semibold text-black">
                      {selectedCompletedCount} / {selectedScheduledTasks.length}
                    </p>
                  </div>
                  <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-zinc-200">
                    <span
                      className="block h-full rounded-full bg-black"
                      style={{ width: `${selectedProgress}%` }}
                    />
                  </span>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {selectedDayCompleted ? (
                <div className="grid h-full place-items-center rounded-[1.25rem] border border-emerald-200 bg-emerald-50 p-6 text-center">
                  <div>
                    <div className="mx-auto grid size-12 place-items-center rounded-full bg-emerald-600 text-xl font-semibold text-white">
                      ✓
                    </div>
                    <h3 className="mt-4 text-xl font-semibold text-black">
                      Giorno completato
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-zinc-500">
                      Tutte le azioni operative sono state chiuse.
                    </p>
                  </div>
                </div>
              ) : drawerTasks.length > 0 ? (
                <div className="grid gap-3">
                  {drawerTasks.map((task) => {
                    const taskId = getStableTaskId(task);

                    return (
                      <DrawerTaskCard
                        completing={recentlyCompletedTaskIds.has(taskId)}
                        copied={copiedTaskId === taskId}
                        key={`${task.id}-${task.dateKey}`}
                        onComplete={() => {
                          void completeTask(task);
                        }}
                        onCopy={() => copySuggestedMessage(task)}
                        onSnooze={() => {
                          void snoozeTask(task);
                        }}
                        task={task}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-[1rem] border border-black/10 bg-[#f7f7f5] p-5">
                  <p className="text-sm font-semibold text-black">
                    Nessuna attività per questo giorno
                  </p>
                  <p className="mt-2 text-sm leading-6 text-zinc-500">
                    Beauty OS continuerà a monitorare clienti, compleanni e
                    campagne.
                  </p>
                </div>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
