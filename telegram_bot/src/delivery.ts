/**
 * Единая логика доставки результата генерации:
 * вызывается из (а) HTTP callback от kie.ai, (б) cron-поллера, (в) кнопки "🔄 Проверить".
 */

import {
  type RecordInfoData,
  extractMediaUrl,
  getRecordInfo,
  isTerminalState,
  KieError,
} from "./kie";
import {
  deleteTask,
  getTask,
  type TaskRecord,
} from "./session";

const TG_CAPTION_LIMIT = 1024;
const TG_TEXT_LIMIT = 4096;

export type DeliveryStatus = "delivered" | "still-running" | "failed" | "missing";

export interface DeliveryEnv {
  TELEGRAM_BOT_TOKEN: string;
  KIE_API_KEY: string;
  TASKS: KVNamespace;
}

export interface DeliveryResult {
  status: DeliveryStatus;
  state?: string;
  error?: string;
}

/**
 * Пытается выдать результат задачи в Telegram.
 * @param extraPayload — необязательный payload от kie.ai callback (может содержать готовый URL).
 */
export async function tryDeliverTask(
  taskId: string,
  env: DeliveryEnv,
  extraPayload?: unknown,
): Promise<DeliveryResult> {
  const record = await getTask(env.TASKS, taskId);
  if (!record) return { status: "missing" };

  let info: RecordInfoData | undefined;
  try {
    info = await getRecordInfo(taskId, env.KIE_API_KEY);
  } catch (e) {
    const msg = e instanceof KieError ? e.message : String(e);
    console.error(`recordInfo failed for ${taskId}:`, msg);
    // Если callback пришёл, попробуем его payload — recordInfo может ещё не подтянуть.
    if (!extraPayload) return { status: "still-running", error: msg };
  }

  const state = info?.state;
  if (state && !isTerminalState(state)) {
    return { status: "still-running", state };
  }

  if (state === "fail") {
    const reason = info?.failMsg || `code ${info?.failCode ?? "?"}`;
    await sendText(
      env.TELEGRAM_BOT_TOKEN,
      record.chatId,
      `❌ Задача провалилась.\nID: ${taskId}\nПричина: ${reason}`,
    );
    await deleteTask(env.TASKS, taskId);
    return { status: "failed", state, error: reason };
  }

  // Состояние "success" (или мы получили callback без state, но с payload).
  const sources = collectSources(info, extraPayload);
  let mediaUrl: string | null = null;
  for (const src of sources) {
    mediaUrl = extractMediaUrl(src);
    if (mediaUrl) break;
  }

  if (!mediaUrl) {
    if (state === "success") {
      await sendText(
        env.TELEGRAM_BOT_TOKEN,
        record.chatId,
        `⚠️ Задача завершена, но URL медиа не нашёлся в ответе kie.ai.\nID: ${taskId}`,
      );
      await deleteTask(env.TASKS, taskId);
      return { status: "failed", state, error: "no media url in response" };
    }
    // ещё не дозрело
    return { status: "still-running", state };
  }

  // Повторная проверка перед отправкой — защита от двойной доставки
  // (callback + cron могут сработать почти одновременно).
  const stillThere = await getTask(env.TASKS, taskId);
  if (!stillThere) return { status: "missing" };

  const caption = buildCaption(record);
  try {
    if (record.type === "video") {
      await sendVideo(env.TELEGRAM_BOT_TOKEN, record.chatId, mediaUrl, caption);
    } else {
      await sendPhoto(env.TELEGRAM_BOT_TOKEN, record.chatId, mediaUrl, caption);
    }
  } catch (e) {
    console.error(`telegram send failed for ${taskId}:`, e);
    await sendText(
      env.TELEGRAM_BOT_TOKEN,
      record.chatId,
      truncate(`✅ Готово, но не удалось вложить в чат напрямую.\nСсылка: ${mediaUrl}\n\n${caption}`, TG_TEXT_LIMIT),
    );
  }

  await deleteTask(env.TASKS, taskId);
  return { status: "delivered", state: "success" };
}

function collectSources(info: RecordInfoData | undefined, extraPayload: unknown): unknown[] {
  const sources: unknown[] = [];
  if (info?.resultJson) {
    try { sources.push(JSON.parse(info.resultJson)); } catch { /* ignore */ }
  }
  if (info) sources.push(info);
  if (extraPayload) sources.push(extraPayload);
  return sources;
}

function buildCaption(record: TaskRecord): string {
  const head = `✅ ${record.model} / ${record.version}\n📝 `;
  const room = TG_CAPTION_LIMIT - head.length;
  return head + truncate(record.prompt, room);
}

function truncate(s: string, n: number): string {
  if (n <= 0) return "";
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

// === Telegram HTTP helpers (без grammY, чтобы можно было слать из cron) ===

async function tgPost(token: string, method: string, body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`telegram ${method} ${res.status}: ${text}`);
  }
  return res.json();
}

export function sendText(token: string, chatId: number, text: string): Promise<unknown> {
  return tgPost(token, "sendMessage", { chat_id: chatId, text });
}

export function sendPhoto(token: string, chatId: number, photo: string, caption: string): Promise<unknown> {
  return tgPost(token, "sendPhoto", { chat_id: chatId, photo, caption });
}

export function sendVideo(token: string, chatId: number, video: string, caption: string): Promise<unknown> {
  return tgPost(token, "sendVideo", { chat_id: chatId, video, caption });
}
