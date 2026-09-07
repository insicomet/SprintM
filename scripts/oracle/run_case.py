"""Гипотетический расчёт: подборщик и ведомость пересчитываются LibreOffice,
те же исходные данные прогоняются через приложение, итоги сверяются."""
import json, subprocess, sys, os, math, warnings, openpyxl
warnings.filterwarnings("ignore")

HERE = os.path.dirname(os.path.abspath(__file__))
# строки таблицы саморезов M110:M115 под толщину панели (M103:M109)
SCREW_ROW = {80: 110, 100: 111, 150: 112, 120: 113, 200: 114, 250: 115}
# погонный вес квадратной трубы, т/п.м (L83:L86 ведомости)
TUBE_MASS = {"60х3": 0.00525, "80х3": 0.0072, "100х3": 0.009, "120х3": 0.011}
LO = ["soffice", "--headless", "--norestore", "-env:UserInstallation=file:///tmp/lo_prof"]

def recalc(src, dst):
    env = dict(os.environ, HOME="/root")
    subprocess.run(LO + [f"macro:///Standard.Module1.Recalc({src},{dst})"],
                   cwd=HERE, env=env, check=True, capture_output=True, timeout=900)

def app(inputs):
    r = subprocess.run(["npx", "vite-node", "/tmp/hypo_dump.ts", "--", json.dumps(inputs, ensure_ascii=False)],
                       cwd="/home/user/SprintM", capture_output=True, text=True, timeout=600)
    line = [l for l in r.stdout.splitlines() if l.startswith("{")]
    if not line:
        print(r.stdout[-2000:], r.stderr[-2000:]); sys.exit(1)
    return json.loads(line[-1])

def run(case):
    name, inp = case["name"], case["inputs"]
    print(f"\n{'='*72}\n{name}\n{'='*72}")
    print(json.dumps(inp, ensure_ascii=False))

    # --- 1. подборщик -------------------------------------------------
    wb = openpyxl.load_workbook("engine_src.xlsx"); ws = wb["вывод"]
    ws["D2"] = case["engineCity"]; ws["D4"] = inp["span"]; ws["D5"] = inp["length_m"]
    ws["D6"] = inp["height_m"]; ws["D7"] = inp["gammaN"]
    ws["D20"] = inp["roofingType"]; ws["D21"] = inp["deckingMark"]
    ws["D26"] = "есть" if inp["snowGuards"] else "нет"
    ws["D27"] = "есть" if inp["railingPurlin"] else "нет"
    ws["D9"] = inp["framePitchOverride_m"] or None
    o = inp["openings"]
    ws["D60"] = o["gatesCount"]; ws["D61"] = 0; ws["D62"] = o["doorsCount"]
    ws["D64"] = o["windowHeight_m"]; ws["D65"] = o["windowWidth_m"] * o["windowsCount"]; ws["D66"] = 0
    wb.save(f"engine_{name}.xlsx")
    recalc(f"{HERE}/engine_{name}.xlsx", f"{HERE}/out/engine_{name}.xlsx")
    e = openpyxl.load_workbook(f"out/engine_{name}.xlsx", data_only=True)["вывод"]
    eng = {k: e[k].value for k in ["D3","D22","D23","D28","D33","D34","D35","D38","E52","D57","E24","D16","D13"]}
    print("подборщик :", json.dumps(eng, ensure_ascii=False))

    a = app(inp); sel, tr = a["sel"], a["transcribe"]
    print("приложение:", json.dumps(sel, ensure_ascii=False))

    # --- 2. сверка цепочки подбора ------------------------------------
    chain = [
        ("с/в",           eng["D3"],  sel["sv"]),
        ("шаг рам",       eng["D22"], sel["pitch"]),
        ("макс шаг прог", eng["D23"], sel["maxStep"]),
        ("шаг прогонов",  eng["D28"], sel["step"]),
        ("балка",         eng["D33"], sel["beam"]),
        ("колонна",       eng["D34"], sel["column"]),
        ("прогон",        eng["D35"], sel["purlin"]),
        ("болты в раме",  eng["E52"], sel["boltsTotal"]),
        ("вес фасонок",   eng["D57"], sel["gusset"]),
        ("масса прогонов",eng["E24"], sel["purlinMass"]),
        ("распорки",      eng["D38"], sel["strutTube"]),
    ]
    bad_chain = 0
    for label, x, y in chain:
        ok = (abs(x - y) < 1e-6) if isinstance(x, (int, float)) and isinstance(y, (int, float)) else (
            str(x).replace(" ", "") == str(y).replace(" ", ""))
        if not ok: bad_chain += 1
        print(f"  {'✓' if ok else '✗'} {label:15} подборщик={x!r:32} приложение={y!r}")

    # --- 3. ведомость --------------------------------------------------
    wb = openpyxl.load_workbook("bom_src.xlsx"); ws = wb["12м"]
    svA, svB = eng["D3"].split("/")
    edits = {
        "C5": int(svA), "D5": int(svB), "B6": case["engineCity"], "G5": case["tz"],
        "C8": inp["span"], "C9": inp["length_m"], "C10": inp["height_m"], "C11": sel["pitch"],
        "E14": inp["roofPanel_mm"], "E15": inp["wallPanel_mm"],
        "B21": eng["D33"], "E21": tr["beamPrice"], "H21": tr["beamMass"],
        "B22": eng["D34"], "E22": tr["columnPrice"], "H22": tr["columnMass"],
        "B24": tr["purlinProfileName"], "E24": tr["purlinProfilePrice"], "H24": tr["purlinProfileMass"],
        "C24": f'={sel["lines"]//2}*2*2*C9+2*C9*{(1 if inp["snowGuards"] else 0)+(1 if inp["railingPurlin"] else 0)}',
        "I141": sel["lines"],
        "C78": f'=(2*C9/1.4)*{1 if inp["snowGuards"] else 0}',
        "C85": f'=K90*{round(tr["screwRate"])}',
        "O88": f'=({eng["E52"]}+{case["boltCoef"]}*(K90-2)/K90+12*8/K90+12*2/K90)',
        "M87": eng["D57"],
        "L92": f'=SQRT({inp["span"]/4}*{inp["span"]/4}+O90*O90)',
        # погонный вес трубы распорок числом; само сечение выдаёт подборщик (вывод!D38)
        "C96": f'=(4*(C10+0.5)*J87+{TUBE_MASS[eng["D38"]]}*K95*C9'
               f'+(8*2)*L92*L85*1.1+(2*2)*L93*L85*1.1)+{inp["extraTubeMass_t"]}+J85*L156',
        # уклон кровли: подборщик даёт 6° при пролёте >21 м, в шаблоне вбито 15°
        "J14": f'={6 if inp["span"] > 21 else 15}*3.14/180',
        "K95": inp["tubeStrutCount"],
        "L156": f'=2*({o["windowWidth_m"]}+K160)*L160',
        "J160": o["windowWidth_m"], "K160": o["windowHeight_m"], "L160": o["windowsCount"],
        "J161": 1, "K161": 2, "L161": 0,
        "J162": o["doorWidth_m"], "K162": o["doorHeight_m"], "L162": o["doorsCount"],
        "J163": o["gateWidth_m"], "K163": o["gateHeight_m"], "L163": o["gatesCount"],
        "C102": (f'=((C8+C9)*2*(C10)+C8*2*2)'
                 f'-{o["windowsCount"]}*{o["windowWidth_m"]}*{o["windowHeight_m"]}'
                 f'-{o["doorsCount"]}*{o["doorWidth_m"]}*{o["doorHeight_m"]}'
                 f'-{o["gatesCount"]}*{o["gateWidth_m"]}*{o["gateHeight_m"]}'),
        "E102": tr["wallPanelPrice"], "H102": tr["wallPanelMass"], "B102": f'СП {inp["wallPanel_mm"]}',
        "E138": tr["roofPanelPrice"], "H138": tr["roofPanelMass"], "B138": f'СП {inp["roofPanel_mm"]}',
        # саморез крепления панели — строка таблицы M110:M115 под толщину
        "B103": f'=M{SCREW_ROW[inp["wallPanel_mm"]]}', "E103": f'=N{SCREW_ROW[inp["wallPanel_mm"]]}',
        "B139": f'=M{SCREW_ROW[inp["roofPanel_mm"]]}', "E139": f'=N{SCREW_ROW[inp["roofPanel_mm"]]}',
    }
    for k, v in edits.items(): ws[k] = v
    wb.save(f"bom_{name}.xlsx")
    recalc(f"{HERE}/bom_{name}.xlsx", f"{HERE}/out/bom_{name}.xlsx")
    v = openpyxl.load_workbook(f"out/bom_{name}.xlsx", data_only=True)["12м"]

    bad = 0
    print("  ведомость:")
    for cell in ["F32","F44","F70","F81","F100","F114","F147","F82","F148","F149","F151","F154"]:
        p, x = a["totals"].get(cell), v[cell].value
        if p is None or x is None:
            print(f"    ? {cell}: app={p} xls={x}"); bad += 1; continue
        ok = abs(p - x) <= max(0.005, abs(x) * 1e-9)
        if not ok: bad += 1
        print(f"    {'✓' if ok else '✗'} {cell:5} app={p:>18,.4f}  xls={x:>18,.4f}"
              + ("" if ok else f"   Δ={p-x:,.4f}"))
    print(f"  ИТОГ: цепочка подбора — {bad_chain} расхождений, ведомость — {bad} расхождений")
    return bad_chain + bad

if __name__ == "__main__":
    cases = json.load(open(sys.argv[1]))
    total = sum(run(c) for c in cases)
    print(f"\n{'='*72}\nВСЕГО РАСХОЖДЕНИЙ: {total}")
