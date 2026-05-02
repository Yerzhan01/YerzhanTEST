import { webhookCallback } from "grammy";
import { createBot, type Env } from "./bot";
import { listAllPendingTasks } from "./session";
import { tryDeliverTask } from "./delivery";

/** Минимальный возраст задачи для cron-проверки — даём шанс callback'у. */
const POLL_MIN_AGE_MS = 30_000;

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

  /** Cron каждую минуту: подбираем задачи, которые kie.ai не дослал callback'ом. */
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(pollPendingTasks(env));
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

  const taskId = findTaskId(payload);
  if (!taskId) {
    console.error("kie callback without taskId:", payload);
    return new Response("missing taskId", { status: 400 });
  }

  // Быстрый ответ kie.ai — фактическая доставка фоном.
  ctx.waitUntil(
    tryDeliverTask(taskId, env, payload).catch((e) =>
      console.error(`callback delivery failed for ${taskId}:`, e),
    ),
  );
  return new Response("ok");
}

async function pollPendingTasks(env: Env): Promise<void> {
  let tasks;
  try {
    tasks = await listAllPendingTasks(env.TASKS);
  } catch (e) {
    console.error("KV list failed:", e);
    return;
  }

  for (const { taskId, record } of tasks) {
    if (Date.now() - record.createdAt < POLL_MIN_AGE_MS) continue;
    try {
      const result = await tryDeliverTask(taskId, env);
      if (result.status === "delivered" || result.status === "failed") {
        console.log(`cron: ${result.status} ${taskId} (state=${result.state})`);
      }
    } catch (e) {
      console.error(`cron poll failed for ${taskId}:`, e);
    }
  }
}

function findTaskId(payload: unknown): string | null {
  const visit = (node: unknown, depth = 0): string | null => {
    if (!node || depth > 5) return null;
    if (typeof node !== "object") return null;
    const obj = node as Record<string, unknown>;
    if (typeof obj.taskId === "string") return obj.taskId;
    if (typeof obj.task_id === "string") return obj.task_id;
    for (const v of Object.values(obj)) {
      const found = visit(v, depth + 1);
      if (found) return found;
    }
    return null;
  };
  return visit(payload);
}
