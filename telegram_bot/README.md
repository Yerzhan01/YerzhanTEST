# Telegram Bot ↔ kie.ai (Cloudflare Workers)

Простой Telegram-бот для генерации картинок и видео через [kie.ai](https://kie.ai):
**Nano Banana, GPT Image, Veo 3, Kling**. Деплой — на бесплатный Cloudflare Workers.

## Архитектура

```
User → Telegram → Worker (/webhook) ──► kie.ai (createTask + callBackUrl)
                          ↓
                    KV (TASKS)
                          ↑                ┌── путь A: kie.ai callback
                          │                │
                          └────────────────┤── путь B: cron каждую минуту
                                           │
                                           └── путь C: кнопка "🔄 Проверить"
                          ↓
                  Telegram → User
```

Все шаги выбора (модель → версия → формат → качество → длительность → промпт)
делаются inline-кнопками. Состояние пользователя и список ожидающих задач
хранятся в Workers KV.

Доставка результата надёжная по трём путям — даже если kie.ai callback
потеряется, cron всё равно дотянет результат, и пользователь может ткнуть
"🔄 Проверить" вручную.

---

## 🚀 Установка с нуля (~20 минут)

### 1. Создай Telegram-бота

1. Открой [@BotFather](https://t.me/BotFather)
2. `/newbot` → задай имя и username
3. Сохрани токен вида `1234567890:AAEh...` — это `TELEGRAM_BOT_TOKEN`

### 2. Получи API-ключ kie.ai

1. Зарегистрируйся на [kie.ai](https://kie.ai)
2. В дашборде → API Keys → создай ключ — это `KIE_API_KEY`

### 3. (опционально) Узнай свой Telegram user_id

Открой [@userinfobot](https://t.me/userinfobot) — он покажет твой id.
Понадобится для allowlist (`ALLOWED_USER_IDS`), чтобы бот отвечал только тебе.

### 4. Установи Node.js и Wrangler

```bash
node -v   # нужен Node.js >= 18
npm i -g wrangler
```

### 5. Поставь зависимости

```bash
cd telegram_bot
npm install
```

### 6. Залогинься в Cloudflare

```bash
wrangler login
```

Откроется браузер — подтверди. Аккаунт Cloudflare бесплатный, карта не нужна.

### 7. Создай KV-хранилище

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

### 8. Положи секреты

```bash
wrangler secret put TELEGRAM_BOT_TOKEN     # токен от BotFather
wrangler secret put KIE_API_KEY            # ключ kie.ai
wrangler secret put ALLOWED_USER_IDS       # 123456789  (или 123,456,789 если несколько)
```

(опционально, для безопасности webhook'ов)

```bash
wrangler secret put TELEGRAM_WEBHOOK_SECRET   # любая случайная строка
wrangler secret put KIE_CALLBACK_SECRET       # любая случайная строка
```

### 9. Первый деплой

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

### 10. Подключи webhook к Telegram

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

### 11. Проверь бота

В Telegram открой бота → `/start` → выбери модель → пройди по кнопкам → пришли промпт.

---

## 💬 Команды бота

| Команда | Что делает |
|---|---|
| `/start`, `/menu` | Показать меню моделей |
| `/status` | Список твоих активных задач (id, модель, возраст) |
| `/cancel` | Сбросить текущий выбор |
| `/help` | Краткая справка |

После создания задачи под сообщением появится:
- **🔄 Проверить** — пингануть kie.ai вручную, если хочется получить результат скорее.
- **🗑 Снять с ожидания** — удалить задачу из локального учёта (на kie.ai не отменяет).

---

## 🔐 Allowlist пользователей

Бот «для себя» — поэтому **обязательно задай** `ALLOWED_USER_IDS`,
иначе любой, кто узнает username бота, сможет жечь твой kie.ai-баланс.

```bash
wrangler secret put ALLOWED_USER_IDS
# 123456789                      ← один user
# 123456789,987654321            ← несколько через запятую
```

Если переменная пуста или не задана — бот доступен **всем**.
В таком случае при первом сообщении неизвестного пользователя бот
покажет ему его id, чтобы ты мог быстро добавить его (или нет).

---

## 🔁 Как доставляется результат

Три пути одновременно (не зависят друг от друга):

1. **kie.ai callback** → POST на `/kie-callback` (моментально, как только готово)
2. **Cron каждую минуту** → опрашивает все ожидающие задачи в KV (старше 30 сек) и
   достаёт результат через `recordInfo`
3. **Кнопка 🔄 Проверить** в чате → пинг по запросу пользователя

В `delivery.ts` есть защита от двойной доставки: перед отправкой ещё раз
проверяется, что задача всё ещё в KV.

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
| `src/index.ts` | Worker entry: `/webhook`, `/kie-callback`, cron `scheduled()` |
| `src/bot.ts` | grammY-бот, FSM, обработка кнопок и промпта, allowlist |
| `src/delivery.ts` | Единая логика «достать результат и отправить в Telegram» |
| `src/keyboards.ts` | Inline-клавиатуры |
| `src/session.ts` | Сессии и таски в KV |
| `src/kie.ts` | Клиент kie.ai (`createTask`, `recordInfo`) + парсер ответов |
| `src/config.ts` | Модели, версии, форматы, качества, длительности, цены |
| `wrangler.toml` | Конфиг воркера, KV, cron, observability |

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
поправь `buildInput()` в `src/kie.ts` (например, добавь специфичные поля
для Kling или другие имена параметров).

После генерации kie.ai вызывает `POST WORKER_URL/kie-callback`. Из ответа
извлекается URL медиа (`extractMediaUrl` в `src/kie.ts` пробует кучу
вариантов: `resultUrls`, `videoUrl`, `imageUrl`, и т.п.). Если у тебя URL
не находится — добавь свой ключ в `priorityKeys` там же.

---

## 🛠 Полезные команды

```bash
npm run typecheck   # tsc проверка типов
npm run dev         # локально
npm run deploy      # в прод
npm run tail        # стрим логов прода
```

## 📊 Лимиты бесплатного плана Cloudflare

- 100 000 fetch-запросов в день (≈ всех webhook'ов и callback'ов)
- 1 000 KV writes/day, 100 000 reads/day, 1 000 deletes/day
- Cron-триггеры: безлимитно (запускается каждую минуту = 1440 в день)
- 10 ms CPU per request (subrequest'ы к kie.ai/Telegram не считаются)

Для личного бота этого хватает с огромным запасом.
