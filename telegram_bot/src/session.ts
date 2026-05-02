import type { ModelKey, MediaType } from "./config";

export type Step =
  | "model"
  | "version"
  | "format"
  | "quality"
  | "duration"
  | "prompt";

export interface Session {
  step: Step;
  model?: ModelKey;
  version?: string;
  format?: string;
  quality?: string;
  duration?: number;
}

export interface TaskRecord {
  chatId: number;
  userId: number;
  type: MediaType;
  model: ModelKey;
  version: string;
  prompt: string;
  createdAt: number;
}

export interface PendingTask {
  taskId: string;
  record: TaskRecord;
}

const SESSION_TTL = 60 * 60;       // 1 час на конфигурирование
const TASK_TTL = 60 * 60 * 24;     // 24 часа на ожидание результата
const TASK_PREFIX = "task:";

const sessionKey = (userId: number) => `session:${userId}`;
const taskKey = (taskId: string) => `${TASK_PREFIX}${taskId}`;

export async function getSession(kv: KVNamespace, userId: number): Promise<Session> {
  const raw = await kv.get(sessionKey(userId));
  if (!raw) return { step: "model" };
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return { step: "model" };
  }
}

export async function setSession(kv: KVNamespace, userId: number, session: Session): Promise<void> {
  await kv.put(sessionKey(userId), JSON.stringify(session), { expirationTtl: SESSION_TTL });
}

export async function clearSession(kv: KVNamespace, userId: number): Promise<void> {
  await kv.delete(sessionKey(userId));
}

export async function saveTask(kv: KVNamespace, taskId: string, record: TaskRecord): Promise<void> {
  await kv.put(taskKey(taskId), JSON.stringify(record), { expirationTtl: TASK_TTL });
}

export async function getTask(kv: KVNamespace, taskId: string): Promise<TaskRecord | null> {
  const raw = await kv.get(taskKey(taskId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TaskRecord;
  } catch {
    return null;
  }
}

export async function deleteTask(kv: KVNamespace, taskId: string): Promise<void> {
  await kv.delete(taskKey(taskId));
}

/** Все ещё ожидающие результата задачи (всех пользователей). Для cron-поллинга. */
export async function listAllPendingTasks(kv: KVNamespace): Promise<PendingTask[]> {
  const list = await kv.list({ prefix: TASK_PREFIX });
  const out: PendingTask[] = [];
  for (const key of list.keys) {
    const raw = await kv.get(key.name);
    if (!raw) continue;
    try {
      const record = JSON.parse(raw) as TaskRecord;
      out.push({ taskId: key.name.slice(TASK_PREFIX.length), record });
    } catch { /* пропускаем битые */ }
  }
  return out;
}

/** Активные задачи конкретного пользователя — для команды /status. */
export async function listPendingTasksForUser(
  kv: KVNamespace,
  userId: number,
): Promise<PendingTask[]> {
  const all = await listAllPendingTasks(kv);
  return all.filter((t) => t.record.userId === userId);
}
