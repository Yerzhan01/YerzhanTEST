# Telegram Bot ↔ kie.ai (Cloudflare Workers)

Простой Telegram-бот для генерации картинок и видео через [kie.ai](https://kie.ai):
**Nano Banana, GPT Image, Veo 3, Kling**. Деплой — на бесплатный Cloudflare Workers.

Архитектура:

```
User → Telegram → Cloudflare Worker (/webhook) → kie.ai (createTask + callBackUrl)
                            ↓
                       KV (TASKS)
                            ↓
       kie.ai → Worker (/kie-callback) → Telegram → User
```

Все шаги выбора (модель → версия → формат → качество → длительность → промпт)
делаются inline-кнопками. Состояние пользователя хранится в Workers KV.

---

## 🚀 Установка с нуля (~20 минут)

### 1. Создай Telegram-бота

1. Открой [@BotFather](https://t.me/BotFather)
2. `/newbot` → задай имя и username
3. Сохрани токен вида `1234567890:AAEh...` — это `TELEGRAM_BOT_TOKEN`

### 2. Получи API-ключ kie.ai

1. Зарегистрируйся на [kie.ai](https://kie.ai)
2. В дашборде → API Keys → создай ключ — это `KIE_API_KEY`

### 3. Установи Node.js и Wrangler

```bash
node -v   # нужен Node.js >= 18
npm i -g wrangler
```

### 4. Поставь зависимости

```bash
cd telegram_bot
npm install
```

### 5. Залогинься в Cloudflare

```bash
wrangler login
```

Откроется браузер — подтверди. Аккаунт Cloudflare бесплатный, карта не нужна.

### 6. Создай KV-хранилище

```bash
wrangler kv:namespace create TASKS
```

Получишь ответ типа:

```
[[kv_namespaces]]
binding = "TASKS"
id = "abc123def456..."
```

Скопируй `id` и подставь в `wrangler.toml` вместо `REPLACE_WITH_KV_ID`.

### 7. Положи секреты

```bash
wrangler secret put TELEGRAM_BOT_TOKEN
# вставь токен от BotFather и Enter

wrangler secret put KIE_API_KEY
# вставь ключ kie.ai
```

(опционально — для безопасности webhook'ов)

```bash
wrangler secret put TELEGRAM_WEBHOOK_SECRET   # любая случайная строка
wrangler secret put KIE_CALLBACK_SECRET       # любая случайная строка
```

### 8. Первый деплой

```bash
wrangler deploy
```

В выводе увидишь URL вида:

```
https://telegram-kie-bot.YOUR-NAME.workers.dev
```

Открой `wrangler.toml` и впиши этот URL в `WORKER_URL`. Снова задеплой:

```bash
wrangler deploy
```

### 9. Подключи webhook к Telegram

```bash
TG_TOKEN="<твой_телеграм_токен>"
WORKER_URL="https://telegram-kie-bot.YOUR-NAME.workers.dev"

curl "https://api.telegram.org/bot${TG_TOKEN}/setWebhook?url=${WORKER_URL}/webhook"
```

Если задавал `TELEGRAM_WEBHOOK_SECRET`, добавь параметр `&secret_token=ТВОЙ_СЕКРЕТ`.

Проверь:

```bash
curl "https://api.telegram.org/bot${TG_TOKEN}/getWebhookInfo"
```

`url` должен совпадать с твоим воркером.

### 10. Проверь бота

В Telegram открой бота → `/start` → выбери модель → пройди по кнопкам → пришли промпт.

---

## 🔧 Локальная разработка

```bash
cp .dev.vars.example .dev.vars   # вставь свои значения
wrangler dev                     # локальный сервер на http://127.0.0.1:8787
```

Чтобы Telegram дотянулся до локалки — пробрось туннель (cloudflared / ngrok)
и временно сделай `setWebhook` на туннельный URL.

Логи прода:

```bash
wrangler tail
```

---

## 🧩 Что где

| Файл | Назначение |
|---|---|
| `src/index.ts` | Cloudflare Worker entrypoint (`/webhook`, `/kie-callback`) |
| `src/bot.ts` | grammY-бот, FSM, обработка кнопок и промпта |
| `src/keyboards.ts` | Inline-клавиатуры |
| `src/session.ts` | Состояние пользователя и таски в KV |
| `src/kie.ts` | Клиент kie.ai (`createTask`, `recordInfo`) + парсер ответов |
| `src/config.ts` | Модели, версии, форматы, качества, длительности, цены |
| `wrangler.toml` | Конфиг воркера + KV |

---

## 💵 Цены (ориентировочные)

> Реальные тарифы смотри на [kie.ai/pricing](https://kie.ai/pricing) — здесь
> заглушки в `config.ts`, обновляй при изменениях.

- **Nano Banana** — ~$0.020 / картинка
- **GPT Image 1 / 2** — $0.025 – $0.10 / картинка (зависит от качества)
- **Veo 3 Fast** — ~$0.40 / видео 8с (×1.5 для 1080p)
- **Veo 3 Quality** — ~$2.00 / видео 8с
- **Kling v1.6 Standard** — ~$0.14 / 5с
- **Kling v2.1 Standard / Pro / Master** — $0.28 / $0.56 / $1.40 за 5с
- **Kling v3 Master** — ~$1.80 / 5с

---

## ⚠️ Заметки про API kie.ai

Бот шлёт всё через универсальный `POST /api/v1/jobs/createTask` с
`{ model, input: { prompt, aspect_ratio, quality, duration }, callBackUrl }`.

Если для какой-то модели kie.ai требует другую схему параметров —
поправь `buildInput()` в `src/kie.ts` (например, добавь `image_url` для
`*-edit` версий, или специфичные поля для Kling).

После генерации kie.ai вызывает `POST WORKER_URL/kie-callback`. Из ответа
извлекается URL медиа (`extractMediaUrl` в `src/kie.ts` пробует кучу
вариантов: `resultUrls`, `videoUrl`, `imageUrl`, и т.п.).

---

## 🛠 Полезные команды

```bash
npm run typecheck   # tsc проверка типов
npm run dev         # локально
npm run deploy      # в прод
npm run tail        # стрим логов прода
```
