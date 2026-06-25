import asyncio
import csv
import json
from pathlib import Path

from buffpin_client import BuffPinClient


def pick(item, *names, default=""):
    for name in names:
        if name in item and item[name] is not None:
            return item[name]
    return default


async def main():
    client = BuffPinClient()

    try:
        print("Consultando catálogo vivo de BuffPin...")
        products = await client.get_all_products()
        print(f"Productos recibidos: {len(products)}")

        json_path = Path("buffpin_live_catalog.json")
        csv_path = Path("buffpin_live_catalog.csv")

        json_path.write_text(
            json.dumps(products, ensure_ascii=False, indent=2),
            encoding="utf-8"
        )

        rows = []
        for item in products:
            rows.append({
                "product_id": pick(item, "priceGroupGoodsId", "id", "goodsId", "productId"),
                "product_name": pick(item, "goodsName", "goods_name", "name", "title"),
                "type": pick(item, "type", "goodsType", "category"),
                "provider_price": pick(item, "payPrice", "pay_price", "price", "costPrice"),
                "currency": pick(item, "costCurrency", "cost_currency", "currency"),
                "status": pick(item, "status", "state", "isAvailable", "available"),
                "platform_config": json.dumps(
                    pick(item, "platformConfig", "platform_config", "rechargePlatformConfig", default={}),
                    ensure_ascii=False
                ),
                "raw_json": json.dumps(item, ensure_ascii=False),
            })

        with csv_path.open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=[
                "product_id",
                "product_name",
                "type",
                "provider_price",
                "currency",
                "status",
                "platform_config",
                "raw_json",
            ])
            writer.writeheader()
            writer.writerows(rows)

        print(f"JSON guardado en: {json_path.resolve()}")
        print(f"CSV guardado en: {csv_path.resolve()}")

    finally:
        await client.close()


if __name__ == "__main__":
    asyncio.run(main())
