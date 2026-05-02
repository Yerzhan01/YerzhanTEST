/**
 * Конфиг моделей kie.ai.
 * Цены ориентировочные — сверяй на https://kie.ai/pricing
 * `kieModel` — это идентификатор модели для эндпоинта /api/v1/jobs/createTask.
 */

export type ModelKey = "nano_banana" | "gpt_image" | "veo3" | "kling";
export type MediaType = "image" | "image-edit" | "video";

export interface VersionConfig {
  label: string;
  kieModel: string;
  type: MediaType;
  priceUsd?: number;
  pricePer5sUsd?: number;
}

export interface QualityConfig {
  label: string;
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
  nano_banana: {
    title: "🍌 Nano Banana (Google)",
    description: "Быстрая генерация и редактирование изображений",
    versions: {
      "nano-banana": {
        label: "Nano Banana (text → image)",
        kieModel: "google/nano-banana",
        type: "image",
        priceUsd: 0.020,
      },
      "nano-banana-edit": {
        label: "Nano Banana Edit (image → image)",
        kieModel: "google/nano-banana-edit",
        type: "image-edit",
        priceUsd: 0.020,
      },
      "nano-banana-upscale": {
        label: "Nano Banana Upscale",
        kieModel: "google/nano-banana-upscale",
        type: "image-edit",
        priceUsd: 0.030,
      },
    },
    formats: ["1:1", "3:4", "4:3", "9:16", "16:9"],
    qualities: null,
    durations: null,
  },

  gpt_image: {
    title: "🎨 GPT Image (OpenAI)",
    description: "Качественная генерация в стиле GPT-4o",
    versions: {
      "gpt-image-1": {
        label: "GPT Image 1",
        kieModel: "gpt4o-image",
        type: "image",
        priceUsd: 0.025,
      },
      "gpt-image-2": {
        label: "GPT Image 2",
        kieModel: "gpt-image-2",
        type: "image",
        priceUsd: 0.040,
      },
    },
    formats: ["1:1", "3:2", "2:3"],
    qualities: {
      low: { label: "Low", multiplier: 1.0 },
      medium: { label: "Medium", multiplier: 1.6 },
      high: { label: "High (HD)", multiplier: 2.5 },
    },
    durations: null,
  },

  veo3: {
    title: "🎬 Veo 3 (Google Video)",
    description: "Видео из текста или картинки (8 сек)",
    versions: {
      "veo3-fast": {
        label: "Veo 3 Fast",
        kieModel: "veo3_fast",
        type: "video",
        priceUsd: 0.40,
      },
      "veo3-quality": {
        label: "Veo 3 Quality",
        kieModel: "veo3",
        type: "video",
        priceUsd: 2.00,
      },
    },
    formats: ["16:9", "9:16"],
    qualities: {
      "720p": { label: "720p", multiplier: 1.0 },
      "1080p": { label: "1080p", multiplier: 1.5 },
    },
    durations: [8],
  },

  kling: {
    title: "🐉 Kling Video",
    description: "Видео из текста или картинки",
    versions: {
      "kling-v1.6-std": {
        label: "Kling v1.6 Standard",
        kieModel: "kling-v1.6-standard",
        type: "video",
        pricePer5sUsd: 0.14,
      },
      "kling-v2.1-std": {
        label: "Kling v2.1 Standard",
        kieModel: "kling-v2.1-standard",
        type: "video",
        pricePer5sUsd: 0.28,
      },
      "kling-v2.1-pro": {
        label: "Kling v2.1 Pro",
        kieModel: "kling-v2.1-pro",
        type: "video",
        pricePer5sUsd: 0.56,
      },
      "kling-v2.1-master": {
        label: "Kling v2.1 Master",
        kieModel: "kling-v2.1-master",
        type: "video",
        pricePer5sUsd: 1.40,
      },
      "kling-v3-master": {
        label: "Kling v3 Master",
        kieModel: "kling-v3-master",
        type: "video",
        pricePer5sUsd: 1.80,
      },
    },
    formats: ["16:9", "9:16", "1:1"],
    qualities: null,
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
