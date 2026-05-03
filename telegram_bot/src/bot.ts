import { Bot, type Context, GrammyError, HttpError } from "grammy";
import { autoRetry } from "@grammyjs/auto-retry";
import { MODELS, type ModelKey, calcPrice, getVersion } from "./config";
import {
  clearSession,
  deleteTask,
  getSession,
  listPendingTasksForUser,
  saveTask,
  setSession,
  type Session,
} from "./session";
import * as kb from "./keyboards";
import { KieError, createTask, pingApi } from "./kie";
import { tryDeliverTask } from "./delivery";

export interface Env {
  TELEGRAM_BOT_TOKEN: string;
  KIE_API_KEY: string;
  TASKS: KVNamespace;
  WORKER_URL: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  KIE_CALLBACK_SECRET?: string;
  /** CSV из Telegram user_id, которым разрешён доступ. Пусто = всем. */
  ALLOWED_USER_IDS?: string;
}

export function createBot(env: Env): Bot {
  const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

  // Авто-ретрай при rate-limit Telegram (429) и временных HTTP-ошибках.
  bot.api.config.use(autoRetry({ maxRetryAttempts: 3, maxDelaySeconds: 5 }));

  installAccessGuard(bot, env);
  installCommands(bot, env);
  installFlowHandlers(bot, env);
  installNavHandlers(bot, env);
  installTaskHandlers(bot, env);
  installPromptHandler(bot, env);

  bot.catch((err) => {
    const e = err.error;
    if (e instanceof GrammyError) {
      console.error("grammy api error:", e.description);
    } else if (e instanceof HttpError) {
      console.error("network error:", e);
    } else {
      console.error("unknown bot error:", e);
    }
  });

  return bot;
}

// =========================================================================
// Allowlist
// =========================================================================
function installAccessGuard(bot: Bot, env: Env): void {
  if (!env.ALLOWED_USER_IDS) return;
  const allowed = new Set(
    env.ALLOWED_USER_IDS.split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n)),
  );
  if (allowed.size === 0) return;
  bot.use(async (ctx, next) => {
    const id = ctx.from?.id;
    if (!id || !allowed.has(id)) {
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery({ text: "⛔ Доступ запрещён" });
      } else if (ctx.chat) {
        await ctx.reply(`⛔ Доступ запрещён.\nТвой id: ${id ?? "?"}`);
      }
      return;
    }
    await next();
  });
}

// =========================================================================
// Commands
// =========================================================================
function installCommands(bot: Bot, env: Env): void {
  bot.command(["start", "menu"], async (ctx) => {
    if (!ctx.from) return;
    await setSession(env.TASKS, ctx.from.id, { step: "model" });
    await ctx.reply(
      "👋 Привет! Это бот-обёртка над kie.ai.\n\n" +
        "Шаги: модель → версия → формат → качество → длительность → промпт.\n\n" +
        "Команды:\n" +
        "/menu — выбрать модель\n" +
        "/status — мои активные задачи\n" +
        "/cancel — сбросить текущий выбор\n" +
        "/help — справка\n\n" +
        "Выбери модель:",
      { reply_markup: kb.modelsKeyboard() },
    );
  });

  bot.command("cancel", async (ctx) => {
    if (!ctx.from) return;
    await clearSession(env.TASKS, ctx.from.id);
    await ctx.reply("Сброшено. /menu чтобы начать заново.");
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(
      "/menu — выбор модели и запуск\n" +
        "/status — список активных задач\n" +
        "/test — проверить коннект с kie.ai\n" +
        "/cancel — сброс текущего выбора\n\n" +
        "После запуска под сообщением будет кнопка 🔄 Проверить — " +
        "ткни если результат не пришёл сам.",
    );
  });

  bot.command("test", async (ctx) => {
    const note = await ctx.reply("⏳ Проверяю коннект с kie.ai...");
    try {
      const result = await pingApi(env.KIE_API_KEY);
      const text = result.ok
        ? `✅ kie.ai отвечает (HTTP ${result.status}). Ключ принят.\n\n` +
          `Сэмпл ответа:\n\`\`\`\n${result.body.slice(0, 300)}\n\`\`\``
        : `⚠️ HTTP ${result.status} от kie.ai.\nПроверь KIE_API_KEY.\n\n` +
          `Тело:\n\`\`\`\n${result.body.slice(0, 300)}\n\`\`\``;
      await ctx.api.editMessageText(ctx.chat!.id, note.message_id, text, { parse_mode: "Markdown" });
    } catch (e) {
      await ctx.api.editMessageText(
        ctx.chat!.id,
        note.message_id,
        `❌ Не удалось достучаться до kie.ai:\n${e instanceof Error ? e.message : String(e)}`,
      );
    }
  });

  bot.command("status", async (ctx) => {
    if (!ctx.from) return;
    const tasks = await listPendingTasksForUser(env.TASKS, ctx.from.id);
    if (tasks.length === 0) {
      await ctx.reply("Активных задач нет.");
      return;
    }
    const lines = tasks.map(({ taskId, record }) => {
      const ageSec = Math.round((Date.now() - record.createdAt) / 1000);
      return `🆔 ${taskId}\n   ${record.model} / ${record.version}\n   ⏱ ${ageSec}с назад`;
    });
    await ctx.reply(`Активных задач: ${tasks.length}\n\n${lines.join("\n\n")}`);
  });
}

// =========================================================================
// Конфигурирование запроса (клики по моделям/форматам)
// =========================================================================
function installFlowHandlers(bot: Bot, env: Env): void {
  bot.callbackQuery(/^m:(.+)$/, async (ctx) => {
    if (!ctx.from || !ctx.match) return;
    const modelKey = ctx.match[1] as ModelKey;
    if (!(modelKey in MODELS)) {
      await ctx.answerCallbackQuery({ text: "Неизвестная модель" });
      return;
    }
    await setSession(env.TASKS, ctx.from.id, { step: "version", model: modelKey });
    const model = MODELS[modelKey];
    await safeEdit(ctx, `${model.title}\n${model.description}\n\nВыбери версию:`, {
      reply_markup: kb.versionsKeyboard(modelKey),
    });
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/^v:(.+)$/, async (ctx) => {
    if (!ctx.from || !ctx.match) return;
    const session = await getSession(env.TASKS, ctx.from.id);
    if (!session.model) {
      await ctx.answerCallbackQuery({ text: "Сначала /menu" });
      return;
    }
    const versionKey = ctx.match[1];
    const version = getVersion(session.model, versionKey);
    if (!version) {
      await ctx.answerCallbackQuery({ text: "Неизвестная версия" });
      return;
    }
    session.version = versionKey;

    // Особый flow для motion-control: пропускаем формат/качество/длительность
    // и сразу просим 3-строчный ввод.
    if (version.inputType === "motion-control") {
      session.step = "prompt";
      await setSession(env.TASKS, ctx.from.id, session);
      await safeEdit(
        ctx,
        `${version.label}\n\n` +
          `Пришли одним сообщением 3 элемента, по строке каждый:\n\n` +
          `1️⃣ URL картинки персонажа (jpg/png)\n` +
          `2️⃣ URL видео-референса движения (mp4)\n` +
          `3️⃣ Текст промпта\n\n` +
          `Пример:\n` +
          `\`https://.../character.png\`\n` +
          `\`https://.../motion.mp4\`\n` +
          `Персонаж танцует под дождём`,
        { parse_mode: "Markdown" },
      );
      await ctx.answerCallbackQuery();
      return;
    }

    session.step = "format";
    await setSession(env.TASKS, ctx.from.id, session);
    await safeEdit(ctx, "Выбери формат (соотношение сторон):", {
      reply_markup: kb.formatsKeyboard(session.model),
    });
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/^f:(.+)$/, async (ctx) => {
    if (!ctx.from || !ctx.match) return;
    const session = await getSession(env.TASKS, ctx.from.id);
    if (!session.model || !session.version) {
      await ctx.answerCallbackQuery({ text: "Сначала /menu" });
      return;
    }
    session.format = ctx.match[1];
    await advanceAfterFormat(ctx, env, session);
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/^q:(.+)$/, async (ctx) => {
    if (!ctx.from || !ctx.match) return;
    const session = await getSession(env.TASKS, ctx.from.id);
    if (!session.model || !session.version) {
      await ctx.answerCallbackQuery({ text: "Сначала /menu" });
      return;
    }
    session.quality = ctx.match[1];
    await advanceAfterQuality(ctx, env, session);
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/^d:(\d+)$/, async (ctx) => {
    if (!ctx.from || !ctx.match) return;
    const session = await getSession(env.TASKS, ctx.from.id);
    if (!session.model || !session.version) {
      await ctx.answerCallbackQuery({ text: "Сначала /menu" });
      return;
    }
    session.duration = parseInt(ctx.match[1], 10);
    session.step = "prompt";
    await setSession(env.TASKS, ctx.from.id, session);
    await showPromptStage(ctx, session);
    await ctx.answerCallbackQuery();
  });
}

// =========================================================================
// Кнопки "Назад"
// =========================================================================
function installNavHandlers(bot: Bot, env: Env): void {
  bot.callbackQuery("back:model", async (ctx) => {
    if (!ctx.from) return;
    await setSession(env.TASKS, ctx.from.id, { step: "model" });
    await safeEdit(ctx, "Выбери модель:", { reply_markup: kb.modelsKeyboard() });
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery("back:version", async (ctx) => {
    if (!ctx.from) return;
    const session = await getSession(env.TASKS, ctx.from.id);
    if (!session.model) {
      await safeEdit(ctx, "Выбери модель:", { reply_markup: kb.modelsKeyboard() });
    } else {
      session.step = "version";
      await setSession(env.TASKS, ctx.from.id, session);
      await safeEdit(ctx, `${MODELS[session.model].title}\nВыбери версию:`, {
        reply_markup: kb.versionsKeyboard(session.model),
      });
    }
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery("back:format", async (ctx) => {
    if (!ctx.from) return;
    const session = await getSession(env.TASKS, ctx.from.id);
    if (!session.model) {
      await safeEdit(ctx, "Выбери модель:", { reply_markup: kb.modelsKeyboard() });
    } else {
      session.step = "format";
      await setSession(env.TASKS, ctx.from.id, session);
      await safeEdit(ctx, "Выбери формат:", {
        reply_markup: kb.formatsKeyboard(session.model),
      });
    }
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery("back:quality_or_format", async (ctx) => {
    if (!ctx.from) return;
    const session = await getSession(env.TASKS, ctx.from.id);
    if (!session.model) {
      await safeEdit(ctx, "Выбери модель:", { reply_markup: kb.modelsKeyboard() });
    } else if (MODELS[session.model].qualities) {
      session.step = "quality";
      await setSession(env.TASKS, ctx.from.id, session);
      await safeEdit(ctx, "Выбери качество:", {
        reply_markup: kb.qualitiesKeyboard(session.model),
      });
    } else {
      session.step = "format";
      await setSession(env.TASKS, ctx.from.id, session);
      await safeEdit(ctx, "Выбери формат:", {
        reply_markup: kb.formatsKeyboard(session.model),
      });
    }
    await ctx.answerCallbackQuery();
  });
}

// =========================================================================
// Управление созданной задачей: 🔄 Проверить / 🗑 Снять
// =========================================================================
function installTaskHandlers(bot: Bot, env: Env): void {
  bot.callbackQuery(/^check:(.+)$/, async (ctx) => {
    if (!ctx.match) return;
    const taskId = ctx.match[1];
    const result = await tryDeliverTask(taskId, env);
    switch (result.status) {
      case "delivered":
        await ctx.answerCallbackQuery({ text: "✅ Готово, отправил" });
        await safeRemoveKeyboard(ctx);
        break;
      case "failed":
        await ctx.answerCallbackQuery({ text: `❌ Ошибка: ${result.error ?? "?"}` });
        await safeRemoveKeyboard(ctx);
        break;
      case "missing":
        await ctx.answerCallbackQuery({ text: "Задача уже доставлена или истекла" });
        await safeRemoveKeyboard(ctx);
        break;
      case "still-running":
      default:
        await ctx.answerCallbackQuery({
          text: `⏳ Ещё генерируется (state: ${result.state ?? "?"})`,
        });
    }
  });

  bot.callbackQuery(/^drop:(.+)$/, async (ctx) => {
    if (!ctx.match) return;
    const taskId = ctx.match[1];
    await deleteTask(env.TASKS, taskId);
    await ctx.answerCallbackQuery({ text: "Снято с ожидания" });
    await safeRemoveKeyboard(ctx);
  });
}

// =========================================================================
// Промпт текстом
// =========================================================================
function installPromptHandler(bot: Bot, env: Env): void {
  bot.on("message:text", async (ctx) => {
    if (!ctx.from || !ctx.chat) return;
    if (ctx.message.text.startsWith("/")) return; // команды отрабатываются отдельно

    const session = await getSession(env.TASKS, ctx.from.id);
    if (session.step !== "prompt" || !session.model || !session.version) {
      await ctx.reply("Используй /menu чтобы выбрать модель.");
      return;
    }
    const version = getVersion(session.model, session.version);
    if (!version) {
      await ctx.reply("Версия не найдена. /menu");
      return;
    }

    const text = ctx.message.text.trim();
    if (!text) {
      await ctx.reply("Промпт пустой. Пришли текст.");
      return;
    }

    // Для motion-control парсим 3 элемента: img URL, video URL, prompt
    let prompt = text;
    let imageUrl: string | undefined;
    let videoUrl: string | undefined;
    if (version.inputType === "motion-control") {
      const parsed = parseMotionControlInput(text);
      if (!parsed) {
        await ctx.reply(
          "Нужно 3 строки: URL картинки, URL видео, текст промпта.\n" +
            "Пример:\nhttps://.../char.png\nhttps://.../motion.mp4\nПерсонаж танцует",
        );
        return;
      }
      ({ imageUrl, videoUrl, prompt } = parsed);
    }

    const callBackUrl = buildCallbackUrl(env);
    const status = await ctx.reply("⏳ Создаю задачу в kie.ai...");

    let taskId: string;
    try {
      const created = await createTask({
        apiKey: env.KIE_API_KEY,
        family: version.family,
        kieModel: version.kieModel,
        prompt,
        aspectRatio: session.format,
        quality: session.quality,
        duration: session.duration,
        imageUrl,
        videoUrl,
        callBackUrl,
      });
      taskId = created.taskId;
    } catch (e) {
      let msg: string;
      if (e instanceof KieError) {
        msg = `kie.ai: ${e.message} (code ${e.code ?? "?"})`;
        if (e.responseBody) msg += `\n\nОтвет:\n${e.responseBody}`;
      } else {
        msg = String(e);
      }
      await ctx.api.editMessageText(
        ctx.chat.id,
        status.message_id,
        `❌ Не удалось создать задачу:\n${msg.slice(0, 1500)}`,
      );
      return;
    }

    await saveTask(env.TASKS, taskId, {
      chatId: ctx.chat.id,
      userId: ctx.from.id,
      type: version.type,
      family: version.family,
      model: session.model,
      version: session.version,
      prompt,
      createdAt: Date.now(),
    });

    const price = calcPrice(
      session.model,
      session.version,
      session.quality ?? null,
      session.duration ?? null,
    );

    const isVideo = version.type === "video";
    await ctx.api.editMessageText(
      ctx.chat.id,
      status.message_id,
      `✅ Задача создана\n` +
        `🆔 ${taskId}\n` +
        `🤖 ${version.label}\n` +
        `💵 ~$${price.toFixed(4)}\n\n` +
        (isVideo
          ? "Видео обычно ~1-5 минут. Пришлю как только будет готово."
          : "Картинка обычно ~10-30 секунд."),
      { reply_markup: kb.taskKeyboard(taskId) },
    );

    await clearSession(env.TASKS, ctx.from.id);
  });
}

// =========================================================================
// Вспомогательное
// =========================================================================
async function advanceAfterFormat(ctx: Context, env: Env, session: Session): Promise<void> {
  if (!session.model || !ctx.from) return;
  const model = MODELS[session.model];

  if (model.qualities) {
    session.step = "quality";
    await setSession(env.TASKS, ctx.from.id, session);
    await safeEdit(ctx, "Выбери качество:", { reply_markup: kb.qualitiesKeyboard(session.model) });
    return;
  }
  if (model.durations) {
    session.step = "duration";
    await setSession(env.TASKS, ctx.from.id, session);
    await safeEdit(ctx, "Выбери длительность:", { reply_markup: kb.durationsKeyboard(session.model) });
    return;
  }
  session.step = "prompt";
  await setSession(env.TASKS, ctx.from.id, session);
  await showPromptStage(ctx, session);
}

async function advanceAfterQuality(ctx: Context, env: Env, session: Session): Promise<void> {
  if (!session.model || !ctx.from) return;
  const model = MODELS[session.model];
  if (model.durations) {
    session.step = "duration";
    await setSession(env.TASKS, ctx.from.id, session);
    await safeEdit(ctx, "Выбери длительность:", { reply_markup: kb.durationsKeyboard(session.model) });
    return;
  }
  session.step = "prompt";
  await setSession(env.TASKS, ctx.from.id, session);
  await showPromptStage(ctx, session);
}

async function showPromptStage(ctx: Context, session: Session): Promise<void> {
  if (!session.model || !session.version) return;
  const version = getVersion(session.model, session.version);
  if (!version) return;
  const price = calcPrice(
    session.model,
    session.version,
    session.quality ?? null,
    session.duration ?? null,
  );
  const lines: string[] = [
    "Готово к запуску:",
    `🤖 ${version.label}`,
    `📐 Формат: ${session.format}`,
  ];
  if (session.quality) lines.push(`🎚 Качество: ${session.quality}`);
  if (session.duration) lines.push(`⏱ Длительность: ${session.duration}с`);
  lines.push(`💵 Стоимость: ~$${price.toFixed(4)}`);
  lines.push("");
  lines.push("Теперь пришли промпт текстом 👇");
  await safeEdit(ctx, lines.join("\n"));
}

/**
 * Парсер ввода для Kling Motion Control.
 * Ищет первые две http(s)-ссылки (картинка и видео в этом порядке);
 * остаток текста считается промптом.
 */
function parseMotionControlInput(text: string): { imageUrl: string; videoUrl: string; prompt: string } | null {
  const lines = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const urls: string[] = [];
  const promptLines: string[] = [];
  for (const line of lines) {
    if (urls.length < 2 && /^https?:\/\/\S+$/i.test(line)) {
      urls.push(line);
    } else {
      promptLines.push(line);
    }
  }
  if (urls.length < 2 || promptLines.length === 0) return null;
  return {
    imageUrl: urls[0],
    videoUrl: urls[1],
    prompt: promptLines.join("\n"),
  };
}

function buildCallbackUrl(env: Env): string {
  const base = env.WORKER_URL.replace(/\/$/, "");
  const url = new URL(`${base}/kie-callback`);
  if (env.KIE_CALLBACK_SECRET) {
    url.searchParams.set("token", env.KIE_CALLBACK_SECRET);
  }
  return url.toString();
}

/** editMessageText, проглатывающий "message is not modified". */
async function safeEdit(
  ctx: Context,
  text: string,
  opts: Parameters<Context["editMessageText"]>[1] = {},
): Promise<void> {
  try {
    await ctx.editMessageText(text, opts);
  } catch (e) {
    if (e instanceof GrammyError && e.description?.includes("message is not modified")) return;
    throw e;
  }
}

async function safeRemoveKeyboard(ctx: Context): Promise<void> {
  try {
    await ctx.editMessageReplyMarkup({ reply_markup: undefined });
  } catch (e) {
    if (e instanceof GrammyError && e.description?.includes("message is not modified")) return;
    // не критично
  }
}
