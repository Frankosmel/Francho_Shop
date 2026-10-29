#!/usr/bin/env python3
import asyncio, os, re, sys, urllib.parse
from difflib import SequenceMatcher
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ.setdefault("DB_PATH", str(ROOT / "gamestore.db"))
import aiohttp
import config
config.DB_PATH = os.environ["DB_PATH"]
import database as db
db.DB = config.DB_PATH
from modules import settings

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8"
}

def clean(value):
    value = re.sub(r"[\[\(][^\]\)]*[\]\)]", "", value)
    value = re.sub(r"\b(?:steam|global|cdkey|key|code|latam|mena|europe|eu|us|usa|br|brazil|indonesia|turkey|tr|cis|ru|row)\b", "", value, flags=re.I)
    return re.sub(r"\s+", " ", value).strip(" -")[:100]

def similar(a, b):
    a_clean = re.sub(r"[^a-z0-9]+", "", a.lower())
    b_clean = re.sub(r"[^a-z0-9]+", "", b.lower())
    if not a_clean or not b_clean:
        return False
    return a_clean in b_clean or b_clean in a_clean or SequenceMatcher(None, a_clean, b_clean).ratio() >= .40

async def fetch_steam_image(session, query):
    try:
        url = f"https://store.steampowered.com/api/storesearch/?term={urllib.parse.quote(query)}&l=spanish&cc=US"
        async with session.get(url, headers=HEADERS, timeout=aiohttp.ClientTimeout(total=8)) as resp:
            if resp.status == 200:
                data = await resp.json(content_type=None)
                items = data.get("items") or []
                for item in items:
                    name = item.get("name") or ""
                    app_id = item.get("id")
                    if app_id and similar(query, name):
                        return f"https://cdn.cloudflare.steamstatic.com/steam/apps/{app_id}/header.jpg"
    except Exception:
        pass
    return None

async def fetch_rawg_image(session, query, rawg_key):
    if not rawg_key:
        return None
    try:
        url = "https://api.rawg.io/api/games"
        params = {"key": rawg_key, "search": query, "search_precise": "true", "page_size": 1}
        async with session.get(url, params=params, headers=HEADERS, timeout=aiohttp.ClientTimeout(total=8)) as resp:
            if resp.status == 200:
                data = await resp.json(content_type=None)
                results = (data.get("results") or [{}]) if isinstance(data, dict) else []
                if results and isinstance(results[0], dict):
                    res = results[0]
                    name = res.get("name") or ""
                    image = res.get("background_image")
                    if image and similar(query, name):
                        return image
    except Exception:
        pass
    return None

async def sync_rawg_images_for_catalog(target_type=None):
    key = (await settings.get("rawg_api_key", "")).strip() or os.getenv("RAWG_API_KEY", "").strip() or "30ba49812fc946db9b7269acaacd00fc"
    kinds = [target_type] if target_type else ["topup", "gamekey", "giftcard", "manual"]
    rows = []
    for kind in kinds:
        rows.extend(await db.list_fzr_catalog_categories(kind))

    targets = [r for r in rows if not (r.get("image_url") or r.get("mapping_icon_url"))]
    sem = asyncio.Semaphore(10)
    stats = {"targets": len(targets), "resolved": 0, "skipped": 0}

    async with aiohttp.ClientSession() as session:
        async def one(row):
            query = clean(str(row.get("name") or ""))
            if len(query) < 2:
                stats["skipped"] += 1
                return
            async with sem:
                image = await fetch_steam_image(session, query)
                if not image:
                    image = await fetch_rawg_image(session, query, key)
                
                if image:
                    await db.update_fzr_catalog_category_image(row["provider_type"], row["category_id"], image)
                    stats["resolved"] += 1
                else:
                    stats["skipped"] += 1

        await asyncio.gather(*(one(row) for row in targets))
    print(f"Sync complete. Targets: {stats['targets']}, Resolved: {stats['resolved']}, Skipped: {stats['skipped']}")
    return stats

async def main():
    await sync_rawg_images_for_catalog()

if __name__ == "__main__":
    asyncio.run(main())
