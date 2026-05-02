/**
 * Клиент kie.ai. У kie.ai НЕТ единого универсального эндпоинта для всех моделей —
 * есть три семейства, у каждого своя пара (createPath, statusPath) и своя схема:
 *
 *   1) "jobs"          — Nano Banana, Kling и прочие "market"-модели
 *      POST /api/v1/jobs/createTask   { model, callBackUrl, input: {...} }
 *      GET  /api/v1/jobs/recordInfo?taskId=  → data.state + data.resultJson (string!)
 *
 *   2) "veo"           — Veo 3 / Veo 3 Fast
 *      POST /api/v1/veo/generate      { prompt, model, aspect_ratio, ... }
 *      GET  /api/v1/veo/record-info?taskId=
 *
 *   3) "gpt4o-image"   — gpt4o-image
 *      POST /api/v1/gpt4o-image/generate   { prompt, size, nVariants, ... }
 *      GET  /api/v1/gpt4o-image/record-info?taskId=  → data.status + data.response.resultUrls
 *
 * Все запросы: Authorization: Bearer <KIE_API_KEY>.
 * Источник: https://docs.kie.ai/ — разделы market, veo3-api, 4o-image-api.
 */

const KIE_BASE = "https://api.kie.ai";

export type ModelFamily = "jobs" | "veo" | "gpt4o-image";

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
  /** Идентификатор модели для семейства "jobs". Для "veo"/"gpt4o-image" — служебный. */
  kieModel: string;
  prompt: string;
  aspectRatio?: string;
  /** Для veo: "720p"/"1080p"; для kling: "std"/"pro" (мапится в `mode`). */
  quality?: string;
  duration?: number;
  imageUrl?: string;
  callBackUrl?: string;
}

export interface NormalizedStatus {
  taskId: string;
  state: TaskState;
  resultUrls: string[];
  failMsg?: string;
}

export class KieError extends Error {
  constructor(message: string, public code?: number) {
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
      const input: Record<string, unknown> = { prompt: p.prompt };

      if (p.aspectRatio) input.aspect_ratio = p.aspectRatio;
      if (p.imageUrl) {
        // image-edit / image-to-video используют image_input (nano-banana) или image_urls (kling)
        input.image_input = [p.imageUrl];
        input.image_urls = [p.imageUrl];
      }
      // Kling: duration — строка ("5", "10"); прочие — оставим число.
      if (p.duration != null) {
        input.duration = isKling(p.kieModel) ? String(p.duration) : p.duration;
      }
      // Kling: quality "std"|"pro" мапится на mode.
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
      const state = String(data?.state ?? "").toLowerCase();
      let resultUrls: string[] = [];
      const rj = data?.resultJson;
      if (typeof rj === "string" && rj.length > 0) {
        try {
          const parsed = JSON.parse(rj);
          resultUrls = collectUrls(parsed);
        } catch { /* битый JSON */ }
      }
      if (resultUrls.length === 0) resultUrls = collectUrls(data);
      return {
        taskId: String(data?.taskId ?? ""),
        state,
        resultUrls,
        failMsg: data?.failMsg ?? undefined,
      };
    },
  },

  veo: {
    createPath: "/api/v1/veo/generate",
    statusPath: "/api/v1/veo/record-info",
    buildBody(p) {
      // У veo поля плоские (не вложены в input).
      const body: Record<string, unknown> = {
        prompt: p.prompt,
        model: p.kieModel, // "veo3" | "veo3_fast"
        enableFallback: false,
        enableTranslation: true,
      };
      if (p.aspectRatio) body.aspect_ratio = p.aspectRatio;
      if (p.imageUrl) body.imageUrls = [p.imageUrl];
      if (p.callBackUrl) body.callBackUrl = p.callBackUrl;
      return body;
    },
    parseStatus(data) {
      const state = String(data?.state ?? data?.status ?? "").toLowerCase();
      let resultUrls: string[] = [];
      const rj = data?.resultJson;
      if (typeof rj === "string" && rj.length > 0) {
        try { resultUrls = collectUrls(JSON.parse(rj)); } catch { /* skip */ }
      }
      if (resultUrls.length === 0) resultUrls = collectUrls(data);
      return {
        taskId: String(data?.taskId ?? ""),
        state,
        resultUrls,
        failMsg: data?.failMsg ?? data?.errorMessage ?? undefined,
      };
    },
  },

  "gpt4o-image": {
    createPath: "/api/v1/gpt4o-image/generate",
    statusPath: "/api/v1/gpt4o-image/record-info",
    buildBody(p) {
      const body: Record<string, unknown> = {
        prompt: p.prompt,
        nVariants: 1,
        isEnhance: false,
        enableFallback: false,
      };
      // gpt4o использует поле `size`, не `aspect_ratio`
      if (p.aspectRatio) body.size = p.aspectRatio;
      if (p.imageUrl) body.filesUrl = [p.imageUrl];
      if (p.callBackUrl) body.callBackUrl = p.callBackUrl;
      return body;
    },
    parseStatus(data) {
      // Здесь поле называется status (а не state), и значения в UPPER (SUCCESS/FAIL).
      const raw = String(data?.status ?? data?.state ?? "").toLowerCase();
      // Маппинг UPPER → стандартные lowercase значения
      const state: TaskState =
        raw === "success" ? "success" :
        raw === "fail" || raw === "failed" ? "fail" :
        raw === "generating" || raw === "processing" || raw === "running" ? "generating" :
        raw === "waiting" || raw === "queuing" || raw === "pending" ? "queuing" :
        raw;
      const resultUrls = collectUrls(data?.response) || collectUrls(data);
      return {
        taskId: String(data?.taskId ?? ""),
        state,
        resultUrls: resultUrls ?? [],
        failMsg: data?.errorMessage || data?.failMsg || undefined,
      };
    },
  },
};

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
    throw new KieError(`createTask: no taskId in response: ${JSON.stringify(json).slice(0, 200)}`);
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
  return adapter.parseStatus(json?.data ?? json);
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
  let json: any;
  try {
    json = await res.json();
  } catch {
    throw new KieError(`HTTP ${res.status} on ${path}: bad JSON`, res.status);
  }
  // У kie.ai свой код в теле — даже при HTTP 200 может быть code != 200.
  const code = typeof json?.code === "number" ? json.code : res.status;
  if (!res.ok || (code !== 200 && code !== 0)) {
    throw new KieError(json?.msg || json?.message || `HTTP ${res.status}`, code);
  }
  return json;
}

// =========================================================================
// Вспомогательное
// =========================================================================

function isKling(modelId: string): boolean {
  return modelId.toLowerCase().startsWith("kling");
}

/** Достаёт массив URL медиа из произвольной структуры ответа. */
function collectUrls(node: unknown, depth = 0): string[] {
  if (!node || depth > 6) return [];
  if (typeof node === "string") {
    if (/^https?:\/\/.+\.(png|jpe?g|webp|mp4|webm|gif|mov|avi)(\?.*)?$/i.test(node)) {
      return [node];
    }
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
