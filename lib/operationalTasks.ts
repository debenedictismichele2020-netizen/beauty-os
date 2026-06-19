import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { ensureCurrentUserSalon } from "@/lib/auth";

export type OperationalTaskType =
  | "recovery"
  | "birthday"
  | "campaign"
  | "data_quality";

export type OperationalTaskStatus = "pending" | "completed" | "snoozed";

export type OperationalTask = {
  createdAt: string;
  customerId?: string;
  customerName?: string;
  date: string;
  daysSinceLastVisit?: number | null;
  estimatedValue: number;
  id: string;
  lastVisitDate?: string | null;
  phone?: string;
  priority?: "Alta" | "Media" | "Bassa";
  profileHref?: string;
  reason: string;
  recoveryProbability: number;
  status: OperationalTaskStatus;
  title?: string;
  type: OperationalTaskType;
  updatedAt: string;
};

type OperationalTaskInput = Omit<
  OperationalTask,
  "createdAt" | "updatedAt"
> &
  Partial<Pick<OperationalTask, "createdAt" | "updatedAt">>;

const operationalTasksStorageKey = "beauty_os_operational_tasks";
let hasHydratedOperationalTasksFromSupabase = false;
let isSyncingOperationalTasks = false;

type OperationalTaskRow = {
  completed_at?: string | null;
  created_at?: string | null;
  customer_id?: string | null;
  date?: string | null;
  days_since_last_visit?: number | null;
  estimated_value?: number | string | null;
  id?: string | null;
  last_visit_date?: string | null;
  local_task_id?: string | null;
  phone_snapshot?: string | null;
  priority?: string | null;
  profile_href?: string | null;
  reason?: string | null;
  recovery_probability?: number | string | null;
  status?: string | null;
  title?: string | null;
  type?: string | null;
  updated_at?: string | null;
};

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function normalizeDateKey(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return getTodayDateKey();
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function normalizeStatus(value: unknown): OperationalTaskStatus {
  return value === "completed" || value === "snoozed" || value === "pending"
    ? value
    : "pending";
}

function normalizeType(value: unknown): OperationalTaskType {
  return value === "birthday" ||
    value === "campaign" ||
    value === "data_quality" ||
    value === "recovery"
    ? value
    : "recovery";
}

function normalizeTask(task: OperationalTaskInput): OperationalTask {
  const now = new Date().toISOString();

  return {
    ...task,
    createdAt: task.createdAt ?? now,
    date: normalizeDateKey(task.date),
    estimatedValue: Number.isFinite(Number(task.estimatedValue))
      ? Number(task.estimatedValue)
      : 0,
    reason: task.reason || "Azione consigliata da Beauty OS",
    recoveryProbability: Number.isFinite(Number(task.recoveryProbability))
      ? Math.max(0, Math.min(100, Number(task.recoveryProbability)))
      : 0,
    status: normalizeStatus(task.status),
    type: normalizeType(task.type),
    updatedAt: now,
  };
}

function normalizeTaskRow(row: OperationalTaskRow): OperationalTask | null {
  const taskId = row.local_task_id ?? row.id;

  if (!taskId || !row.date) {
    return null;
  }

  const normalizedTask = normalizeTask({
    createdAt: row.created_at ?? undefined,
    customerId: row.customer_id ?? undefined,
    date: row.date,
    daysSinceLastVisit: row.days_since_last_visit ?? undefined,
    estimatedValue: Number(row.estimated_value ?? 0),
    id: taskId,
    lastVisitDate: row.last_visit_date ?? undefined,
    phone: row.phone_snapshot ?? undefined,
    priority:
      row.priority === "Alta" || row.priority === "Media" || row.priority === "Bassa"
        ? row.priority
        : undefined,
    profileHref: row.profile_href ?? undefined,
    reason: row.reason ?? "Azione consigliata da Beauty OS",
    recoveryProbability: Number(row.recovery_probability ?? 0),
    status: normalizeStatus(row.status),
    title: row.title ?? undefined,
    type: normalizeType(row.type),
    updatedAt: row.updated_at ?? undefined,
  });

  return {
    ...normalizedTask,
    createdAt: row.created_at ?? normalizedTask.createdAt,
    updatedAt: row.updated_at ?? normalizedTask.updatedAt,
  };
}

function toTaskRow(task: OperationalTask, salonId: string) {
  return {
    completed_at: task.status === "completed" ? task.updatedAt : null,
    customer_id: task.customerId ?? null,
    date: normalizeDateKey(task.date),
    days_since_last_visit: task.daysSinceLastVisit ?? null,
    estimated_value: task.estimatedValue,
    last_visit_date: task.lastVisitDate ?? null,
    local_task_id: task.id,
    phone_snapshot: task.phone ?? null,
    priority: task.priority ?? null,
    profile_href: task.profileHref ?? null,
    reason: task.reason,
    recovery_probability: task.recoveryProbability,
    salon_id: salonId,
    snoozed_from_date: task.status === "snoozed" ? task.date : null,
    status: task.status,
    title: task.title ?? null,
    type: task.type,
    updated_at: task.updatedAt,
  };
}

function readOperationalTasksFromLocalStorage(): OperationalTask[] {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const storedValue = window.localStorage.getItem(operationalTasksStorageKey);

    if (!storedValue) {
      return [];
    }

    const parsedValue = JSON.parse(storedValue);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.flatMap((task) => {
      if (
        typeof task?.id !== "string" ||
        typeof task?.date !== "string" ||
        typeof task?.type !== "string"
      ) {
        return [];
      }

      return [normalizeTask(task)];
    });
  } catch {
    return [];
  }
}

function scheduleOperationalTasksHydration() {
  if (
    hasHydratedOperationalTasksFromSupabase ||
    isSyncingOperationalTasks ||
    typeof window === "undefined"
  ) {
    return;
  }

  const supabase = createSupabaseBrowserClient();

  if (!supabase) {
    return;
  }

  hasHydratedOperationalTasksFromSupabase = true;
  isSyncingOperationalTasks = true;

  void (async () => {
    try {
      const localTasks = readOperationalTasksFromLocalStorage();
      const currentSalon = await ensureCurrentUserSalon();

      if (!currentSalon) {
        return;
      }

      const { data, error } = await supabase
        .from("operational_tasks")
        .select("*")
        .eq("salon_id", currentSalon.id)
        .order("date", { ascending: true });

      if (error) {
        console.warn("Fallback localStorage operational_tasks:", error.message);
        return;
      }

      const remoteTasks = (data ?? []).flatMap((row) => {
        const task = normalizeTaskRow(row as OperationalTaskRow);

        return task ? [task] : [];
      });
      const remoteTaskIds = new Set(remoteTasks.map((task) => task.id));
      const missingLocalTasks = localTasks.filter(
        (task) => !remoteTaskIds.has(task.id),
      );
      const mergedTasks = [...remoteTasks, ...missingLocalTasks];

      saveOperationalTasks(mergedTasks, { syncRemote: false });

      if (missingLocalTasks.length > 0) {
        await upsertOperationalTasksToSupabase(missingLocalTasks);
      }
    } catch (error) {
      console.warn("Fallback localStorage operational_tasks:", error);
    } finally {
      isSyncingOperationalTasks = false;
    }
  })();
}

async function upsertOperationalTasksToSupabase(tasks: OperationalTask[]) {
  const supabase = createSupabaseBrowserClient();
  const currentSalon = await ensureCurrentUserSalon();

  if (!supabase || !currentSalon || tasks.length === 0) {
    return;
  }

  const { error } = await supabase
    .from("operational_tasks")
    .upsert(tasks.map((task) => toTaskRow(task, currentSalon.id)), {
      onConflict: "salon_id,local_task_id",
    });

  if (error) {
    console.warn("Fallback localStorage operational_tasks:", error.message);
  }
}

export function getTodayDateKey() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function readOperationalTasks(): OperationalTask[] {
  scheduleOperationalTasksHydration();

  return readOperationalTasksFromLocalStorage();
}

export function saveOperationalTasks(
  tasks: OperationalTask[],
  options: { syncRemote?: boolean } = {},
) {
  if (!canUseStorage()) {
    return;
  }

  const normalizedTasks = tasks.map((task) => normalizeTask(task));

  window.localStorage.setItem(
    operationalTasksStorageKey,
    JSON.stringify(normalizedTasks),
  );
  window.dispatchEvent(new Event("beauty-os-operational-tasks-updated"));

  if (options.syncRemote !== false) {
    void upsertOperationalTasksToSupabase(normalizedTasks);
  }
}

export function upsertOperationalTask(task: OperationalTaskInput) {
  const currentTasks = readOperationalTasks();
  const existingTask = currentTasks.find((currentTask) => currentTask.id === task.id);
  const nextTask = normalizeTask({
    ...existingTask,
    ...task,
    createdAt: existingTask?.createdAt ?? task.createdAt,
  });
  const nextTasks = existingTask
    ? currentTasks.map((currentTask) =>
        currentTask.id === nextTask.id ? nextTask : currentTask,
      )
    : [...currentTasks, nextTask];

  saveOperationalTasks(nextTasks);

  return nextTask;
}

export function completeOperationalTask(taskId: string) {
  const currentTasks = readOperationalTasks();
  const now = new Date().toISOString();
  const nextTasks = currentTasks.map((task) =>
    task.id === taskId
      ? { ...task, status: "completed" as const, updatedAt: now }
      : task,
  );

  saveOperationalTasks(nextTasks);

  return nextTasks.find((task) => task.id === taskId) ?? null;
}

export function snoozeOperationalTask(taskId: string, nextDate: string) {
  const currentTasks = readOperationalTasks();
  const now = new Date().toISOString();
  const nextTasks = currentTasks.map((task) =>
    task.id === taskId
      ? { ...task, date: nextDate, status: "snoozed" as const, updatedAt: now }
      : task,
  );

  saveOperationalTasks(nextTasks);

  return nextTasks.find((task) => task.id === taskId) ?? null;
}

export function getTasksByDate(date: string) {
  return readOperationalTasks().filter(
    (task) => task.date === date && task.status !== "completed",
  );
}

export function isTaskCompletedToday(
  customerId: string | undefined,
  type: OperationalTaskType,
) {
  if (!customerId) {
    return false;
  }

  const today = getTodayDateKey();

  return readOperationalTasks().some(
    (task) =>
      task.customerId === customerId &&
      task.type === type &&
      task.date === today &&
      task.status === "completed",
  );
}
