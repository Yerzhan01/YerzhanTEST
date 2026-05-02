/**
 * Конфиг моделей kie.ai. Сверено с https://docs.kie.ai/ (декабрь 2024).
 * Цены ориентировочные — итоговое списание см. в дашборде kie.ai.
 *
 * `family` определяет, какой эндпоинт и схему запроса использовать
 * (см. адаптеры в src/kie.ts).
 *   - "jobs"        → /api/v1/jobs/createTask           (Nano Banana, Kling)
 *   - "veo"         → /api/v1/veo/generate              (Veo 3)
 *   - "gpt4o-image" → /api/v1/gpt4o-image/generate      (GPT-4o Image)
 *
 * `kieModel` — то значение, которое уходит в запрос:
 *   - для "jobs"   — поле `model` в теле
 *   - для "veo"    — поле `model` в теле ("veo3" / "veo3_fast")
 *   - для "gpt4o-image" — служебное (эндпоинт сам по себе модель-специфичен)
 */

import type { ModelFamily } from "./kie";

export type ModelKey = "nano_banana" | "gpt_image" | "veo3" | "kling";
export type MediaType = "image" | "video";

export interface VersionConfig {
  label: string;
  family: ModelFamily;
  kieModel: string;
  type: MediaType;
  /** Цена за 1 единицу (картинку или видео фиксированной длины). */
  priceUsd?: number;
  /** Цена за 5 секунд видео (для моделей, биллящих по длительности). */
  pricePer5sUsd?: number;
}

export interface QualityConfig {
  label: string;
  /** Множитель к базовой цене. */
  multiplier: number;
}

export interface ModelConfig {
  title: string;
  description: string;
  versions: Record<string, VersionConfig>;
  formats: string[];
  qualities: Record<string, QualityConfig> | null;
  durations: number[] | null;
}

export const MODELS: Record<ModelKey, ModelConfig> = {
  // =====================================================================
  // 🍌 Nano Banana — Google Gemini Image (через jobs API)
  // =====================================================================
  nano_banana: {
    title: "🍌 Nano Banana (Google)",
    description: "Текст → картинка, разные поколения Gemini Image",
    versions: {
      "nano-banana": {
        // kie.ai/nano-banana — "starts at ~$0.02 per image"
        label: "Nano Banana (Gemini 2.5 Flash) — от $0.02",
        family: "jobs",
        kieModel: "google/nano-banana",
        type: "image",
        priceUsd: 0.020,
      },
      "nano-banana-pro": {
        // kie.ai/nano-banana-pro — $0.09 (1K/2K), $0.12 (4K).
        // Без выбора разрешения берём $0.09; на 4K кредиты спишут больше.
        label: "Nano Banana Pro (Gemini 3 Pro) — $0.09",
        family: "jobs",
        kieModel: "nano-banana-pro",
        type: "image",
        priceUsd: 0.090,
      },
      "nano-banana-2": {
        // kie.ai/nano-banana-2 — page title: "from $0.04"
        label: "Nano Banana 2 (Gemini 3.1 Flash, 4K) — от $0.04",
        family: "jobs",
        kieModel: "nano-banana-2",
        type: "image",
        priceUsd: 0.040,
      },
    },
    // Нано-банана поддерживает auto и большой набор соотношений; берём ходовые.
    formats: ["auto", "1:1", "3:4", "4:3", "9:16", "16:9"],
    qualities: null,
    durations: null,
  },

  // =====================================================================
  // 🎨 GPT Image 2 — OpenAI (через jobs API: gpt-image-2-text-to-image)
  // =====================================================================
  gpt_image: {
    title: "🎨 GPT Image 2 (OpenAI)",
    description: "Топовая генерация изображений от OpenAI",
    versions: {
      "gpt-image-2": {
        // На kie.ai точная цена не светится в публичных текстах; ставим
        // оценочно $0.04 (тариф уровня nano-banana-2). Реальное списание
        // см. в дашборде kie.ai после первой генерации.
        label: "GPT Image 2 — ~$0.04 (≈)",
        family: "jobs",
        kieModel: "gpt-image-2-text-to-image",
        type: "image",
        priceUsd: 0.040,
      },
    },
    formats: ["auto", "1:1", "16:9", "9:16", "4:3", "3:4"],
    qualities: null,
    durations: null,
  },

  // =====================================================================
  // 🎬 Veo 3 — Google Video (выделенный эндпоинт)
  // =====================================================================
  veo3: {
    title: "🎬 Veo 3 (Google Video)",
    description: "Видео из текста, ~8 сек со звуком",
    versions: {
      "veo3-fast": {
        // kie.ai/v3-api-pricing: $0.40 / 8s video (80 credits)
        label: "Veo 3 Fast — $0.40 / 8с",
        family: "veo",
        kieModel: "veo3_fast",
        type: "video",
        priceUsd: 0.40,
      },
      "veo3-quality": {
        // kie.ai/v3-api-pricing: $2.00 / 8s video (400 credits)
        label: "Veo 3 Quality — $2.00 / 8с",
        family: "veo",
        kieModel: "veo3",
        type: "video",
        priceUsd: 2.00,
      },
    },
    formats: ["16:9", "9:16"],
    qualities: null, // на kie.ai разрешение не выбирается отдельно — фиксировано на 1080p
    durations: null, // длительность также фиксированная (~8с)
  },

  // =====================================================================
  // 🐉 Kling 3.0 — видео (через jobs API)
  // =====================================================================
  kling: {
    title: "🐉 Kling 3.0 Video",
    description: "Видео из текста; std/pro = разрешение",
    versions: {
      "kling-3.0": {
        // На kie.ai страница kling-3-0 цену конкретно не публикует.
        // Для ориентира: Kling 2.1 Pro у kie.ai = $0.25/5с, Standard = $0.125/5с.
        // 3.0 ставим выше: ~$0.30/5с std (множитель ×2 для pro = $0.60/5с).
        label: "Kling 3.0 — ~$0.30/5с std, ~$0.60/5с pro (≈)",
        family: "jobs",
        kieModel: "kling-3.0/video",
        type: "video",
        pricePer5sUsd: 0.30,
      },
    },
    formats: ["16:9", "9:16", "1:1"],
    qualities: {
      // Kling: поле "mode" в API. std = 720p, pro = 1080p.
      std: { label: "Standard (720p)", multiplier: 1.0 },
      pro: { label: "Pro (1080p)", multiplier: 2.0 },
    },
    durations: [5, 10],
  },
};

export function getVersion(modelKey: ModelKey, versionKey: string): VersionConfig | undefined {
  return MODELS[modelKey]?.versions[versionKey];
}

export function calcPrice(
  modelKey: ModelKey,
  versionKey: string,
  qualityKey: string | null,
  duration: number | null,
): number {
  const model = MODELS[modelKey];
  const version = model.versions[versionKey];
  if (!version) return 0;

  let base: number;
  if (version.pricePer5sUsd != null) {
    const dur = duration ?? 5;
    const units = Math.max(1, Math.ceil(dur / 5));
    base = version.pricePer5sUsd * units;
  } else {
    base = version.priceUsd ?? 0;
  }

  if (qualityKey && model.qualities && model.qualities[qualityKey]) {
    base *= model.qualities[qualityKey].multiplier;
  }

  return Math.round(base * 10000) / 10000;
}
