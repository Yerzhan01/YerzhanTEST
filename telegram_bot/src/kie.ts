/**
 * Клиент kie.ai. Сверено с актуальным SDK @felores/kie-ai-mcp-server@3.2.1
 * (декабрь 2024) и docs.kie.ai. У kie.ai два эндпоинт-семейства:
 *
 *   "jobs" — POST /api/v1/jobs/createTask           { model, input: {...}, callBackUrl }
 *            GET  /api/v1/jobs/recordInfo?taskId=
 *            используется: Nano Banana, Kling, GPT Image 2, и большинство market-моделей
 *
 *   "veo"  — POST /api/v1/veo/generate              { prompt, model, aspectRatio, ... }   ← плоское!
 *            GET  /api/v1/veo/record-info?taskId=
 *            используется: Veo 3 / Veo 3 Fast
 *
 * Все запросы: Authorization: Bearer <KIE_API_KEY>.
 *
 * ВАЖНЫЕ нюансы (учтены в адаптерах):
 *   - Veo body — поля плоские; aspect_ratio в SNAKE_CASE (по докам), а
 *     imageUrls / callBackUrl / enableFallback / enableTranslation в camelCase.
 *   - Nano Banana требует input.image_input (пустой массив [] для text-to-image).
 *   - Kling: duration — СТРОКА ("5"/"10"), mode = "std"|"pro" вместо quality.
 *   - GPT Image 2: model "gpt-image-2-text-to-image" / "gpt-image-2-image-to-image",
 *                  параметр aspect_ratio (snake), опц. resolution "1K"|"2K"|"4K".
 *   - Status response (jobs+veo одинаково): data.state lowercase, data.resultJson — JSON-строка.
 *   - Veo callback дополнительно кладёт data.resultUrls / data.originUrls напрямую.
 */

const KIE_BASE = "https://api.kie.ai";

export type ModelFamily = "jobs" | "veo";

export type TaskState =
  | "waiting"
  | "queuing"
  | "generating"
  | "success"
  | "fail"
  | (string & {});

export interface CreateTaskParams {
  apiKey: string;
  family: ModelFamily;
  /** Идентификатор модели в kie.ai (значение поля `model` в теле запроса). */
  kieModel: string;
  prompt: string;
  /** Соотношение сторон, например "16:9". */
  aspectRatio?: string;
  /** Для kling: "std"|"pro" (мапится в `mode`). Для прочих jobs-моделей пробрасывается как `quality`. */
  quality?: string;
  /** Для kling: число секунд (3-15); адаптер сериализует в строку. */
  duration?: number;
  /** Опциональная картинка-вход (image-to-video / edit-режимы / motion-control). */
  imageUrl?: string;
  /** Опциональное видео-вход (для Kling motion-control). */
  videoUrl?: string;
  callBackUrl?: string;
}

export interface NormalizedStatus {
  taskId: string;
  state: TaskState;
  resultUrls: string[];
  failMsg?: string;
}

export class KieError extends Error {
  constructor(message: string, public code?: number, public responseBody?: string) {
    super(message);
    this.name = "KieError";
  }
}

export function isTerminalState(state: TaskState): boolean {
  const s = String(state).toLowerCase();
  return s === "success" || s === "fail";
}

export function isSuccess(state: TaskState): boolean {
  return String(state).toLowerCase() === "success";
}

// =========================================================================
// Адаптеры по семействам
// =========================================================================

interface Adapter {
  createPath: string;
  statusPath: string;
  buildBody(p: CreateTaskParams): Record<string, unknown>;
  parseStatus(data: any): NormalizedStatus;
}

const adapters: Record<ModelFamily, Adapter> = {
  jobs: {
    createPath: "/api/v1/jobs/createTask",
    statusPath: "/api/v1/jobs/recordInfo",
    buildBody(p) {
      // === Особый случай: Kling Motion Control — у него своя схема input ===
      if (isKlingMotionControl(p.kieModel)) {
        const input: Record<string, unknown> = {
          prompt: p.prompt,
          input_urls: p.imageUrl ? [p.imageUrl] : [],
          video_urls: p.videoUrl ? [p.videoUrl] : [],
          mode: p.quality || "720p",          // "720p" | "1080p"
          character_orientation: "image",
          background_source: "input_video",
        };
        const body: Record<string, unknown> = { model: p.kieModel, input };
        if (p.callBackUrl) body.callBackUrl = p.callBackUrl;
        return body;
      }

      const input: Record<string, unknown> = { prompt: p.prompt };

      if (p.aspectRatio) input.aspect_ratio = p.aspectRatio;

      // === Nano Banana: image_input — обязательное поле, даже пустой массив ===
      if (isNanoBanana(p.kieModel)) {
        input.image_input = p.imageUrl ? [p.imageUrl] : [];
      }

      // === Kling text/img-to-video: duration — строка, image_urls для img-to-video ===
      if (isKling(p.kieModel)) {
        if (p.duration != null) input.duration = String(p.duration);
        if (p.imageUrl) input.image_urls = [p.imageUrl];
      } else if (p.duration != null) {
        input.duration = p.duration;
      }

      // === GPT Image 2: input_urls для img-to-img ===
      if (isGptImage2(p.kieModel) && p.imageUrl) {
        input.input_urls = [p.imageUrl];
      }

      // === quality → mode (kling) или просто quality ===
      if (p.quality === "std" || p.quality === "pro") {
        input.mode = p.quality;
      } else if (p.quality) {
        input.quality = p.quality;
      }

      const body: Record<string, unknown> = { model: p.kieModel, input };
      if (p.callBackUrl) body.callBackUrl = p.callBackUrl;
      return body;
    },
    parseStatus(data) {
      return parseStandardStatus(data);
    },
  },

  veo: {
    createPath: "/api/v1/veo/generate",
    statusPath: "/api/v1/veo/record-info",
    buildBody(p) {
      // По docs.kie.ai/veo3-api/generate-veo-3-video поля плоские (без `input`),
      // и кроме aspect_ratio (snake_case) всё остальное — camelCase.
      const body: Record<string, unknown> = {
        prompt: p.prompt,
        model: p.kieModel, // "veo3" | "veo3_fast"
        enableFallback: false,
        enableTranslation: true,
      };
      if (p.aspectRatio) body.aspect_ratio = p.aspectRatio; // SNAKE по докам
      if (p.imageUrl) body.imageUrls = [p.imageUrl];
      if (p.callBackUrl) body.callBackUrl = p.callBackUrl;
      return body;
    },
    parseStatus(data) {
      return parseStandardStatus(data);
    },
  },
};

/** Стандартный парсер статуса для jobs и veo (формат идентичен). */
function parseStandardStatus(data: any): NormalizedStatus {
  const state = String(data?.state ?? "").toLowerCase();
  let resultUrls: string[] = [];

  // Главный путь — поле resultJson в виде JSON-строки.
  const rj = data?.resultJson;
  if (typeof rj === "string" && rj.length > 0) {
    try { resultUrls = collectUrls(JSON.parse(rj)); } catch { /* битый JSON */ }
  }
  // На всякий случай — поищем по всему ответу.
  if (resultUrls.length === 0) resultUrls = collectUrls(data);

  return {
    taskId: String(data?.taskId ?? ""),
    state,
    resultUrls,
    failMsg: data?.failMsg ?? undefined,
  };
}

// =========================================================================
// Публичные функции
// =========================================================================

export async function createTask(p: CreateTaskParams): Promise<{ taskId: string }> {
  const adapter = adapters[p.family];
  const body = adapter.buildBody(p);
  const json = await postJson(adapter.createPath, p.apiKey, body);
  const taskId =
    json?.data?.taskId ??
    json?.data?.task_id ??
    json?.taskId ??
    json?.task_id;
  if (!taskId) {
    throw new KieError(
      `createTask: no taskId in response: ${JSON.stringify(json).slice(0, 300)}`,
    );
  }
  return { taskId: String(taskId) };
}

export async function getStatus(
  family: ModelFamily,
  taskId: string,
  apiKey: string,
): Promise<NormalizedStatus> {
  const adapter = adapters[family];
  const json = await getJson(`${adapter.statusPath}?taskId=${encodeURIComponent(taskId)}`, apiKey);
  const data = json?.data ?? json;
  const status = adapter.parseStatus(data);
  // Диагностика: если задача терминальная но URL не нашёлся — выводим сырой ответ.
  if (isTerminalState(status.state) && status.resultUrls.length === 0) {
    console.log(
      `[kie.getStatus] family=${family} taskId=${taskId} state=${status.state} ` +
        `NO URLS EXTRACTED. raw data=${JSON.stringify(data).slice(0, 2000)}`,
    );
  } else {
    console.log(
      `[kie.getStatus] family=${family} taskId=${taskId} state=${status.state} urls=${status.resultUrls.length}`,
    );
  }
  return status;
}

/** Простейший «пинг» kie.ai — проверяет, что ключ валидный и API отвечает. */
export async function pingApi(apiKey: string): Promise<{ ok: boolean; status: number; body: string }> {
  // Запрос на несуществующий taskId — kie.ai вернёт 200 + code=… с понятным сообщением,
  // а 401/403 поймаем как невалидный ключ.
  const res = await fetch(`${KIE_BASE}/api/v1/jobs/recordInfo?taskId=ping`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const text = await res.text();
  return { ok: res.status < 400, status: res.status, body: text.slice(0, 500) };
}

// =========================================================================
// HTTP helpers
// =========================================================================

async function postJson(path: string, apiKey: string, body: unknown): Promise<any> {
  const res = await fetch(`${KIE_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  return parseKieResponse(res, path);
}

async function getJson(path: string, apiKey: string): Promise<any> {
  const res = await fetch(`${KIE_BASE}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  return parseKieResponse(res, path);
}

async function parseKieResponse(res: Response, path: string): Promise<any> {
  const raw = await res.text();
  let json: any;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new KieError(`HTTP ${res.status} on ${path}: bad JSON`, res.status, raw.slice(0, 300));
  }
  // У kie.ai свой код в теле — даже при HTTP 200 может быть code != 200.
  const code = typeof json?.code === "number" ? json.code : res.status;
  if (!res.ok || (code !== 200 && code !== 0)) {
    throw new KieError(
      json?.msg || json?.message || `HTTP ${res.status}`,
      code,
      raw.slice(0, 300),
    );
  }
  return json;
}

// =========================================================================
// Вспомогательное
// =========================================================================

function isKling(modelId: string): boolean {
  return modelId.toLowerCase().startsWith("kling");
}

function isKlingMotionControl(modelId: string): boolean {
  return modelId.toLowerCase().includes("motion-control");
}

function isNanoBanana(modelId: string): boolean {
  const m = modelId.toLowerCase();
  return m.includes("nano-banana");
}

function isGptImage2(modelId: string): boolean {
  return modelId.toLowerCase().startsWith("gpt-image-2");
}

/**
 * Распознаёт URL как медиа. Поддерживает:
 *  1) URL с расширением в пути: foo.mp4, bar.png?sig=...
 *  2) Signed URLs без расширения, но с типом в query или fragment:
 *     foo?response-content-type=video/mp4
 *  3) URL содержащие ключевые слова kie.ai: /video/, /image/, generated, render
 */
function looksLikeMediaUrl(s: string): boolean {
  if (!/^https?:\/\//i.test(s)) return false;
  const exts = /\.(png|jpe?g|webp|mp4|webm|gif|mov|avi|mkv|m4v)(\?|#|$)/i;
  if (exts.test(s)) return true;
  // signed S3/R2-стайл с типом в content-type
  if (/[?&]response-content-type=(image|video|audio)/i.test(s)) return true;
  // Эвристика: похоже на URL медиа от kie.ai/CDN
  if (/\/(video|image|images|videos|generated|render|output|file|files)\//i.test(s)) {
    // Но не любая ссылка из сети — отсекаем явные не-медиа
    if (/\.(html?|json|txt|xml|css|js)(\?|$)/i.test(s)) return false;
    return true;
  }
  return false;
}

/** Достаёт массив URL медиа из произвольной структуры ответа. */
function collectUrls(node: unknown, depth = 0): string[] {
  if (!node || depth > 6) return [];
  if (typeof node === "string") {
    if (looksLikeMediaUrl(node)) return [node];
    return [];
  }
  if (Array.isArray(node)) {
    const out: string[] = [];
    for (const item of node) out.push(...collectUrls(item, depth + 1));
    return out;
  }
  if (typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const out: string[] = [];
    const priority = [
      "resultUrls", "result_urls",
      "videoUrl", "video_url",
      "imageUrl", "image_url",
      "url",
      "videos", "images",
      "response", "result", "data", "output",
    ];
    for (const key of priority) {
      if (key in obj) out.push(...collectUrls(obj[key], depth + 1));
    }
    if (out.length === 0) {
      for (const value of Object.values(obj)) {
        out.push(...collectUrls(value, depth + 1));
        if (out.length > 0) break;
      }
    }
    return out;
  }
  return [];
}
