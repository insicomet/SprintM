"""Выгрузка данных подбора прогонов из подборщика ИНСИ.

Готовит два файла:
  src/data/purlinCatalog350.json      — банк профилей, сталь МП350
  src/data/purlinCatalog390.json      — банк профилей, сталь МП390
  src/data/deckingSpanCapacity.json   — несущая способность настила по шагу

Источник — лист 'Расчеты 2' (МП350), 'Расчеты МП390 2' (МП390), колонки
SJ (высота группы, только для 2ТПС), SK (профиль), SL (предельный момент,
кН·м при "по умолчанию"), SM (масса 1 п.м, кг) в строках 5..54.
Порядок строк сохраняем: при равных массах исходник берёт первый по
порядку профиль (MATCH без сортировки).

Таблица настила — лист 'вывод', AP10:AZ63 (несущая способность, кН/м²)
против W11:W63 (шаг прогонов, мм).
"""

import json
import os
import openpyxl
import warnings

warnings.filterwarnings("ignore")

ENGINE = os.environ.get(
    "SPRINTM_ENGINE",
    "/root/.claude/uploads/726a18de-9a86-57ac-9d50-9c356d0f76b4/"
    "03f80a5e-____________________________________________________9__12__15__18__21__24_________15.xlsx",
)
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "data")

COL_SJ, COL_SK, COL_SL, COL_SM = 504, 505, 506, 507
FIRST_ROW, LAST_ROW = 5, 54

wb = openpyxl.load_workbook(ENGINE, data_only=True)


def catalog(sheet):
    ws = wb[sheet]
    rows = []
    for r in range(FIRST_ROW, LAST_ROW + 1):
        name = ws.cell(row=r, column=COL_SK).value
        height = ws.cell(row=r, column=COL_SJ).value
        rows.append(
            {
                "профиль": name,
                "пред_момент": ws.cell(row=r, column=COL_SL).value,
                "масса_1м_кг": ws.cell(row=r, column=COL_SM).value,
                # Высота "нашей послойки" проставлена только у 2ТПС —
                # по ней исходник отбирает профиль под толщину утеплителя.
                "высота_послойки_мм": height,
            }
        )
    return rows


def decking_table():
    ws = wb["вывод"]
    marks = [ws.cell(row=10, column=c).value for c in range(42, 53)]
    rows = []
    for r in range(11, 64):
        step = ws.cell(row=r, column=23).value
        caps = [ws.cell(row=r, column=c).value for c in range(42, 53)]
        if step is None or all(c is None for c in caps):
            continue
        rows.append({"шаг_мм": step, "несущая_кПа": dict(zip(marks, caps))})
    return {"марки": marks, "строки": rows}


def write(name, data):
    path = os.path.join(OUT, name)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print("wrote", path)


write("purlinCatalog350.json", catalog("Расчеты 2"))
write("purlinCatalog390.json", catalog("Расчеты МП390 2"))
write("deckingSpanCapacity.json", decking_table())
