import asyncio
import hashlib
import mimetypes
from pathlib import Path
import aiosqlite
import httpx
import database as db
from webapp.api.streamzone_client import streamzone_client

IMAGE_CACHE_DIR = Path("/home/ubuntu/gamestore/data/image_cache")
IMAGE_CACHE_DIR.mkdir(parents=True, exist_ok=True)

async def prewarm():
    print("🚀 Iniciando precalentamiento de caché de imágenes...")
    
    # 1. Obtener URLs de FZR Catalog
    async with aiosqlite.connect(db.DB) as conn:
        conn.row_factory = aiosqlite.Row
        cur = await conn.execute("""
            SELECT DISTINCT COALESCE(NULLIF(m.icon_url, ''), NULLIF(c.image_url, '')) as img
            FROM fzr_catalog_categories c
            LEFT JOIN fzr_catalog_mappings m ON m.provider_type = c.provider_type AND m.category_id = c.category_id
            WHERE c.is_available = 1
        """)
        rows = await cur.fetchall()
        fzr_imgs = [r['img'] for r in rows if r['img']]

    # 2. Obtener URLs de StreamZone
    try:
        sz_prods = await streamzone_client.get_catalog()
        sz_imgs = [p.get('image_url') for p in sz_prods if p.get('image_url')]
    except Exception as e:
        print(f"Aviso StreamZone: {e}")
        sz_imgs = []

    # 3. Iconos populares de SMS / 5sim
    sms_icons = [
        "https://cdn.simpleicons.org/telegram/ffffff",
        "https://cdn.simpleicons.org/whatsapp/ffffff",
        "https://cdn.simpleicons.org/google/ffffff",
        "https://cdn.simpleicons.org/openai/ffffff",
        "https://cdn.simpleicons.org/discord/ffffff",
        "https://cdn.simpleicons.org/instagram/ffffff",
        "https://cdn.simpleicons.org/tiktok/ffffff",
        "https://cdn.simpleicons.org/facebook/ffffff",
        "https://cdn.simpleicons.org/twitter/ffffff",
        "https://cdn.simpleicons.org/uber/ffffff",
        "https://cdn.simpleicons.org/netflix/ffffff",
        "https://cdn.simpleicons.org/steam/ffffff",
        "https://cdn.simpleicons.org/microsoft/ffffff",
        "https://cdn.simpleicons.org/amazon/ffffff"
    ]

    all_urls = list(set([u.strip() for u in (fzr_imgs + sz_imgs + sms_icons) if u and u.strip().startswith("http")]))
    print(f"📦 Total imágenes únicas detectadas: {len(all_urls)}")

    sem = asyncio.Semaphore(15)
    cached_count = 0
    downloaded_count = 0
    failed_count = 0

    async def fetch_and_cache(url: str, client: httpx.AsyncClient):
        nonlocal cached_count, downloaded_count, failed_count
        url_hash = hashlib.sha256(url.encode("utf-8")).hexdigest()
        parsed_ext = Path(url.split("?")[0]).suffix.lower()
        if parsed_ext not in [".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif", ".ico"]:
            parsed_ext = ".webp"

        cached_file = IMAGE_CACHE_DIR / f"{url_hash}{parsed_ext}"
        meta_file = IMAGE_CACHE_DIR / f"{url_hash}.meta"

        if cached_file.exists() and cached_file.stat().st_size > 0:
            cached_count += 1
            return

        async with sem:
            try:
                headers = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
                }
                resp = await client.get(url, headers=headers, timeout=15.0)
                if resp.status_code == 200 and len(resp.content) > 0:
                    cached_file.write_bytes(resp.content)
                    ct = resp.headers.get("content-type") or "image/jpeg"
                    try:
                        meta_file.write_text(ct)
                    except Exception:
                        pass
                    downloaded_count += 1
                else:
                    failed_count += 1
            except Exception:
                failed_count += 1

    limits = httpx.Limits(max_keepalive_connections=20, max_connections=30)
    async with httpx.AsyncClient(limits=limits, follow_redirects=True) as client:
        tasks = [fetch_and_cache(u, client) for u in all_urls]
        await asyncio.gather(*tasks)

    print(f"✅ Precalentamiento completado: {downloaded_count} descargadas, {cached_count} ya estaban en caché, {failed_count} fallidas.")

if __name__ == "__main__":
    asyncio.run(prewarm())
