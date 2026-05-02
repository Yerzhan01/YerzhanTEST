/**
 * Клиент kie.ai. Используем универсальный jobs API:
 *   POST /api/v1/jobs/createTask   — создать задачу
 *   GET  /api/v1/jobs/recordInfo   — узнать статус
 *
 * Документация: https://docs.kie.ai/
 * Если для конкретной модели нужен специфический эндпоинт — поправь
 * `buildInput` ниже под её схему параметров.
 */

const KIE_BASE = "https://api.kie.ai";

export type TaskState =
  | "waiting"
  | "queuing"
  | "generating"
  | "success"
  | "fail"
  | (string & {});

export interface CreateTaskParams {
  apiKey: string;
  kieModel: string;
  prompt: string;
  aspectRatio?: string;
  quality?: string;
  duration?: number;
  imageUrl?: string;
  callBackUrl?: string;
}

export interface KieResponse<T = unknown> {
  code: number;
  msg?: string;
  data: T;
}

export interface CreateTaskData {
  taskId: string;
}

export interface RecordInfoData {
  taskId: string;
  state: TaskState;
  resultJson?: string;
  failMsg?: string;
  failCode?: number;
  /** В реальных ответах часто бывают поля разной формы — оставляем сырыми. */
  [key: string]: unknown;
}

export class KieError extends Error {
  constructor(message: string, public code?: number) {
    super(message);
    this.name = "KieError";
  }
}

export function isTerminalState(state: TaskState): boolean {
  return state === "success" || state === "fail";
}

function buildInput(p: CreateTaskParams): Record<string, unknown> {
  // Дублируем имена в snake_case и camelCase, потому что kie.ai-эндпоинты
  // в разных моделях ожидают по-разному.
  const input: Record<string, unknown> = { prompt: p.prompt };
  if (p.aspectRatio) {
    input.aspect_ratio = p.aspectRatio;
    input.aspectRatio = p.aspectRatio;
  }
  if (p.quality) input.quality = p.quality;
  if (p.duration) input.duration = p.duration;
  if (p.imageUrl) {
    input.image_url = p.imageUrl;
    input.imageUrl = p.imageUrl;
  }
  return input;
}

export async function createTask(params: CreateTaskParams): Promise<CreateTaskData> {
  const body: Record<string, unknown> = {
    model: params.kieModel,
    input: buildInput(params),
  };
  if (params.callBackUrl) body.callBackUrl = params.callBackUrl;

  const res = await fetch(`${KIE_BASE}/api/v1/jobs/createTask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  let json: KieResponse<CreateTaskData>;
  try {
    json = (await res.json()) as KieResponse<CreateTaskData>;
  } catch {
    throw new KieError(`HTTP ${res.status}: bad JSON in response`, res.status);
  }
  if (!res.ok || json.code !== 200) {
    throw new KieError(json.msg || `HTTP ${res.status}`, json.code ?? res.status);
  }
  return json.data;
}

export async function getRecordInfo(taskId: string, apiKey: string): Promise<RecordInfoData> {
  const res = await fetch(
    `${KIE_BASE}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
    {
      headers: { Authorization: `Bearer ${apiKey}` },
    },
  );
  let json: KieResponse<RecordInfoData>;
  try {
    json = (await res.json()) as KieResponse<RecordInfoData>;
  } catch {
    throw new KieError(`HTTP ${res.status}: bad JSON in response`, res.status);
  }
  if (!res.ok || json.code !== 200) {
    throw new KieError(json.msg || `HTTP ${res.status}`, json.code ?? res.status);
  }
  return json.data;
}

/**
 * Достаёт URL медиа из произвольного формата ответа kie.ai.
 * Разные модели возвращают результат по-разному, поэтому пытаемся несколько вариантов.
 */
export function extractMediaUrl(payload: unknown): string | null {
  const visit = (node: unknown, depth = 0): string | null => {
    if (!node || depth > 6) return null;
    if (typeof node === "string") {
      if (/^https?:\/\/.+\.(png|jpe?g|webp|mp4|webm|gif)(\?.*)?$/i.test(node)) {
        return node;
      }
      return null;
    }
    if (Array.isArray(node)) {
      for (const item of node) {
        const found = visit(item, depth + 1);
        if (found) return found;
      }
      return null;
    }
    if (typeof node === "object") {
      const obj = node as Record<string, unknown>;
      const priorityKeys = [
        "video_url", "videoUrl",
        "image_url", "imageUrl",
        "result_url", "resultUrl",
        "url",
        "result_urls", "resultUrls",
        "images", "videos",
        "data", "output", "result", "resultJson",
      ];
      for (const key of priorityKeys) {
        if (key in obj) {
          let value = obj[key];
          if (typeof value === "string" && key === "resultJson") {
            try { value = JSON.parse(value); } catch { /* ignore */ }
          }
          const found = visit(value, depth + 1);
          if (found) return found;
        }
      }
      for (const value of Object.values(obj)) {
        const found = visit(value, depth + 1);
        if (found) return found;
      }
    }
    return null;
  };
  return visit(payload);
}
