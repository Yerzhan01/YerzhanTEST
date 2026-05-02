import { InlineKeyboard } from "grammy";
import { MODELS, type ModelKey } from "./config";

export function modelsKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const [key, m] of Object.entries(MODELS)) {
    kb.text(m.title, `m:${key}`).row();
  }
  return kb;
}

export function versionsKeyboard(modelKey: ModelKey): InlineKeyboard {
  const kb = new InlineKeyboard();
  const versions = MODELS[modelKey].versions;
  for (const [key, v] of Object.entries(versions)) {
    const price = v.priceUsd != null
      ? `$${v.priceUsd.toFixed(3)}`
      : `$${(v.pricePer5sUsd ?? 0).toFixed(2)}/5s`;
    kb.text(`${v.label} • ${price}`, `v:${key}`).row();
  }
  kb.text("⬅️ Модели", "back:model");
  return kb;
}

export function formatsKeyboard(modelKey: ModelKey): InlineKeyboard {
  const kb = new InlineKeyboard();
  const formats = MODELS[modelKey].formats;
  let i = 0;
  for (const f of formats) {
    kb.text(f, `f:${f}`);
    i++;
    if (i % 3 === 0) kb.row();
  }
  if (i % 3 !== 0) kb.row();
  kb.text("⬅️ Версии", "back:version");
  return kb;
}

export function qualitiesKeyboard(modelKey: ModelKey): InlineKeyboard {
  const kb = new InlineKeyboard();
  const qualities = MODELS[modelKey].qualities;
  if (qualities) {
    for (const [key, q] of Object.entries(qualities)) {
      kb.text(`${q.label} (×${q.multiplier})`, `q:${key}`).row();
    }
  }
  kb.text("⬅️ Форматы", "back:format");
  return kb;
}

export function durationsKeyboard(modelKey: ModelKey): InlineKeyboard {
  const kb = new InlineKeyboard();
  const durations = MODELS[modelKey].durations ?? [];
  for (const d of durations) {
    kb.text(`${d} сек`, `d:${d}`);
  }
  kb.row();
  kb.text("⬅️ Назад", "back:quality_or_format");
  return kb;
}

/** Кнопки для управления уже созданной задачей. */
export function taskKeyboard(taskId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("🔄 Проверить", `check:${taskId}`)
    .text("🗑 Снять с ожидания", `drop:${taskId}`);
}
