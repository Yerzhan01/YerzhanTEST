import { webhookCallback } from "grammy";
import { createBot, type Env } from "./bot";
import { deleteTask, getTask } from "./session";
import { extractMediaUrl, getRecordInfo } from "./kie";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/" && request.method === "GET") {
      return new Response("telegram-kie-bot is running", {
        headers: { "content-type": "text/plain" },
      });
    }

    if (url.pathname === "/webhook" && request.method === "POST") {
      const bot = createBot(env);
      const handler = webhookCallback(bot, "cloudflare-mod", {
        secretToken: env.TELEGRAM_WEBHOOK_SECRET,
      });
      return handler(request);
    }

    if (url.pathname === "/kie-callback" && request.method === "POST") {
      return handleKieCallback(request, env, ctx);
    }

    return new Response("not found", { status: 404 });
  },
};

async function handleKieCallback(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  if (env.KIE_CALLBACK_SECRET) {
    const url = new URL(request.url);
    if (url.searchParams.get("token") !== env.KIE_CALLBACK_SECRET) {
      return new Response("forbidden", { status: 403 });
    }
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return new Response("bad json", { status: 400 });
  }

  // Делаем быстрый ответ kie.ai, остальное — фоном.
  ctx.waitUntil(processCallback(payload, env));
  return new Response("ok");
}

async function processCallback(payload: unknown, env: Env): Promise<void> {
  const taskId = findTaskId(payload);
  if (!taskId) {
    console.error("callback without taskId", payload);
    return;
  }

  const record = await getTask(env.TASKS, taskId);
  if (!record) {
    console.error("unknown task in callback:", taskId);
    return;
  }

  // Тянем подробности — kie.ai в callback не всегда шлёт URL результата.
  let info;
  try {
    info = await getRecordInfo(taskId, env.KIE_API_KEY);
  } catch (e) {
    console.error("recordInfo failed:", e);
  }

  const sources: unknown[] = [info, payload];
  if (info?.resultJson) {
    try { sources.unshift(JSON.parse(info.resultJson)); } catch { /* ignore */ }
  }

  let mediaUrl: string | null = null;
  for (const src of sources) {
    mediaUrl = extractMediaUrl(src);
    if (mediaUrl) break;
  }

  const tg = telegramClient(env.TELEGRAM_BOT_TOKEN);
  const state = info?.state ?? "unknown";
  const failMsg = info?.failMsg;

  if (!mediaUrl) {
    await tg.sendMessage(
      record.chatId,
      `❌ Задача \`${taskId}\` не вернула результат.\n` +
        `Статус: ${state}` +
        (failMsg ? `\nОшибка: ${failMsg}` : ""),
      { parse_mode: "Markdown" },
    );
    await deleteTask(env.TASKS, taskId);
    return;
  }

  const caption = `✅ Готово\n${record.model} / ${record.version}\n📝 ${truncate(record.prompt, 200)}`;
  try {
    if (record.type === "video") {
      await tg.sendVideo(record.chatId, mediaUrl, caption);
    } else {
      await tg.sendPhoto(record.chatId, mediaUrl, caption);
    }
  } catch (e) {
    console.error("telegram send failed, falling back to plain link:", e);
    await tg.sendMessage(record.chatId, `✅ Готово: ${mediaUrl}\n\n${caption}`);
  }

  await deleteTask(env.TASKS, taskId);
}

function findTaskId(payload: unknown): string | null {
  const visit = (node: unknown, depth = 0): string | null => {
    if (!node || depth > 5) return null;
    if (typeof node !== "object") return null;
    const obj = node as Record<string, unknown>;
    if (typeof obj.taskId === "string") return obj.taskId;
    if (typeof obj.task_id === "string") return obj.task_id as string;
    for (const v of Object.values(obj)) {
      const found = visit(v, depth + 1);
      if (found) return found;
    }
    return null;
  };
  return visit(payload);
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

function telegramClient(token: string) {
  const base = `https://api.telegram.org/bot${token}`;
  const post = async (method: string, body: Record<string, unknown>) => {
    const res = await fetch(`${base}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`telegram ${method} ${res.status}: ${text}`);
    }
    return res.json();
  };
  return {
    sendMessage(chatId: number, text: string, opts: Record<string, unknown> = {}) {
      return post("sendMessage", { chat_id: chatId, text, ...opts });
    },
    sendPhoto(chatId: number, photo: string, caption: string) {
      return post("sendPhoto", { chat_id: chatId, photo, caption });
    },
    sendVideo(chatId: number, video: string, caption: string) {
      return post("sendVideo", { chat_id: chatId, video, caption });
    },
  };
}
