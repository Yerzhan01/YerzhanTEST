/**
 * Единая логика доставки результата генерации:
 * вызывается из (а) HTTP callback от kie.ai, (б) cron-поллера, (в) кнопки "🔄 Проверить".
 */

import {
  getStatus,
  isSuccess,
  isTerminalState,
  KieError,
  type NormalizedStatus,
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
 * extraPayload игнорируется — мы всегда переспрашиваем kie.ai (`getStatus`),
 * потому что callback-payload часто без URL результата.
 */
export async function tryDeliverTask(
  taskId: string,
  env: DeliveryEnv,
  _extraPayload?: unknown,
): Promise<DeliveryResult> {
  const record = await getTask(env.TASKS, taskId);
  if (!record) return { status: "missing" };

  let info: NormalizedStatus;
  try {
    info = await getStatus(record.family, taskId, env.KIE_API_KEY);
  } catch (e) {
    const msg = e instanceof KieError ? e.message : String(e);
    console.error(`getStatus failed for ${taskId}:`, msg);
    return { status: "still-running", error: msg };
  }

  if (!isTerminalState(info.state)) {
    return { status: "still-running", state: info.state };
  }

  if (!isSuccess(info.state)) {
    const reason = info.failMsg || "kie.ai вернул state=fail";
    await sendText(
      env.TELEGRAM_BOT_TOKEN,
      record.chatId,
      `❌ Задача провалилась.\nID: ${taskId}\nПричина: ${reason}`,
    );
    await deleteTask(env.TASKS, taskId);
    return { status: "failed", state: info.state, error: reason };
  }

  if (info.resultUrls.length === 0) {
    await sendText(
      env.TELEGRAM_BOT_TOKEN,
      record.chatId,
      `⚠️ Задача завершена, но URL медиа не нашёлся в ответе kie.ai.\nID: ${taskId}`,
    );
    await deleteTask(env.TASKS, taskId);
    return { status: "failed", state: info.state, error: "no media url in response" };
  }

  // Повторная проверка перед отправкой — защита от двойной доставки
  // (callback + cron могут сработать почти одновременно).
  const stillThere = await getTask(env.TASKS, taskId);
  if (!stillThere) return { status: "missing" };

  const caption = buildCaption(record);
  try {
    await sendAllMedia(env.TELEGRAM_BOT_TOKEN, record, info.resultUrls, caption);
  } catch (e) {
    console.error(`telegram send failed for ${taskId}:`, e);
    const fallback = `✅ Готово, но не удалось вложить в чат напрямую.\n${info.resultUrls.join("\n")}\n\n${caption}`;
    await sendText(env.TELEGRAM_BOT_TOKEN, record.chatId, truncate(fallback, TG_TEXT_LIMIT));
  }

  await deleteTask(env.TASKS, taskId);
  return { status: "delivered", state: info.state };
}

async function sendAllMedia(
  token: string,
  record: TaskRecord,
  urls: string[],
  caption: string,
): Promise<void> {
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const cap = i === 0 ? caption : "";
    if (record.type === "video") {
      await sendVideo(token, record.chatId, url, cap);
    } else {
      await sendPhoto(token, record.chatId, url, cap);
    }
  }
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
