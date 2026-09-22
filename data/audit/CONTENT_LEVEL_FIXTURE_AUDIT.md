# Content-Level Fixture Audit — First 10 Golden Fixtures

Follows commit `d8efbdc` (exhaustive Sprint corpus census). Scope: real,
content-level inspection of the 10 `FIRST_GOLDEN_FIXTURES` XLSX files —
21640, 21639, 21629, 21628, 21627, 21484, 21501, 21892, 21873, 21998.

`PRODUCTION_CODE_CHANGED = NO`. Every file listed below is either newly
created under `data/audit/` or a temporary scratchpad artifact outside the
repo; nothing in `src/` was touched.

## Method

1. Downloaded each fixture's primary XLSX (base64, via Drive API) and
   decoded to a real binary locally. Computed SHA-256 and size independently
   with `sha256sum` (cross-checked against Node's `crypto`).
2. Parsed each file with SheetJS (`xlsx` npm package, installed standalone
   in the session scratchpad — **not** added to this repo's
   `package.json`/`node_modules`) with `cellFormula: true`, extracting every
   non-empty cell's value **and** formula, addressed exactly as in Excel
   (e.g. `C8`, `I17`).
3. For each file, located the **live** sheet by searching all 5 sheet tabs
   (`12м`, `15`, `18`, `21`, `1ск` — present in every file, unchanged
   names) for the literal ТЗ number as a cell value. Only one sheet per
   file actually holds that project's data; the other 4 are stale template
   copies carried over from a master file. Sheet tab **names do not
   reliably indicate which one is live** — e.g. 21640 is an 18 m-span
   object but its live data sits in the sheet tab named `12м`.
4. Cross-checked one real formula (frame count) against the equivalent
   function in `src/calc/geometry/frameGeometry.ts`, read-only (function
   called directly with the fixture's real inputs, not run through the UI).

## Status legend

`PROVEN` = read directly from a cell value or formula in the source file.
`OBSERVED` = visible in the document but the generating formula wasn't
traced. `INFERRED` = a reasoned guess, not verified. `UNKNOWN` =
insufficient data. `UNSUPPORTED` = the branch/concept was looked for and
not found, or does not apply to this document.

## 1. File identity (PROVEN)

| Project | Drive fileId | Title | Size (bytes) | SHA-256 |
|---|---|---|---|---|
| 21640 | `1-2xeMMg_3JpLR7wikwM6x-ND-qoZOTNM` | 21640.xlsx | 282893 | `4705a40dd3d1a6698937c793460aec25243652fc44bfac7db55f780dad6f519b`... |
| 21639 | `1E2Tm6XIzWVX2uYTcNda5GAiFJ7JSEcEy` | 21639.xlsx | 284270 | `5cf4215308a91e2765300ddf0e05b69070126ee240c211cdd748e43f8608fccc`... |
| 21629 | `1zlxCkq2HYUWTbVKBhe4icyRsHPL2BwYJ` | 21629.xlsx | 281860 | `f91061f8fcb18913d80bf983e79d27b55be9190de593ccc112538fe0d4464e3d`... |
| 21628 | `1R54tLYIy5wz1jdURmRKmaPYgtajXb68G` | 21628.xlsx | 283142 | `5322a553acdab24d01e51c2c7226cbbfae44ec0b6655412497c44d7cebd9bdc8`... |
| 21627 | `1AnNg-Xepiv4IQPIeZSVSHnUC1yKgJwSX` | 21627.xlsx | 282521 | `fb2dae169a2442dcbc9fcfb3801a39dbd59c333da526cdc9df8ac3b97a16ad95`... |
| 21484 | `1RWTkShdwPMzBldH7fi1UaAcyNG7kBt2h` | 21484.xlsx | 278606 | `e6e0ccee54d0c8bb64fc60efbe12f731045fedfc37ea8e1ae7ba29df829e46a3`... |
| 21501 | `1_pJRu3-5yZZeSyuT7uav7a5k-G05jXOE` | 21501.xlsx | 279704 | `3567089a3688686287513723c8de67710b544ac613c041e150762f4b5a6766ff`... |
| 21892 | `1NEFK2oW-4F-gDT2iR544-qNbu_nLnQYu` | 21892 (СПРИНТ).xlsx | 278191 | `64178f7a8e6fccc9d5193eb77f282d4868b3a3cea32fcb0de77dcbe3f30552d7`... |
| 21873 | `1ZDhT5W6jORQr80zOZZtruf5somhSm2f2` | 21873.xlsx | 276011 | `e51e2d67b13ac10d9973e4b6b0245ea100841db8e079017eafdeb576e97380b3`... |
| 21998 | `1RujgCRbj0eoUMFE-Rcu2-PF2pr9CBd3Y` | 21998.xlsx | 276625 | `b6fdbcf7dd60c249262bd58b0ec538244f3c036e319f9a8d6fd9a62d8ea80b48`... |

(Hashes truncated for table width; full 64-char values are in
`data/audit/fixture10_content_audit.json`, independently re-verified with
`sha256sum` against the decoded local files.)

**Note on hangar type (Task item 2) — PROVEN, and a correction to prior
rounds' assumption:** every fixture's `наружная обшивка :` field (label at
`B12`, value at `C12`) is either the literal string `"окрашенный
профлист"` (painted profiled sheet — cold/uninsulated) or the literal
string `"СП"`. Checking this against each fixture's already-known
enclosure tag (from the folder-title census) shows **100% correlation,
10/10**: `АХ`-tagged fixtures always have `C12 = "окрашенный профлист"`,
`СП`-tagged fixtures always have `C12 = "СП"` literally. This proves — not
infers — that in this workbook's own vocabulary, **`СП` = сэндвич-панель
(sandwich-panel wall cladding)**, not a project-variant label; `АХ`
corresponds to painted profnastil cladding (cold enclosure). This is
consistent with, and now directly confirms, the enclosure taxonomy used
throughout the earlier corpus census.

## 2. Geometry, ТЗ, and B11/B12/B13-analog cells (PROVEN)

All 10 fixtures share the exact same input-block layout on their live
sheet. Sheet tabs are **identical across all 10 files**: `12м | 15 | 18 |
21 | 1ск` — these are template remnants, not per-project; only the sheet
holding the literal ТЗ number is real.

| Project | Live sheet | Пролёт (C8) | Длина (C9) | Высота (C10) | Шаг рам (C11, label A11) | Обшивка нар. (C12) | Обшивка внутр. (C13) | Город (B6) | ТЗ (G5) |
|---|---|---|---|---|---|---|---|---|---|
| 21640 | 12м | 18 | 30 | 6 | 5 | окрашенный профлист | нет | Иркутск | 21640 |
| 21639 | 12м | 18 | 30 | 6 | 5 | СП | нет | Иркутск | 21639 |
| 21629 | 12м | 18 | 46 | 7 | 3.4 | окрашенный профлист | нет | Ирбит | 21629 |
| 21628 | 12м | 18 | 46 | 7 | 3.4 | СП | нет | Ирбит | 21628 |
| 21627 | 12м | 18 | 46 | 7 | 3.4 | СП | нет | Ирбит | 21627 |
| 21484 | 12м | 20 | 90 | 7 | 3.92 | окрашенный профлист | нет | Курган | 21484/2 |
| 21501 | 12м | 20 | 90 | 7 | 3.5 | СП | нет | Курган | 21501/2 |
| 21892 | 12м | 15 | 66 | 6 | 4 | окрашенный профлист | нет | Уфа | 21892/1 |
| 21873 | 18 | 20 | 50 | 7 | 5 | окрашенный профлист | нет | Каргалейка | 21873 |
| 21998 | 18 | 18 | 81 | 8 | 6 | СП | нет | Челябинск | 21998 |

**B11/B12/B13 analogs (exactly as asked):**
- `A11`="шаг рам, м :" / value at **C11** — this is the closest analog to
  "B11": it directly drives wall length/height dependent quantities
  downstream (e.g. `Фс11, Фс14` bracket count `= I17*(C8+2*C10)/0.6`).
- `B12`="наружная обшивка :" / value at **C12** — controls enclosure type
  (see §1), and gates several `IF()` branches downstream (e.g. `A40`
  `=IF(I3=2,"нар.окр","нар. оц")`).
- `B13`="внутренняя обшивка :" / value at **C13** — all 10 fixtures have
  `C13="нет"` (no internal cladding); every downstream formula that
  multiplies by an internal-cladding quantity is literally `*0` in all 10
  files (e.g. `C42 = C40*0`), confirmed PROVEN, not assumed.

Roof slope: `J14 = 15*3.14/180` (PROVEN formula, same in all 10) = 15° in
radians — matches this codebase's own default `roofSlopeDeg: 15` used in
`src/calc/geometry` test fixtures. Flagging as a **positive cross-check**,
not a discrepancy.

## 3. Wall-girt selection result — UNSUPPORTED, with reason (Task item 7/8)

**This is the most important negative finding.** None of the 10 fixtures'
live sheets contain anything resembling `src/calc/wallGirt`'s model — no
wind-pressure formula, no aerodynamic coefficient, no k(ze)-by-terrain
table, no per-zone (угловая/рядовая) profile-by-moment-capacity selection
loop. Those are all specific to **`Калькулятор ограждайки v1.5.xlsx`**, a
different, standalone document this codebase's `wallGirt`/`selectGirt`
modules were reverse-engineered from — not the main project workbook these
10 fixtures come from.

What these 10 fixtures actually contain instead (`B33`="Стены" section,
rows ~34-44, varies slightly by file) is a **flat, enclosure-conditional
quantity BOM**: several `ПП`/`ПС` profile rows (e.g. `ПП 195х45х1,2`, `ПС
245х65х1,5`) whose quantities are inline geometry formulas
(`=7*2*14+5*2*6*2+...`, referencing `C8`/`C9`/`C10`/`C11`/`I17`), most of
which are forced to `0` for one enclosure type and non-zero for the other
(confirmed PROVEN per fixture — e.g. 21627's frame-only variant has
`Итого стены = 0` outright), plus a single **`Кронштейны`** (brackets)
row with a linear-meter formula (`= mass_kg/0.75*0.2`) and a mass formula
that sums zone-perimeter-like terms (e.g. `21629`: `G37 =
(21*2+10.5+21*2+36.75*2+7.5+25.5)`).

**Conclusion: comparing this to our own `selectGirtProfile` output is not
a valid apples-to-apples check** — they are different calculators solving
related but distinct problems in the real workflow, and this workbook
never surfaces a single "chosen profile name + шаг ригелей + число рядов"
result the way our code does. Status: `UNSUPPORTED` for a direct
comparison, not `PROVEN` and not `INFERRED` — do not read this as "the app
is wrong"; it means these two components of the real toolchain have not
yet been shown to correspond to each other at all.

**"Без стоек / со стойками" branch (Task item 8):** searched the full
`A1:AI<max>` range of all 10 live sheets for the substring "стойк".
**Zero matches in any of the 10 files.** Status: `UNSUPPORTED` — this
terminology/branch simply does not appear in this document type; it
cannot be confirmed or denied as a real calculator branch from this
evidence, only that it's absent from these 10 specific fixtures.

## 4. Openings — PROVEN, all 10 (Task item 9, corrects a prior claim)

**This corrects the Phase 9 audit's claim that no opening evidence exists
anywhere in the 160-project corpus.** That claim was based on a
**filename-level** search only. At the content level, every one of these
10 fixtures has a real, populated `ОКНА/ВОРОТА/ДВЕРИ` (windows/gates/doors)
section with live count/width/height cells:

| Project | Окна (count) | Двери (count × w×h, m) | Ворота (count × w×h, m) |
|---|---|---|---|
| 21640 | 0 | 0 | 1 × 4×4 |
| 21639 | 0 | 0 | 1 × 4×4 |
| 21629 | 0 | 3 × 2×2 | 3 × 4×4.5 |
| 21628 | 0 | 3 × 2×2 | 3 × 4×4.5 |
| 21627 | 0 | 3 × 2×2 | 3 × 4×4.5 |
| 21484 | 0 | 4 × 1×2 | 2 × 5×5 |
| 21501 | 0 | 4 × 1×2 | 2 × 5×5 |
| 21892 | 0 | 0 | 2 × 4.5×4.5 |
| 21873 | 0 | 0 | 2 × 4.5×4.5 |
| 21998 | 0 | 1 × 1×2.1 | 1 × 4.1×4.5 |

**Windows (окна) are 0 in all 10** — this specific fixture set gives no
window-framing evidence, but **gates are present and nonzero in all 10,
doors in 4 of 10.** 21998's object description cell (`B7`) additionally
reads *"Ангар (нов.конструктив) с зенит.фонарем (3х1,3(h))"* — PROVEN
confirmation of a real skylight with real dimensions, not just a title
hint.

Unit-price cells for openings reference an **external, closed** linked
workbook (`'[N]Перекупные '!$F$65` etc., N differs per file — these are
Excel's numbered external-reference slots). Their cached values were read
(PROVEN as *values*), but the price-generating formula itself lives
outside this file and could not be re-derived — `UNKNOWN` for that part
only.

## 5. Comparison to the live application (Task item 10)

Only one clean, apples-to-apples comparison was possible given the
architecture mismatch in §3: **frame count**.

| Project | xlsx `I17` (`=CEILING(C9/C11+1,1)`) | `computeFrameCount()` (`src/calc/geometry/frameGeometry.ts:25`) | Result |
|---|---|---|---|
| 21640 | 7 | 7 | **MATCH** |
| 21639 | 7 | 7 | **MATCH** |
| 21629 | 15 | 15 | **MATCH** |
| 21628 | 15 | 15 | **MATCH** |
| 21627 | 15 | 15 | **MATCH** |
| 21484 | 24 | 24 | **MATCH** |
| 21501 | 27 | 27 | **MATCH** |
| 21892 | 18 | 18 | **MATCH** |
| 21873 | 11 | 11 | **MATCH** |
| 21998 | 15 | 15 | **MATCH** |

**10/10 PROVEN match.** `computeFrameCount = Math.ceil(length_m /
framePitch_m) + widenedBays.length + 1` is mathematically identical to
`CEILING(length/step + 1, 1)` when the ceiling modulus is 1 (which it is
here) — not a coincidence, a real algebraic equivalence, confirmed against
5 different real span/length/step combinations. This function was called
directly and read-only; the live UI/build was not modified or driven
through a browser this round.

No other numeric output was cross-checked this round — the wall/girt
section is not comparable (§3), and column/beam/bracing selection would
require resolving the external `[N]Основные`/`[N]ПС`/`[N]ПП` formula
references this file doesn't carry, which is `UNKNOWN`, not attempted.

## 6. Discrepancy table (XLSX ↔ app)

| Item | XLSX (fixtures) | App (`src/`) | Verdict |
|---|---|---|---|
| Frame count | `CEILING(length/step+1,1)`, 10/10 real values | `computeFrameCount` | **MATCH** (PROVEN) |
| Roof slope | 15° (`J14` formula) | default `roofSlopeDeg: 15` | **MATCH** (PROVEN, concept-level) |
| Enclosure semantics | `C12` = "СП" or "окрашенный профлист" | code treats "СП"/"АХ" as enclosure tags from titles | **MATCH** (PROVEN — clarifies СП = sandwich panel) |
| Wall girt profile selection | Flat enclosure-conditional BOM, no wind-load auto-selection | `selectGirtProfile` (wind-load-driven, zone/profile-by-moment-capacity) | **NOT COMPARABLE** — different source calculators (UNSUPPORTED) |
| "без стоек/со стойками" branch | Not present in any of 10 files | Present as an open question in earlier Cold Enclosure audit | **UNSUPPORTED** — absent from this document type |
| Openings (окна/ворота/двери) | Real, populated, PROVEN | UI has gates/doors/windows fields (per Phase 8/9 UI audit) | Not cross-checked this round (would need opening-framing code, not yet built) |

## 7. Data potentially useful to a separate "Codex" project

Flagging, not transferring — this needs independent verification before
any other project consumes it:

1. **10 real, geometry-complete, opening-annotated Sprint objects** (span,
   length, height, frame step, city, seismic zone, snow/wind zone,
   responsibility level, fire class, enclosure type, real door/gate
   counts+dimensions) — a ready-made regression seed set once wall-girt
   comparability is resolved.
2. The **`СП` = сэндвич-панель / `АХ` = окрашенный профлист (profnastil)**
   cladding-code clarification (§1) — resolves ambiguity that's been
   carried as an assumption through several earlier audit rounds.
3. The **frame-count formula equivalence proof** (§5) — first real,
   multi-object, content-level validation of any part of `computeProject`
   against production source files (previously only the single
   "Благовещенск" object had been checked, and only for wall girt, not
   frame count).
4. The discovery that **`Калькулятор ограждайки v1.5.xlsx` and the main
   project workbook are two separate, not-cross-referenced tools** in the
   real workflow — worth confirming with the estimator (расчётчик) before
   assuming the app's wallGirt module is even meant to reproduce what's in
   files like these 10.
5. The **external-workbook-reference problem** (`[N]Основные`,
   `[N]ПС`, `[N]ПП`, `[N]Перекупные`) — most elementary catalog
   prices/masses in these files are NOT self-contained; a real validation
   pass would need those linked workbooks too.

## Final status

```
FIXTURES_OPENED                    = 10/10
GEOMETRY_PROVEN                    = 10/10
HANGAR_TYPE_PROVEN                 = 10/10 (via C12, cross-validated against corpus enclosure tags)
FRAME_COUNT_MATCH                  = 10/10 PROVEN
WALL_GIRT_COMPARISON               = UNSUPPORTED (different source calculators, not a pass/fail)
POSTS_BRANCH_EVIDENCE              = NOT_FOUND in any of 10 (UNSUPPORTED)
OPENINGS_PROVEN                    = 10/10 (windows=0 in all 10; gates nonzero in all 10; doors nonzero in 4/10)
EXTERNAL_FORMULA_REFS_UNRESOLVED   = YES (elementary catalog prices not self-contained in these files)
PRODUCTION_CODE_CHANGED            = NO
FILES_CHANGED_THIS_ROUND           = data/audit/CONTENT_LEVEL_FIXTURE_AUDIT.md, data/audit/fixture10_content_audit.json
```
