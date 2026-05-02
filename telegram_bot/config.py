"""
Конфиг моделей kie.ai: версии, форматы, качество, длительность и цены.
Цены примерные — сверяй на https://kie.ai/pricing
"""

# =========================================================================
# NANO BANANA (Google Gemini Image)
# =========================================================================
NANO_BANANA = {
    "title": "🍌 Nano Banana (Google)",
    "description": "Быстрая генерация и редактирование изображений",
    "versions": {
        "nano-banana": {
            "label": "Nano Banana (text → image)",
            "kie_model": "google/nano-banana",
            "price_usd": 0.020,
            "type": "image",
        },
        "nano-banana-edit": {
            "label": "Nano Banana Edit (image → image)",
            "kie_model": "google/nano-banana-edit",
            "price_usd": 0.020,
            "type": "image-edit",
        },
        "nano-banana-upscale": {
            "label": "Nano Banana Upscale",
            "kie_model": "google/nano-banana-upscale",
            "price_usd": 0.030,
            "type": "image-edit",
        },
    },
    "formats": ["1:1", "3:4", "4:3", "9:16", "16:9"],
    "qualities": ["standard"],
}

# =========================================================================
# GPT IMAGE (OpenAI gpt-image-1 / gpt-4o image)
# =========================================================================
GPT_IMAGE = {
    "title": "🎨 GPT Image (OpenAI)",
    "description": "Качественная генерация в стиле GPT-4o",
    "versions": {
        "gpt-image-1": {
            "label": "GPT Image 1",
            "kie_model": "gpt4o-image",
            "price_usd": 0.025,
            "type": "image",
        },
        "gpt-image-2": {
            "label": "GPT Image 2",
            "kie_model": "gpt-image-2",
            "price_usd": 0.040,
            "type": "image",
        },
    },
    "formats": ["1:1", "3:2", "2:3"],
    "qualities": {
        "low": {"label": "Low", "multiplier": 1.0},
        "medium": {"label": "Medium", "multiplier": 1.6},
        "high": {"label": "High (HD)", "multiplier": 2.5},
    },
}

# =========================================================================
# VEO 3 (Google Video)
# =========================================================================
VEO3 = {
    "title": "🎬 Veo 3 (Google Video)",
    "description": "Генерация видео по тексту/картинке",
    "versions": {
        "veo3-fast": {
            "label": "Veo 3 Fast",
            "kie_model": "veo3_fast",
            "price_usd": 0.40,
            "type": "video",
        },
        "veo3-quality": {
            "label": "Veo 3 Quality",
            "kie_model": "veo3",
            "price_usd": 2.00,
            "type": "video",
        },
    },
    "formats": ["16:9", "9:16"],
    "qualities": {
        "720p": {"label": "720p", "multiplier": 1.0},
        "1080p": {"label": "1080p", "multiplier": 1.5},
    },
    "durations": [8],  # Veo 3 — фиксированно 8 секунд
}

# =========================================================================
# KLING (Kling AI Video)
# =========================================================================
KLING = {
    "title": "🐉 Kling Video",
    "description": "Видео из текста или картинки",
    "versions": {
        "kling-v1.6-std": {
            "label": "Kling v1.6 Standard",
            "kie_model": "kling-v1.6-standard",
            "price_per_5s_usd": 0.14,
            "type": "video",
        },
        "kling-v2.1-std": {
            "label": "Kling v2.1 Standard",
            "kie_model": "kling-v2.1-standard",
            "price_per_5s_usd": 0.28,
            "type": "video",
        },
        "kling-v2.1-pro": {
            "label": "Kling v2.1 Pro",
            "kie_model": "kling-v2.1-pro",
            "price_per_5s_usd": 0.56,
            "type": "video",
        },
        "kling-v2.1-master": {
            "label": "Kling v2.1 Master",
            "kie_model": "kling-v2.1-master",
            "price_per_5s_usd": 1.40,
            "type": "video",
        },
        "kling-v3-master": {
            "label": "Kling v3 Master",
            "kie_model": "kling-v3-master",
            "price_per_5s_usd": 1.80,
            "type": "video",
        },
    },
    "formats": ["16:9", "9:16", "1:1"],
    "qualities": ["standard"],
    "durations": [5, 10],
}

MODELS = {
    "nano_banana": NANO_BANANA,
    "gpt_image": GPT_IMAGE,
    "veo3": VEO3,
    "kling": KLING,
}


def calc_price(model_key: str, version_key: str, quality_key: str | None, duration: int | None) -> float:
    """Расчёт примерной стоимости."""
    model = MODELS[model_key]
    version = model["versions"][version_key]

    if "price_per_5s_usd" in version:
        dur = duration or 5
        units = max(1, dur // 5)
        base = version["price_per_5s_usd"] * units
    else:
        base = version["price_usd"]

    if isinstance(model.get("qualities"), dict) and quality_key in model["qualities"]:
        base *= model["qualities"][quality_key]["multiplier"]

    return round(base, 4)
