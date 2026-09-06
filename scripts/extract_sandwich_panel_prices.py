"""Извлечь цены трёхслойных сэндвич-панелей из прайс-листа ИНСИ.

На листе "СП" два блока с разными наполнителями:
  - столбцы B..F — ГОСТ, минвата 105 кг/м3
  - столбцы H..L — ТУ,  минвата 95 кг/м3

Берём именно блок ТУ: над ним в ячейке H3 стоит пометка автора файла
"Эти применяем в стандартном расчете !", и обе реальные ведомости
ссылаются на него (например "СП 100" -> [2]СП!$I$11 = 2740 руб/м2,
масса 20.1 кг/м2 = L11).
"""

import json
import warnings

import openpyxl

warnings.filterwarnings("ignore")

PRICE_FILE = (
    "/root/.claude/uploads/726a18de-9a86-57ac-9d50-9c356d0f76b4/"
    "5b573ae3-__________________________________.xlsx"
)
OUT = "/home/user/SprintM/src/data/sandwichPanelPrices.json"

# Блок ТУ: H — толщина, I — стеновая Z-lock, J — стеновая SECRET FIX,
# K — кровельная, L — вес.
COL_THICKNESS, COL_Z_LOCK, COL_SECRET_FIX, COL_ROOF, COL_WEIGHT = 8, 9, 10, 11, 12
FIRST_ROW, LAST_ROW = 9, 15


def cell(ws, row, col):
    value = ws.cell(row=row, column=col).value
    # В прайсе отсутствующая позиция помечена текстом "-".
    return value if not isinstance(value, str) else value.strip()


def main():
    wb = openpyxl.load_workbook(PRICE_FILE, data_only=True, read_only=True)
    ws = wb["СП"]

    marker = ws.cell(row=3, column=COL_THICKNESS).value
    print(f"пометка над блоком ТУ (H3): {marker!r}")

    rows = []
    for row in range(FIRST_ROW, LAST_ROW + 1):
        thickness = cell(ws, row, COL_THICKNESS)
        if not isinstance(thickness, (int, float)):
            continue
        rows.append(
            {
                "thickness_mm": thickness,
                "wallPriceZLock": cell(ws, row, COL_Z_LOCK),
                "wallPriceSecretFix": cell(ws, row, COL_SECRET_FIX),
                "roofPrice": cell(ws, row, COL_ROOF),
                "weight_kg_m2": cell(ws, row, COL_WEIGHT),
            }
        )

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"записано позиций: {len(rows)} -> {OUT}")
    for r in rows:
        print(f"  {r['thickness_mm']}мм: Z-lock={r['wallPriceZLock']} "
              f"кровля={r['roofPrice']} вес={r['weight_kg_m2']}")


if __name__ == "__main__":
    main()
