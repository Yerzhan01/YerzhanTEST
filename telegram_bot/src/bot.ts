import { Bot, type Context } from "grammy";
import { MODELS, type ModelKey, calcPrice, getVersion } from "./config";
import {
  clearSession,
  getSession,
  saveTask,
  setSession,
  type Session,
} from "./session";
import * as kb from "./keyboards";
import { KieError, createTask } from "./kie";

export interface Env {
  TELEGRAM_BOT_TOKEN: string;
  KIE_API_KEY: string;
  TASKS: KVNamespace;
  WORKER_URL: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  KIE_CALLBACK_SECRET?: string;
}

export function createBot(env: Env): Bot {
  const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

  bot.command("start", async (ctx) => {
    if (!ctx.from) return;
    await setSession(env.TASKS, ctx.from.id, { step: "model" });
    await ctx.reply(
      "👋 Привет! Это бот-обёртка над kie.ai\n\n" +
        "Шаги:\n" +
        "1️⃣ Модель → 2️⃣ Версия → 3️⃣ Формат → 4️⃣ Качество → 5️⃣ Длительность → 6️⃣ Промпт\n\n" +
        "Выбери модель:",
      { reply_markup: kb.modelsKeyboard() },
    );
  });

  bot.command("cancel", async (ctx) => {
    if (!ctx.from) return;
    await clearSession(env.TASKS, ctx.from.id);
    await ctx.reply("❌ Отменено. Используй /start чтобы начать заново.");
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(
      "/start — выбрать модель и сделать запрос\n" +
        "/cancel — сбросить текущий выбор\n" +
        "/help — это сообщение",
    );
  });

  // === Выбор модели ===
  bot.callbackQuery(/^m:(.+)$/, async (ctx) => {
    if (!ctx.from || !ctx.match) return;
    const modelKey = ctx.match[1] as ModelKey;
    if (!(modelKey in MODELS)) {
      await ctx.answerCallbackQuery({ text: "Неизвестная модель" });
      return;
    }
    await setSession(env.TASKS, ctx.from.id, { step: "version", model: modelKey });
    const model = MODELS[modelKey];
    await ctx.editMessageText(
      `${model.title}\n${model.description}\n\nВыбери версию:`,
      { reply_markup: kb.versionsKeyboard(modelKey) },
    );
    await ctx.answerCallbackQuery();
  });

  // === Выбор версии → формат ===
  bot.callbackQuery(/^v:(.+)$/, async (ctx) => {
    if (!ctx.from || !ctx.match) return;
    const session = await getSession(env.TASKS, ctx.from.id);
    if (!session.model) {
      await ctx.answerCallbackQuery({ text: "Сначала /start" });
      return;
    }
    const versionKey = ctx.match[1];
    if (!getVersion(session.model, versionKey)) {
      await ctx.answerCallbackQuery({ text: "Неизвестная версия" });
      return;
    }
    session.version = versionKey;
    session.step = "format";
    await setSession(env.TASKS, ctx.from.id, session);
    await ctx.editMessageText("Выбери формат (соотношение сторон):", {
      reply_markup: kb.formatsKeyboard(session.model),
    });
    await ctx.answerCallbackQuery();
  });

  // === Выбор формата → качество / длительность / промпт ===
  bot.callbackQuery(/^f:(.+)$/, async (ctx) => {
    if (!ctx.from || !ctx.match) return;
    const session = await getSession(env.TASKS, ctx.from.id);
    if (!session.model || !session.version) {
      await ctx.answerCallbackQuery({ text: "Сначала /start" });
      return;
    }
    session.format = ctx.match[1];
    await advanceAfterFormat(ctx, env, session);
    await ctx.answerCallbackQuery();
  });

  // === Выбор качества → длительность / промпт ===
  bot.callbackQuery(/^q:(.+)$/, async (ctx) => {
    if (!ctx.from || !ctx.match) return;
    const session = await getSession(env.TASKS, ctx.from.id);
    if (!session.model || !session.version) {
      await ctx.answerCallbackQuery({ text: "Сначала /start" });
      return;
    }
    session.quality = ctx.match[1];
    await advanceAfterQuality(ctx, env, session);
    await ctx.answerCallbackQuery();
  });

  // === Выбор длительности → промпт ===
  bot.callbackQuery(/^d:(\d+)$/, async (ctx) => {
    if (!ctx.from || !ctx.match) return;
    const session = await getSession(env.TASKS, ctx.from.id);
    if (!session.model || !session.version) {
      await ctx.answerCallbackQuery({ text: "Сначала /start" });
      return;
    }
    session.duration = parseInt(ctx.match[1], 10);
    session.step = "prompt";
    await setSession(env.TASKS, ctx.from.id, session);
    await showPromptStage(ctx, session);
    await ctx.answerCallbackQuery();
  });

  // === Кнопки "Назад" ===
  bot.callbackQuery("back:model", async (ctx) => {
    if (!ctx.from) return;
    await setSession(env.TASKS, ctx.from.id, { step: "model" });
    await ctx.editMessageText("Выбери модель:", { reply_markup: kb.modelsKeyboard() });
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery("back:version", async (ctx) => {
    if (!ctx.from) return;
    const session = await getSession(env.TASKS, ctx.from.id);
    if (!session.model) {
      await ctx.editMessageText("Выбери модель:", { reply_markup: kb.modelsKeyboard() });
    } else {
      session.step = "version";
      await setSession(env.TASKS, ctx.from.id, session);
      await ctx.editMessageText(
        `${MODELS[session.model].title}\nВыбери версию:`,
        { reply_markup: kb.versionsKeyboard(session.model) },
      );
    }
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery("back:format", async (ctx) => {
    if (!ctx.from) return;
    const session = await getSession(env.TASKS, ctx.from.id);
    if (!session.model) {
      await ctx.editMessageText("Выбери модель:", { reply_markup: kb.modelsKeyboard() });
    } else {
      session.step = "format";
      await setSession(env.TASKS, ctx.from.id, session);
      await ctx.editMessageText("Выбери формат:", {
        reply_markup: kb.formatsKeyboard(session.model),
      });
    }
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery("back:quality_or_format", async (ctx) => {
    if (!ctx.from) return;
    const session = await getSession(env.TASKS, ctx.from.id);
    if (!session.model) {
      await ctx.editMessageText("Выбери модель:", { reply_markup: kb.modelsKeyboard() });
    } else if (MODELS[session.model].qualities) {
      session.step = "quality";
      await setSession(env.TASKS, ctx.from.id, session);
      await ctx.editMessageText("Выбери качество:", {
        reply_markup: kb.qualitiesKeyboard(session.model),
      });
    } else {
      session.step = "format";
      await setSession(env.TASKS, ctx.from.id, session);
      await ctx.editMessageText("Выбери формат:", {
        reply_markup: kb.formatsKeyboard(session.model),
      });
    }
    await ctx.answerCallbackQuery();
  });

  // === Промпт текстом ===
  bot.on("message:text", async (ctx) => {
    if (!ctx.from || !ctx.chat) return;
    if (ctx.message.text.startsWith("/")) return; // команды обрабатываются отдельно
    const session = await getSession(env.TASKS, ctx.from.id);
    if (session.step !== "prompt" || !session.model || !session.version) {
      await ctx.reply("Используй /start чтобы выбрать модель.");
      return;
    }
    const version = getVersion(session.model, session.version);
    if (!version) {
      await ctx.reply("Версия не найдена. /start");
      return;
    }

    const prompt = ctx.message.text.trim();
    if (!prompt) {
      await ctx.reply("Промпт пустой. Пришли текст.");
      return;
    }

    const callBackUrl = buildCallbackUrl(env);
    await ctx.reply("⏳ Отправляю задачу в kie.ai...");

    try {
      const { taskId } = await createTask({
        apiKey: env.KIE_API_KEY,
        kieModel: version.kieModel,
        prompt,
        aspectRatio: session.format,
        quality: session.quality,
        duration: session.duration,
        callBackUrl,
      });

      await saveTask(env.TASKS, taskId, {
        chatId: ctx.chat.id,
        userId: ctx.from.id,
        type: version.type,
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
      await ctx.reply(
        `✅ Задача создана\n` +
          `🆔 \`${taskId}\`\n` +
          `🤖 ${version.label}\n` +
          `💵 ~$${price.toFixed(4)}\n\n` +
          (isVideo
            ? "Видео генерируется обычно 1-5 минут. Пришлю как только будет готово."
            : "Картинка обычно готова за 10-30 секунд."),
        { parse_mode: "Markdown" },
      );

      await clearSession(env.TASKS, ctx.from.id);
    } catch (e) {
      const msg = e instanceof KieError ? `kie.ai: ${e.message} (code ${e.code ?? "?"})` : String(e);
      await ctx.reply(`❌ Не удалось создать задачу:\n${msg}`);
    }
  });

  bot.catch((err) => {
    console.error("bot error:", err);
  });

  return bot;
}

async function advanceAfterFormat(ctx: Context, env: Env, session: Session): Promise<void> {
  if (!session.model) return;
  const model = MODELS[session.model];

  if (model.qualities) {
    session.step = "quality";
    await setSession(env.TASKS, ctx.from!.id, session);
    await ctx.editMessageText("Выбери качество:", {
      reply_markup: kb.qualitiesKeyboard(session.model),
    });
    return;
  }
  if (model.durations) {
    session.step = "duration";
    await setSession(env.TASKS, ctx.from!.id, session);
    await ctx.editMessageText("Выбери длительность:", {
      reply_markup: kb.durationsKeyboard(session.model),
    });
    return;
  }
  session.step = "prompt";
  await setSession(env.TASKS, ctx.from!.id, session);
  await showPromptStage(ctx, session);
}

async function advanceAfterQuality(ctx: Context, env: Env, session: Session): Promise<void> {
  if (!session.model) return;
  const model = MODELS[session.model];
  if (model.durations) {
    session.step = "duration";
    await setSession(env.TASKS, ctx.from!.id, session);
    await ctx.editMessageText("Выбери длительность:", {
      reply_markup: kb.durationsKeyboard(session.model),
    });
    return;
  }
  session.step = "prompt";
  await setSession(env.TASKS, ctx.from!.id, session);
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
  const lines = [
    `Готово к запуску:`,
    `🤖 ${version.label}`,
    `📐 Формат: ${session.format}`,
  ];
  if (session.quality) lines.push(`🎚 Качество: ${session.quality}`);
  if (session.duration) lines.push(`⏱ Длительность: ${session.duration}с`);
  lines.push(`💵 Стоимость: ~$${price.toFixed(4)}`);
  lines.push("");
  lines.push("Теперь пришли промпт текстом 👇");
  await ctx.editMessageText(lines.join("\n"));
}

function buildCallbackUrl(env: Env): string {
  const base = env.WORKER_URL.replace(/\/$/, "");
  const url = new URL(`${base}/kie-callback`);
  if (env.KIE_CALLBACK_SECRET) {
    url.searchParams.set("token", env.KIE_CALLBACK_SECRET);
  }
  return url.toString();
}
