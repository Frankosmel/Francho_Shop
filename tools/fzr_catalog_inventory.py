#!/usr/bin/env python3
"""Generate a read-only FZR catalog inventory for the main Francho Shop migration.

The script never creates provider orders and never exposes the FZR API key. It only
reads FZR catalogs and compares their category names with the current main catalog.
"""

from __future__ import annotations

import asyncio
import json
import re
import sys
import time
from collections import Counter
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from webapp.api import main  # noqa: E402


OUTPUT_DIR = ROOT / "docs"
OUTPUT_JSON = OUTPUT_DIR / "fzr_main_store_inventory.json"
OUTPUT_MD = OUTPUT_DIR / "fzr_main_store_inventory.md"
MAX_PAGES = 20


def text(value: Any) -> str:
    return " ".join(str(value or "").split())


def key(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", " ", text(value).lower()).strip()


def response_items(payload: Any) -> tuple[list[dict[str, Any]], str | None, bool]:
    if not isinstance(payload, dict):
        return [], None, False
    items = payload.get("items") or payload.get("categories") or payload.get("data") or []
    if not isinstance(items, list):
        items = []
    meta = payload.get("meta") if isinstance(payload.get("meta"), dict) else {}
    return [item for item in items if isinstance(item, dict)], meta.get("next_cursor"), bool(meta.get("has_more"))


async def fetch_catalog(path: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    cursor: str | None = None
    for _ in range(MAX_PAGES):
        params: dict[str, str] = {"limit": "500", "include_ui": "1"}
        if cursor:
            params["cursor"] = cursor
        payload = await main.fzr_cards.request("GET", path, params=params)
        items, cursor, has_more = response_items(payload)
        rows.extend(items)
        if not has_more or not cursor:
            break
    return rows


def category_id(row: dict[str, Any]) -> str:
    return text(row.get("id") or row.get("category_id") or row.get("slug") or row.get("code"))


def category_name(row: dict[str, Any]) -> str:
    return text(row.get("name") or row.get("title") or row.get("display_name") or category_id(row))


def main_catalog_summary(products: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for product in products:
        game = main.detect_game(product)
        grouped.setdefault(game, []).append(product)
    return [
        {
            "game_name": game,
            "products": len(items),
            "normalized": key(game),
        }
        for game, items in sorted(grouped.items(), key=lambda item: key(item[0]))
    ]


def candidate_matches(category: dict[str, Any], games: list[dict[str, Any]]) -> list[str]:
    cat_key = key(category["name"])
    cat_tokens = {token for token in cat_key.split() if len(token) >= 3}
    matches: list[tuple[int, str]] = []
    for game in games:
        game_key = game["normalized"]
        game_tokens = {token for token in game_key.split() if len(token) >= 3}
        score = len(cat_tokens & game_tokens)
        if cat_key and (cat_key in game_key or game_key in cat_key):
            score += 3
        if score:
            matches.append((score, game["game_name"]))
    matches.sort(key=lambda item: (-item[0], item[1]))
    return [name for _, name in matches[:5]]


async def build_inventory() -> dict[str, Any]:
    sources = {
        "topup": "/api/v2/topups",
        "giftcard": "/api/v2/giftcards",
    }
    result: dict[str, Any] = {
        "generated_at": time.time(),
        "mode": "read_only",
        "sources": {},
        "main_catalog": [],
    }

    current_products = await main.db.get_cached_products(include_hidden=True)
    games = main_catalog_summary(current_products)
    result["main_catalog"] = games

    for provider_type, path in sources.items():
        rows = await fetch_catalog(path)
        categories = []
        for row in rows:
            item = {
                "provider_type": provider_type,
                "category_id": category_id(row),
                "name": category_name(row),
                "available": row.get("available"),
                "image_url": row.get("image_url") or row.get("imageurl") or row.get("icon_url") or "",
            }
            item["main_catalog_candidates"] = candidate_matches(item, games)
            categories.append(item)
        result["sources"][provider_type] = {
            "path": path,
            "categories": sorted(categories, key=lambda item: key(item["name"])),
        }

    result["summary"] = {
        "main_games": len(games),
        "fzr_categories": sum(len(source["categories"]) for source in result["sources"].values()),
        "by_source": {name: len(source["categories"]) for name, source in result["sources"].items()},
    }
    return result


def markdown(inventory: dict[str, Any]) -> str:
    summary = inventory["summary"]
    lines = [
        "# FZR Main Store Catalog Inventory",
        "",
        "This report is generated in read-only mode. It does not create orders or alter the public catalog.",
        "",
        "## Summary",
        "",
        f"- Main catalog games: {summary['main_games']}",
        f"- FZR categories discovered: {summary['fzr_categories']}",
        "",
        "## FZR Categories",
        "",
    ]
    for source_name, source in inventory["sources"].items():
        lines.extend([f"### {source_name}", "", "| FZR category | ID | Main catalog candidates |", "| --- | --- | --- |"])
        for category in source["categories"]:
            candidates = ", ".join(category["main_catalog_candidates"]) or "Manual review required"
            lines.append(f"| {category['name']} | `{category['category_id']}` | {candidates} |")
        lines.append("")
    lines.extend([
        "## Next Decision",
        "",
        "Each candidate must be reviewed for region, offer denomination, required fields and a controlled purchase before it is activated for customers.",
    ])
    return "\n".join(lines) + "\n"


async def run() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    inventory = await build_inventory()
    OUTPUT_JSON.write_text(json.dumps(inventory, ensure_ascii=True, indent=2) + "\n")
    OUTPUT_MD.write_text(markdown(inventory))
    print(json.dumps(inventory["summary"], ensure_ascii=True))
    print(OUTPUT_JSON)
    print(OUTPUT_MD)


if __name__ == "__main__":
    asyncio.run(run())
