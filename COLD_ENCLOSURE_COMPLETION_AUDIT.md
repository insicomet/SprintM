# Cold Enclosure Calculator — Wall Frame & Openings Audit

Scope: audit of `src/calc/wallGirt/*` against the source workbook family
"Калькулятор ограждайки v1.5.xlsx" (and its wall-type variants), to find what's
needed to complete a cold-enclosure (profnastil) BOM beyond the already-proven
wall-girt (обвязка/ригели) calculation. No code was changed and nothing was
committed — this is investigation only, per instruction.

**Read this first:** the source workbook is a 34 MB `.xlsx` file. The two Drive
tools available in this environment cannot read it in full:

- `download_file_content` hard-fails above 10 MB ("File too large for
  download, over limit of 10 MB").
- `read_file_content` (natural-language rendering) silently truncates at
  ~1,000,000 characters. Verified empirically: three separate calls against
  three different file variants (`Калькулятор ограждайки v1.5.xlsx`,
  `...v1.5 торец.xlsx`, `...v1.5 торец продольная.xlsx`) each returned
  essentially the *same* ~998K-character slice, covering only the `Лист1`
  input/output sheet and a partial header of `Расчет Угловая`. None of the
  three renderings contain the strings `фахверк`, `P4`, `ригель верх`,
  `ригель ниж`, `торцев`, `продольн`, `ворота`, `дверь`, `окно`, `остекл`, or
  `ленточн` anywhere.

So for everything below, the evidence comes from three sources, ranked by
reliability:

1. **CSV extracts already produced earlier this session** by direct
   spreadsheet-to-CSV export (`nesushki.csv`, `rt_columns.csv`,
   `filter_tables.csv`, `header_row1.csv`, `header_row6.csv`,
   `awx_bgn_formulas.csv` — all under `/root/.claude/uploads/.../`). These
   contain real formulas/values from the deep calculation sheets and are the
   strongest evidence in this audit.
2. **The existing, already-committed code and its docstrings**
   (`src/calc/wallGirt/*`, `src/calc/facadePost/*`) — written by a prior round
   of this same reverse-engineering effort, with its own citations.
3. **One real project file**, `21604.xlsx` (18×48×7, "Спринт АХ", profnastil
   walls — normal-size file, downloaded and read directly this round).

Where none of these three reach a topic, it is marked `UNKNOWN` or
`NOT_PROVEN` below — not guessed.

---

## 1. Wall girt (обвязка) — current status

Already implemented and validated against the "Благовещенск" reference
(24×24×10.5, terrain "В", γn=0.8): `src/calc/wallGirt/wallGirt.ts`,
`windLoad.ts`, `selectGirt.ts`, `bearingCatalog.ts`, `catalog.ts`. Corner/typical
zone split, row count, bracket count, profile mass, and the full wind-load
chain (`w0 × k(ze) × (1+ζ(ze)) × c × γf`, area-reduction by loaded area,
moment M=q·L²/8, utilization filter, mass-based ranking across a 500–3000mm
step sweep) all match the reference to the values recorded in
`selectGirt.test.ts`. **No changes proposed here** — this audit only adds to
what surrounds it.

## 2. Wall stud semantics (Task 1)

Found **two distinct, unrelated concepts** that both translate to "стойка" in
Russian, plus a third that already exists in the codebase for a different
purpose. Do not conflate them — the source data itself doesn't:

### 2a. "+ стойки" girt-row reinforcement (proven, from `rt_columns.csv`)

The несушки/bank table used by `Расчет Угловая` is **not** 632 rows single
each — it is 632 base rows **plus 232 duplicate rows**, each named
`<same profile> + стойки` (e.g. `]ПП 110x45x1` and `]ПП 110x45x1 + стойки`
both exist), rows 639–870 of that internal table. Every reinforced row carries
`Без стоек = False` and a non-zero `Вес стойки, кг` (28.1–88.4 kg depending on
profile family/size — scales with section size, not with wall dimensions).
The base rows all have `Без стоек = True`, `Вес стойки, кг = 0`.

This is **not** a full-height wall stud spanning floor to eave. Column
header context (`header_row6.csv`: `...,Без стоек,чек,"Вес стойки, кг",...`)
places it directly in the girt-profile row, right next to the profile's own
mass/moment columns — i.e. it's a **local reinforcement bracket/rib welded to
or paired with that specific girt run**, an alternate, heavier configuration
of the *same* girt member that trades one extra part for a smaller/thinner
base profile. `src/data/girtBearingCatalog.json` currently only contains the
632 base rows (`Без стоек=True`); the 232 reinforced rows were never
imported.

**Answer to the multiple choice in Task 3:**

> **B — "профиль работает без промежуточной стойки"** (with the correction
> that "промежуточная стойка" here means a local stiffener on that girt run,
> not a separate wall member). Global toggle `Лист1!W107` ("Без стоек",
> currently `TRUE` in every example seen) filters `getPricedGirtBearingRows()`
> down to the base (unreinforced) rows only — which is exactly what our
> catalog already contains, by omission rather than by an explicit filter.
> **Not A** (studs aren't simply absent — a reinforced alternative exists)
> and **not C** (it's the same calculation scheme, moment/utilization formula
> unchanged — only the row's own mass and price change).

### 2b. Facade post / фахверк (already in the codebase, unrelated module)

`src/calc/facadePost/{postCount,selectFacadePost,catalog}.ts` already model a
**separate structural member**: a full-height vertical post between the main
frame columns, needed when the frame's own column spacing is too wide for the
wall girt spans alone. This is:

- **Count**: `facadePostCount(span)` — a *practical rule* (4 posts ≤18m span,
  6 posts 21–24m), explicitly documented as **not derived from any Excel
  formula** — the module's own comment states a 2026-09-04 full-file search
  for "фах" found no count formula, only a profile-selection column
  (`вывод!D41`).
- **Profile selection**: `selectFacadePost()` uses a simplified single-span
  bending check (M=q·h²/8, constant aerodynamic coefficient 0.8), explicitly
  flagged in its own docstring as **not verified against any real file**
  ("результат стоит считать оценочным до сверки с реальным примером").

This is a pre-existing, independently-flagged gap — this audit did not find
new evidence to close it, and did not need to: it's a different entity from
the wall girt, doesn't touch `Калькулятор ограждайки`, and Task 1 was right
to warn against conflating it with the girt-row reinforcement in 2a.

### 2c. Opening jamb — see §7 (UNKNOWN, tool access blocked).

### 2d. Main frame column — out of scope per the task brief (already solved
elsewhere with legacy parity, per the instructions received).

## 3. Wall stud count (Task 2)

No formula found (see access limitation above), and none of the two
"stud"-like entities in §2 have an independent **count** formula distinct from
what's already implemented:

- The girt-row reinforcement (§2a) doesn't have a "count" of its own — it's a
  per-row alternate to the girt profile itself, quantified the same way girt
  rows are (rows × zone length).
- The facade post count (§2b) already has its answer on file: `MANUAL_INPUT`
  masquerading as a practical rule, not derived from a formula
  (`facadePostCount`, see 2b).

**Classification: `WALL_STUD_COUNT = NOT_PROVEN`** for any *third* concept of
"wall stud" distinct from the two above — no evidence such a thing exists in
what's accessible. If the расчётчик confirms a third entity, this needs a
fresh formula hunt with direct file/CSV access, since the deep sheets are
unreachable via current tools.

## 4. All remaining filters (Task 4)

From `filter_tables.csv` (full contents; matches `selectGirt.ts`'s own
comments exactly — no discrepancy found):

| Filter | Source cell | Allowed values | Default |
|---|---|---|---|
| Вид профиля | `Лист1!V89:W94`, gates on `I7` | ПП=True, ПС=True, ПГССигма=False, ТПП=False, ТПС=False, ТПГС=False | as listed |
| Марка материала | `Лист1!V97:W99`, gates on `Q7` | МП220=True, МП350=True, МП390=True (all allowed) | all True |
| Тип сечения | `Лист1!V102:W105`, gates on `K7` | `]`=True, `][`=True, `[]`=True, `[-]`=True (all allowed) | all True |
| Без стоек (global) | `Лист1!W107`, gates on `S7` | boolean | `True` in every example seen |
| Толщина утепления | `Лист1!B18` → code via `J89:J93`/`L89:L93` | профлист→0, наше 100→100, 150→150, 200→200, 250→250 | — |
| min/max profile height | `Лист1!B33`/`B34` | numeric, mm | unset = no bound |
| coefficient utilization override | `Лист1!B32` | numeric | unset = use profile's own default |

`Вид профиля` and `Тип сечения` are both **wide open** (all currently-modeled
categories allowed) in every real example checked so far — this is why the
code comment in `selectGirt.ts` says the filter was never exercised: nothing
in the evidence available has ever needed it to reject a row. This audit found
no counter-example. **Effect on result if narrowed**: fewer candidate rows in
`getPricedGirtBearingRows()` pre-filter, same downstream algorithm — safe to
add later without restructuring, but there is no confirmed real case where it
changes the outcome.

**Classification: filters — mechanically `PROVEN` (values match code exactly);
effect-on-real-result `NOT_PROVEN`** (never seen to bind).

## 5. 1.0mm ×P4 rule (Task 5)

**UNKNOWN — no new evidence.** Not present in any of the CSV extracts, not in
either 1MB rendering slice, not in the existing code comments beyond the
already-recorded caveat in `selectGirt.ts` ("поправка «×P4»... не
воспроизведена... на проверенном примере не используется"). Per the
instruction not to guess: leaving this exactly as already flagged, with no
regression fixture, because no real example exercising a 1.0mm-thickness
profile was found. If the расчётчик can point to a real object using a 1.0mm
girt profile, that becomes the fixture; without one there's nothing to encode
against.

## 6. Upper/lower girt, TN/TO (Task 6)

**UNKNOWN — no new evidence.** Not present anywhere in the accessible data
(same search as §5). `selectGirt.ts` already flags this as unencountered in
the one validated example. No new real file was found this round that
exercises it.

## 7. Openings (Task 7)

**Largely UNKNOWN via the ограждайка workbook itself** — the deep sheets that
would show jamb/header/sill formulas are unreachable (see top-of-report access
limitation).

One real, load-bearing data point, from `21604.xlsx` (18×48×7, profnastil
walls) — **not** the ограждайка calculator, but the *main frame* ведомость,
sheet "12м", rows 34–35, which carry the girt profile lines directly (unlike
some other real objects where this section is entirely absent and the girt
cost is pasted in as a single "Кронштейны" line — see §1's own docstring
citing the same file for that pattern; both are true of different rows in the
same object):

```
B34 'ПС 145х45х1,5'   C34 '=8*2*12*2'                              => 384   (one zone: 8 rows × 12m × 2)
B35 'ПС 145х45х1,2'   C35 '=7*2*6*2+7*2*10.7*2+5*2*37.3*2'          => 1213.6 (THREE zones: 7×6, 7×10.7, 5×37.3)
```

This is significant: row 35 is not a 2-zone (corner/typical) split like the
model already implemented — it's **three** separately-lengthed segments, each
with its own row count, summed in one literal formula. The three zone
lengths (6, 10.7, 37.3 m) don't correspond to the building's own span/length
(18/48) by any visible rule — they look exactly like the wall-area and
single-slope-height precedents already on file elsewhere in this project:
**hand-assembled per object from a drawing**, most likely because openings
(gates/doors) on that wall split it into three uneven girt runs with
different heights/row counts each, not because of a formula that takes
opening positions as input.

**This directly answers the "не переносить правила openings из frame
calculator" caution**: it doesn't look like there *is* a portable formula to
port, in either direction — the real object's own wall-girt quantity is
manually decomposed by the расчётчик per wall segment, the same way wall area
and (for the single-slope track) column height are.

No jamb/header/sill specific line items were found in `21604.xlsx` distinct
from the girt rows themselves — no evidence of "extra girts around openings"
as a separate, identifiable BOM line in this object. Cannot rule out that
other objects have them; didn't have budget this round to check more than one
cold-enclosure real file end-to-end.

**Classification: `OPENING_FRAMING = NOT_PROVEN`.**

## 8. Long wall vs. end wall (Task 8)

**Partial, file-existence evidence only — not formula-level.** Drive contains
*separate* workbook files per wall type:

- `Калькулятор ограждайки v1.5 торец.xlsx` (end wall)
- `Калькулятор ограждайки v1.5 торец продольная.xlsx` (named oddly — contains
  both words; not resolved which it actually is without deeper access)
- `Подбор ограждайки для торцевых стен.xlsx` (end walls)
- `Подбор ограждайки для продольных стен.xlsx` (side/long walls)

All four are the same ~34MB size and, per the truncation test at the top of
this report, render *identical* first-1MB content regardless of which file is
opened — meaning either (a) they're literally the same base template
differing only in the numbers already filled into `Лист1` for a specific
project, or (b) the differences live deeper in the file, past where the
render tool can reach. Cannot distinguish (a) from (b) with current tools.

The existing code (`WallGirtWallTypeConfig`, `endWalls`/`sideWalls` in
`WallGirtInputs`, `computeWallGirtWallType` called separately for each) already
assumes the **same algorithm, same profile catalog, same corner/typical split**
applies to both wall types, with different geometry inputs
(`cornerZoneLength_m`, `typicalZoneLength_m`, `wallHeight_m`, `postStep_m`)
per type — that's a reasonable structural assumption but it is **not
independently confirmed** that the formulas are identical rather than just
similarly-shaped. `computeProject.ts`'s own comment for `wallGirt` treats
`wallHeight_m` as "для торцевой стены обычно высота конька, для продольной —
высота стены" (eave-height convention differs by wall type) — that part is
already encoded as a documented assumption, not verified against a live end-
wall formula.

**Classification: `NOT_PROVEN`** for "same algorithm confirmed" — it's the
current, reasonable, but unverified assumption already baked into the type
system.

## 9. Tie-break rule (Task 9)

**No new evidence — issue persists exactly as already documented.**
Благовещенск: file picks 1370/1380mm step, code's mass-ranking loop picks
1330mm for both zones. Both land on the same total mass (same row count
doesn't change across that plateau), so the *result* (profile, mass, cost) is
unaffected — only the reported step value differs. Checked `awx_bgn_formulas.csv`
and the fresh renderings for any MATCH/INDEX semantics that would explain a
specific-plateau-member preference (first, last, closest to some default) —
found nothing resolving it. `selectGirt.ts`'s own comment already states this
plainly ("не восстановленное правило разрешения ничьих, не критично"). Leaving
as-is; no fix proposed since guessing a tie-break rule risks being wrong in a
way that's invisible until it silently changes the *wrong* case's answer.

## 10. Bracket cost (Task 10)

**Still UNKNOWN — confirmed again, no new evidence for a resolution.**
`21604.xlsx` row 38 (`Кронштейны`, the bracket line in the *main* ведомость,
not the ограждайка calculator) has formula `=G38/0.75*0.2` with
`G38='=(24+10.5+18+45)*2'` → 195. The four numbers summed in `G38` (24, 10.5,
18, 45) don't match this object's own span/length/height (18/48/7) under any
combination tried — consistent with the already-recorded open question (the
existing `wallGirt.ts` docstring already flags this exact row/file as
unexplained). This is either a copy-paste leftover from a *different* object
(same pattern already seen repeatedly elsewhere in this codebase's history)
or a manually-entered number unrelated to a formula. Either way: **not a
usable price source**. `unitPrice: null` in `zoneItems()` remains correct;
do not substitute an approximate number.

## 11. Real-project validation (Task 11)

**Only one additional real object checked this round** (`21604.xlsx`,
18×48×7, "Спринт АХ", profnastil walls) — budget didn't allow a second within
this pass. Findings from it are folded into §7 and §10 above. It does **not**
independently re-confirm zone pressure / profile / step / rows / brackets /
profile mass against `wallGirt`'s own algorithm, because — as found in §7 —
this object's wall-girt quantities are hand-assembled into 1–3 zones per
wall directly in the *main* ведомость, not run through a visible
corner/typical two-zone calculation the way Благовещенск was. There is
nothing in this file shaped like `selectGirt.ts`'s output to compare against
row-for-row. A genuine second validation object needs one where the
ограждайка calculator's own output sheet (`Лист1`, `Подобранные профили`) is
visible and filled in, the way Благовещенск's was — that means either finding
another such object with the calculator workbook itself attached, or asking
the расчётчик which real project's ограждайка workbook still exists on disk.

**Classification: `COLD_ENCLOSURE_PARITY = PARTIAL`** — the one already-proven
example stands; nothing found this round to add a second confirmed data
point, and nothing found to contradict the existing one either.

## 12. Remaining UNKNOWN (summary)

- 1.0mm ×P4 correction — no formula found (§5).
- Upper/lower girt (TN/TO) additional mass — no formula found (§6).
- Opening jamb/header/sill framing inside the ограждайка calculator — not
  reached; the one real object checked shows hand-assembled zones instead,
  suggesting there may be no portable formula to find (§7).
- Long-wall vs. end-wall formula identity — file-existence evidence only,
  not formula-level (§8).
- Tie-break rule for equal-mass steps — still unresolved (§9).
- Bracket unit cost — still unresolved, and the one real cost line found
  doesn't reconcile with its own object's dimensions (§10).
- A second real, calculator-shaped (not hand-assembled) validation object —
  not found this round (§11).

None of these were guessed at or filled with a plausible-looking default.

## 13. Proposed EnclosureCore contract (architectural sketch only — not
implemented)

This is a *shape* to react to, not a commitment — several of its fields point
at the UNKNOWNs above and would need to stay optional/null until resolved,
the same way `wallGirt`'s bracket `cost` is already `null` on purpose.

```ts
interface ColdEnclosureInput {
  span_m: number;
  length_m: number;
  height_m: number;
  gammaN: number;
  w0_kPa: number;
  terrain: TerrainType;
  wallCladding: { thickness_mm: number; profile: string };
  roofCladding: { thickness_mm: number; profile: string } | null;
  endWalls: WallGirtWallTypeConfig;   // already exists
  sideWalls: WallGirtWallTypeConfig;  // already exists
  openings: OpeningsInput;            // reuse existing shape; do NOT reuse
                                       // its frame-side framing formulas —
                                       // §7 found no evidence they transfer
  facadePosts?: FacadePostConfig;     // already exists, already flagged approximate
}

interface ColdEnclosureResult {
  wallGirts: CladdingSectionTakeoff;      // PROVEN — already exists
  wallStuds: null;                        // NOT_PROVEN as a distinct entity — see §2/§3
  facadePosts: FacadePostLayout | null;   // pre-existing, self-flagged approximate
  openingFraming: null;                   // NOT_PROVEN — see §7
  wallSheet: CladdingSectionTakeoff;      // PROVEN — reuse computeProfnastilWallSection
  roofSheet: CladdingSectionTakeoff | null;
  fasteners: null;                        // not audited this round — out of scope of Tasks 1–11
  brackets: { count: number; mass_kg: number; cost: null }; // cost UNKNOWN — see §10
  trims: null;                            // not audited this round
  totalSteelMass: number;                 // sum of the PROVEN parts only
  claddingMass: number;
}
```

Deliberately **not merged with Core1** (main frame), per instruction — this
would be a sibling aggregator the way `singleSlopeBracing`/`singleSlopeFrameFasteners`
are siblings to the double-slope frame modules, not a modification of them.

## 14. Final classifications

```
WALL_GIRT_PROFILE_SELECTION = PROVEN        (unchanged from before this audit)
WALL_GIRT_STEP_SELECTION    = PROVEN        (unchanged from before this audit)
WALL_STUD_SEMANTICS         = PARTIAL       (§2a proven via rt_columns.csv; §2b already
                                              proven-approximate/pre-existing; §2c/2d untouched)
WALL_STUD_COUNT             = NOT_PROVEN    (§3 — no distinct-from-existing formula found)
WITHOUT_STUDS_FILTER        = PROVEN        (§2a — mechanism, source cells, and effect
                                              on the incushki table are now fully explained)
OPENING_FRAMING             = NOT_PROVEN    (§7 — tool access blocked; one real object
                                              suggests hand-assembly, not a formula)
BRACKET_COST                = UNKNOWN       (§10 — unchanged from before this audit)
COLD_ENCLOSURE_PARITY       = PARTIAL       (§11 — one proven example stands, no second
                                              found this round)
```

---

## 15. SOURCE DATA COMPLETENESS (round 2 — provenance audit)

This section answers the follow-up brief: prove the data pipeline behind §2a
rather than trust `rt_columns.csv` at face value, and quantify exactly what's
missing. Production code was **not** touched (verified: `git status --short`
before/after shows only new files under `data/audit/` and this report).

### 15.1 Local workbook availability (Task 1)

**`FULL_XLSX_LOCALLY_AVAILABLE = NO`.** Filesystem search of `/home`,
`/root/.claude/uploads`, `/tmp/claude-0` (the scratchpad) and a repo-wide
`find` for `*огражд*.xlsx`/`.xlsm` found no copy of `Калькулятор ограждайки
v1.5.xlsx` or its variants anywhere on disk. The only candidate,
`scratchpad/ogr_old.xlsx` (15,087 bytes), is a **corrupted/truncated
download** — `file` reports it as zip data but `zipfile.ZipFile()` and
`unzip -l` both fail with "not a zip file" / "End-of-central-directory
signature not found". At 15KB it is far too small to be the real 34MB
workbook regardless. **`FULL_XLSX_PARSED = NO`** follows directly — there is
nothing valid to parse. Task 2 (sheet inventory via local `openpyxl`) is
therefore **not executable** in this environment; it would require either a
fresh, complete download outside the two size-capped Drive tools, or the
расчётчик providing the file directly.

`src/data/girtBearingCatalog.json` and the identical copy in
`scratchpad/girtBearingCatalog.json` (byte-identical apart from a trailing
newline) are both downstream **build artifacts** of the CSV import, not
independent sources.

### 15.2 rt_columns.csv provenance (Task 3)

| | |
|---|---|
| Path | `/root/.claude/uploads/726a18de-9a86-57ac-9d50-9c356d0f76b4/56537b3b-rt_columns.csv` |
| SHA-256 | `59b746c2d70360255f1f91211c5838343f78e982087d98b21910a8a18718e893` |
| Rows (excl. header) | 864 |
| Columns | `row`, `Профиль (V)`, `Без стоек (R)`, `"Вес стойки, кг (T)"` |
| Row numbers | 7–870 (spreadsheet row numbers, per the `row` column) |
| Source sheet | Not self-declared in the file. Column letters (V, R, T) match `header_row6.csv`'s layout (`R`=`'Без стоек'`, `T`=`'Вес стойки, кг'`, `V`=`'Профиль'`) exactly — same table. Prior session notes (carried into this audit's §2a) place this table inside **`Расчет Угловая`**'s own internal copy of the bank, not the `несушки` master sheet. No extraction script or commit exists to confirm this independently (see 15.6) — this is the best available evidence, not a certainty. |
| Extraction script | None found in `scripts/` or repo history — see 15.6. |
| Git history | No commit references `rt_columns.csv`; it only exists as an upload, never committed. |

No columns beyond these four were captured for this table — critically,
**no `Пред М` / `Масса 1м профиля` / `Масса 1м сечения` / `Масса узловых
сборок` values exist locally for the 232 "+ стойки" rows.** This limits
Task 5 and Task 7 below.

### 15.3 Full bank vs. current JSON (Task 4) — exact counts, not the guessed 232

```
GIRT_BANK_SOURCE_ROWS (rt_columns.csv total)      = 864
  WITHOUT_STUDS_TRUE_ROWS                          = 632
  WITHOUT_STUDS_FALSE_ROWS ("+ стойки")            = 232
GIRT_BANK_PRODUCTION_ROWS (girtBearingCatalog.json) = 632
ROWS_PRESENT_IN_BOTH (TRUE rows matched by name)    = 632  (100% — exact match, 0 missing, 0 extra)
GIRT_BANK_MISSING_ROWS                              = 232  (= all FALSE rows, none partially missing)
```

The hypothesis (~232) turned out to be **exactly right**, but this is now a
calculated fact, not an assumption: every one of the 632 `Без стоек=True` rows
in `rt_columns.csv` has a matching profile name in the production JSON, and
every one of the 632 JSON rows matches a TRUE row — a clean, complete 1:1
correspondence with no partial overlap in either direction. The 232 missing
rows are precisely and only the FALSE ("+ стойки") rows.

Diff artifact written (not wired into production):
**`data/audit/girt_catalog_missing_rows.json`** — all 232 missing rows, each
with its source row number, full profile name, base profile name (suffix
stripped), `Вес стойки, кг`, and whether/how many JSON variants exist for its
base profile. Every row explicitly notes that moment/mass columns are
unavailable for it (see 15.2).

**Unrelated data-quality finding surfaced by this comparison:** the 632
production rows resolve to only **316 unique profile names** — every single
name appears in **exactly 2 rows**, byte-identical in every field (family,
section type, thickness, height, material, insulation, both masses) **except
`пред_момент`** (e.g. `]ПП 110x45x1` has limit moments `0.10872...` and
`0.11959...` under the same name, same everything else). This isn't part of
the "+стойки" question — it's a separate, previously unnoticed ambiguity in
the *base* catalog: any lookup by profile name alone (`findGirtProfile()` in
`catalog.ts`) is picking one of two different limit-moment values with
nothing in the currently-captured schema to say which is correct or why two
exist. Flagging this as a new open question; not investigated further this
round (out of scope of the brief, and the source column that would
disambiguate it — likely something like a snow/wind district or a
"ycatalog=0.95" strength-reduction switch, per a value glimpsed in
`nesushki.csv`'s header rows — was not captured in either accessible CSV or
the truncated renderings).

### 15.4 Pairing analysis (Task 5) — partial

For all 116 base profiles that have a "+ стойки" counterpart, the only
available delta is the added `Вес стойки, кг` (28.1–88.4 kg, scaling with
profile size/family — larger ПГССигма 300×80 sections consistently show the
largest added mass, ~88.4 kg, across all their thickness variants, while
smaller ПП 110×45 sections show ~28.1 kg). **Limit moment, mass-1m-profile,
mass-1m-section, and node-assembly-mass deltas cannot be computed** — those
columns were never captured for the FALSE rows (15.2).

Per instruction, not concluding "local stud" from mass alone. What the
evidence supports:

- **Same profile name is reused verbatim** (`<base> + стойки`), which is
  consistent with option **A** (same profile, added local reinforcement
  mass) rather than **C** (a wholly different section).
- Cannot rule out **B** or **D**: without the moment/mass columns, there is
  no way to confirm whether the reinforced row's *capacity* changes by more
  than what the added mass alone would explain (which would point to a
  genuinely different calculation scheme, not just added weight).

**Classification stays as originally reported in §2a, downgraded from
implied-confidence to explicit: `WITHOUT_STUDS_DATASET_STRUCTURE = PROVEN`
(the row-pairing and filter mechanism), `WITHOUT_STUDS_ENGINEERING_SEMANTICS
= PARTIAL`** (name-based evidence for hypothesis A, no capacity-column
evidence either way, not `UNKNOWN` outright but not fully proven either).

### 15.5 Impact on golden selection (Task 7)

**`MISSING_ROWS_AFFECT_GOLDEN_SELECTION = UNKNOWN` — genuinely, not a
placeholder.** Building an audit-only selector that includes the FALSE rows
requires their `пред_момент`, `масса_1м_профиля_кг`/`масса_1м_сечения_кг`
values to run `selectGirtProfile()`'s own moment/utilization/mass-ranking
logic (`src/calc/wallGirt/selectGirt.ts`) — none of that exists locally
(15.2). Fabricating plausible values (e.g. base mass + `Вес стойки`) to run
the test would produce a number that *looks* like an answer but isn't
evidence — explicitly against this task's own instructions ("Do not select a
classification without direct evidence" / "Do not infer engineering formulas
from downstream BOM alone" carried over from the same spirit). No second
real profnastil object with a *calculator-shaped* output (not hand-assembled
zones — see §7/§11 of the original report) was found either, so there is also
no real-world signal to check against. This blocks Task 7 entirely until the
missing columns are recovered.

### 15.6 Extraction pipeline root cause (Task 8)

No script producing `girtBearingCatalog.json` or `rt_columns.csv` exists in
`scripts/` (only frame/purlin/sandwich-panel/snow-ladder extractors are
there — none touch wall girt) or anywhere in git history (`git log --all
--source -- '*rt_columns*' '*girtBearingCatalog*'` returns only the one
commit that *adds* the finished JSON, `6fb3ab6`). Both files were produced
**out-of-band** (by a spreadsheet-to-CSV export the расчётчик or a prior
session step performed outside this repo) and only their *results* were ever
committed or uploaded — the transformation itself left no trace to inspect.

What *is* provable, from the commit message of `6fb3ab6` itself
("Raw reference data exported from ... sheet «несушки» (A1:U636)"): the
JSON's source was explicitly and deliberately the **`несушки`** sheet, range
**A1:U636** — 636 rows (632 data rows + ~4 header rows), which is the sheet's
own full extent. This was not a truncated export of a larger range; `несушки`
itself apparently only holds 632 base rows. The 232 "+ стойки" rows, per
prior session notes, live in a **different sheet** (`Расчет Угловая`'s own
internal working copy of the bank, extending to row 870) that was never in
scope of that extraction at all.

**Root cause, to the extent provable: "missing source range" is the closest
of the offered options, but more precisely it is a scope choice** — the
`несушки` sheet was extracted completely and correctly for what it contains;
the reinforced variants simply live somewhere else that this repository has
never targeted for extraction. Not a parser limitation, not a deliberate
filter within the extraction itself, and not a data-cleaning error — the 632
rows taken are exactly and only what `несушки` A1:U636 contains.

### 15.7 21604 zoning — re-verified with exact cells (Task 9)

Re-pulled `21604.xlsx` (18×48×7, "Спринт АХ", profnastil walls), sheet
`12м`. Building parameters: `C8`=18 (span), `C9`=48 (length), `C10`=7
(height), `C11`=5.35 (frame pitch).

```
B34: 'ПС 145х45х1,5'   C34: =8*2*12*2                              => 384
B35: 'ПС 145х45х1,2'   C35: =7*2*6*2 + 7*2*10.7*2 + 5*2*37.3*2       => 1213.6
```

Every numeric literal in both formulas (8, 12; 7, 6, 10.7, 37.3, 5) is typed
directly into the formula — **none is a cell reference**, and none matches
`C8`/`C9`/`C10`/`C11` (18/48/7/5.35) under any tried combination (sums,
halves, differences). Row 34 is one zone (8 rows × 12m run, ×2 — likely the
paired-section doubling already modeled in `computeGirtZone`). Row 35 sums
**three** separately-sized zones (7×6, 7×10.7, 5×37.3) in one line — each
with its own row count and run length, none derivable from the building's
own dimensions.

```
21604_ZONING = MANUAL   (both rows are bare typed-in constants; zero formula-derived terms found)
```

This is **one object**, and the instruction not to generalize from it is
followed: **`GENERAL_OPENING_ZONING_RULE = NOT_PROVEN`** — this shows *a*
real object doing manual zoning, not that *all* objects do, and not *why*
(e.g., whether it's driven by opening positions, wall length limits, or
something else). A second real object with visible zone formulas (ideally
one where the zones DO reduce to a clean expression) would be needed to
either generalize this or establish it as case-by-case.

---

## 16. Round-2 final statuses

```
FULL_XLSX_LOCALLY_AVAILABLE        = NO
FULL_XLSX_PARSED                   = NO
GIRT_BANK_SOURCE_ROWS              = 864   (632 TRUE + 232 FALSE, rt_columns.csv)
GIRT_BANK_PRODUCTION_ROWS          = 632
GIRT_BANK_MISSING_ROWS             = 232   (calculated exactly, matches the prior hypothesis)
WITHOUT_STUDS_DATASET_STRUCTURE    = PROVEN
WITHOUT_STUDS_ENGINEERING_SEMANTICS = PARTIAL
MISSING_ROWS_AFFECT_GOLDEN_SELECTION = UNKNOWN   (blocked: moment/mass columns for FALSE rows not available locally)
21604_ZONING                       = MANUAL
GENERAL_OPENING_ZONING_RULE        = NOT_PROVEN
SAFE_TO_IMPORT_MISSING_GIRT_ROWS   = NO    (would add 232 rows with a real profile name and a real
                                             мass delta, but a NULL/fabricated пред_момент — worse
                                             than not importing, since selectGirt.ts would then
                                             either crash on a missing field or silently rank a
                                             row with unknown real capacity; import only once the
                                             full A:U columns for source rows 639-870 are recovered)
PRODUCTION_CODE_CHANGED            = NO
```

New artifact this round: `data/audit/girt_catalog_missing_rows.json`
(232 rows, structure documented in 15.3). Not committed, not wired into any
production import path.

---

## 17. DUPLICATE BEARING ROW SEMANTICS (round 3)

This resolves the "316 duplicated profile keys, differing only in Пред
момент" finding flagged in §15.3 as an open question. It turns out to be
**two different, distinguishable phenomena**, not one — and the mystery is
much smaller than §15.3's headline number suggested.

### 17.1 Exact duplicate key (Task 1)

Grouped all 632 rows of `src/data/girtBearingCatalog.json` by every field
**except** `пред_момент` (вид, тип_сечения, раскреп, толщина_мм,
высота_профиля_мм, к_т_исп_по_умолчанию, материал, толщина_утепления_мм,
профиль, масса_1м_профиля_кг, масса_1м_сечения_кг, масса_узловых_сборок_кг):

```
TOTAL_ROWS            = 632
UNIQUE_KEYS            = 576
KEYS_WITH_1_ROW        = 520
KEYS_WITH_2_ROWS       = 56
KEYS_WITH_MORE_THAN_2  = 0
```

**Correction to §15.3's own framing:** grouping by profile *name* alone (as
§15.3 did) gives 316 "duplicated" names — but that conflates two different
things. Once `материал` is included in the key (it's a real, already-present
field, not a hidden one), only **56** pairs remain genuinely identical in
every captured respect except the moment. The other **260** "duplicate
names" turn out to differ in `материал` (steel grade) — a real, meaningful,
already-captured distinction, not an unexplained duplicate at all. This
lowers the true ambiguous-row count from the previously-implied 316 down to
56 (8.9% of the catalog, not 50%).

### 17.2 Systematic pattern (Task 2)

For **every one** of the 56 same-key pairs, `пред_момент` differs by exactly
**×1.1** (`high / low = 1.1` to full floating-point precision, all 56).
Checked whether this could be section-size-dependent (it isn't — ПП110×45
and ПГССигма300×80 show the identical 1.1 ratio) and whether it correlates
with `материал`: **all 56 pairs share `материал = МП220` and
`к_т_исп_по_умолчанию = 0.85` on both rows** — no visible field explains the
second value.

For the 260 `материал`-differing pairs, the same check was run out of
curiosity (not required by Task 1, but relevant to Task 2's "look for a
pattern" brief): **all 260 also show exactly ×1.1** (МП390 row / МП350 row =
1.1, every time, regardless of section). This is the real headline finding:
**the ×1.1 factor is not specific to the 56 mystery rows — it is the exact
same ratio that separates МП350 from МП390 steel grade everywhere in the
catalog.** That makes "the 56 rows are a further, unlabeled МП220 grade
split that lost its distinguishing column in extraction" a much better
supported hypothesis than treating them as a separate phenomenon — but it
remains a hypothesis, not proof, since no third value or grade label was
found for those 56 profiles anywhere in the accessible data.

### 17.3 Source column recovery (Task 3)

No new column recovered — same access limitation as §15 (no local xlsx, no
extraction script, no commit history beyond `6fb3ab6` which only adds the
finished JSON — see 15.6, unchanged). `материал` itself (МП220/350/390) *is*
already present and correctly captured for the 260 pairs; it simply doesn't
vary for the 56.

### 17.4 Row order (Task 4)

Row-index deltas between paired rows cluster into exactly three values:

```
delta=114: 26 pairs
delta=25:  22 pairs
delta=16:   8 pairs
```

Not adjacent, and not one single repeated block — index 114 lines up with
where the `вид` sequence (ПП→ПС→ПГССигма→ТПП→ТПС→ТПГС) visibly restarts from
`ПП` again inside the raw JSON array (indices 85–113 finish a `ТПП` run,
index 114 begins `ПП` again). This is consistent with the incushki table
being laid out as **repeated per-material or per-batch blocks** rather than
adjacent low/high rows — i.e. whoever built the source sheet appears to have
appended a second full pass over the family list rather than interleaving a
second column next to each row. This matches the МП350/МП390 pattern (two
full passes, second one at higher material grade) better than it matches "a
single extra flag column got lost" — weak additional support for 17.2's
hypothesis, not proof.

### 17.5 Current selector behavior (Task 5) — verified by running the real code

Ran `getPricedGirtBearingRows()` / `resolvePricedProfile()` directly (via
`vite-node`, read-only — no file was modified) against both example pairs:

```
]ПП 145x45x1   (56-group, both МП220):  0.163398 / 0.179738  →  same priced output both times
]ПП 110x45x1,2 (260-group, МП350/МП390): 0.247573 / 0.272330 →  same priced output both times
  resolved profile for BOTH rows of both pairs:
    weightPerMeter_kg = 1.8089, pricePerMeter = 267.75 (for the 110x45x1,2 example)
```

This directly answers Task 5:

- **Both duplicate rows are iterated** — `getPricedGirtBearingRows()`
  filters only on "does a price exist", never deduplicates by name or
  material. Confirmed by reading the filter and by the live run above.
- **`resolvePricedProfile()` cannot distinguish material grade at all** — it
  resolves through `findGirtProfile()` (in `catalog.ts`), whose own
  docstring already states the price catalog deliberately collapses
  П350/П390 into one base "оцинкованный" row ("материал... ни на что не
  влияет... берём один... вариант"). So both rows of a duplicate pair
  produce **byte-identical** `weightPerMeter_kg`/`pricePerMeter` — mass and
  cost in the final BOM are unaffected by which row "wins".
- **Can the higher `Пред момент` row let a profile pass when the lower one
  fails?** Yes — demonstrated with real numbers below (17.6).
- **Can row order change the selected result?** No, in terms of visible
  output (mass/price/profile name) — because the two rows are
  indistinguishable downstream of `resolvePricedProfile()`. It can change
  *which underlying row* silently satisfies the utilization check when
  demand falls between the two moment values, but that's invisible in the
  final BOM, not an order effect on the reported result.

Synthetic demand sweep (audit-only, using the `]ПП 110x45x1,2` pair,
low=0.247573, high=0.272330):

```
demand BELOW both (e.g. 0.20):  both rows pass  → identical output either way
demand BETWEEN (e.g. 0.26):     low row REJECTED (utilization 1.05 > 1)
                                 high row PASSES (utilization 0.955 ≤ 1)
                                 → profile IS selected, silently via the higher-grade row
demand ABOVE both (e.g. 0.30):  both rows rejected → profile excluded entirely, as expected
```

### 17.6 Благовещенск golden case (Task 6)

Found the exact duplicated pair backing the golden fixture's corner-zone
profile, `[]ПП 145x45x1,5`:

```
[]ПП 145x45x1,5:  МП350 → пред_момент = 4.5     МП390 → пред_момент = 4.95
```

The real object's own recorded demand moment for this zone/step is
**4.9399** (already on file from this session's earlier bracing/selectGirt
work — the "AD7 = AD6/X7 = 4.9399/4.95 ≈ 0.998" note). Checked both branches
directly:

```
demand 4.9399 / low  (4.5)  = 1.0978  → REJECTS (>1)
demand 4.9399 / high (4.95) = 0.9980  → PASSES (matches the file's own recorded ≈0.998 exactly)
```

**`BLAGOVESHCHENSK_RESOLVES_DUPLICATE_SEMANTICS = YES`** — and specifically,
it resolves in favor of the **higher (МП390-grade) value being the one the
real ведомость itself used**. The golden fixture sits exactly in the
"straddle zone" from 17.5's synthetic sweep — it is not a case where both
rows happen to agree; the real file's answer only works if the higher value
governs. Current code already reproduces this correctly (per `selectGirt.test.ts`),
but — per 17.5 — it does so by trying every candidate and letting whichever
one passes win, not because it explicitly resolved the material-grade
question. The result matches this golden case, but the mechanism is
opportunistic rather than principled: the code has no notion of "this
demand actually requires МП390-grade steel," it just happens to have a row
available that provides the needed capacity, priced as if it were the
generic (МП350-collapsed) profile.

### 17.7 Real-project cross-check (Task 7)

Not performed this round beyond Благовещенск, for the same reason noted in
§15.5: no second real object with a *calculator-shaped* (not hand-assembled,
§7/§11 of the original report) ограждайка output was located, and finding
one requires the same blocked deep-sheet access as everything else in this
report family. Flagging as **not done**, not as evidence of absence.

### 17.8 Production risk classification (Task 8)

```
CURRENT_SELECTOR_ORDER_DEPENDENT   = NO   (visible BOM output is identical regardless of
                                            which duplicate row satisfies the check)
CURRENT_SELECTOR_CAPACITY_AMBIGUOUS = YES  (which material grade's capacity actually governs
                                            a given selection is undocumented and untracked;
                                            the price/mass shown never reflects which grade
                                            was implicitly required)
```

**Can the current production selector legitimately use both rows without
knowing the discriminator? No — not "legitimately" in the sense of being
principled, though it is not currently *unsafe* in an obviously wrong way
either.** The Благовещенск case shows the emergent behavior (try every
candidate, use whatever passes) happens to match the real file's own answer.
But the underlying issue stands: the tool can silently depend on a specific
steel grade (МП390 over МП350) being available/used, without ever surfacing
that dependency to whoever reads the resulting BOM — the price shown is the
material-agnostic catalog price either way. This is a real, previously
invisible finding, not a hypothetical one; it was not visible until this
round's exact-key analysis separated the "real material distinction" (260
pairs) from the "true unexplained duplicate" (56 pairs) and then traced how
both feed into the same code path identically. **No fix is proposed** — per
instruction, and because the right fix depends on information not available
here (does the price catalog actually vary by material grade in reality, and
if so by how much — a question for the расчётчик, not something to guess).

---

## 18. Round-3 final statuses

```
GIRT_PRODUCTION_ROWS                        = 632
GIRT_UNIQUE_STRUCTURAL_KEYS                 = 576
GIRT_DUPLICATE_KEY_COUNT                    = 56   (of which 260 additional "duplicate names" are
                                                     resolved by материал and are NOT ambiguous)
DUPLICATE_PRED_MOMENT_PATTERN               = PROVEN    (uniform ×1.1 across all 316 name-pairs,
                                                          both the 56 unexplained and 260 material-explained)
DUPLICATE_ROW_ENGINEERING_SEMANTICS         = PARTIAL   (260/316 PROVEN as МП350/МП390 grade pairs;
                                                          56/316 remain unresolved — best-supported
                                                          hypothesis is a lost/uncaptured grade split,
                                                          not confirmed)
CURRENT_SELECTOR_ORDER_DEPENDENT            = NO
CURRENT_SELECTOR_CAPACITY_AMBIGUOUS         = YES
BLAGOVESHCHENSK_RESOLVES_DUPLICATE_SEMANTICS = YES  (real file used the higher/МП390 value; demand
                                                      4.9399 fails against the low value, 1.0978 > 1)
SAFE_TO_CHANGE_SELECTOR                     = NO
SAFE_TO_IMPORT_PLUS_STUD_ROWS               = NO   (unchanged from round 2)
PRODUCTION_CODE_CHANGED                     = NO
```

No files under `src/` were modified this round. Verified with `git status
--short` before and after: only `COLD_ENCLOSURE_COMPLETION_AUDIT.md` and
`data/audit/` remain untracked; nothing else changed.

---

## 19. 1.0 MM / MP220 / P4 LEGACY BRANCH (round 4)

This round found a **new raw column in `nesushki.csv` that was never carried
into `girtBearingCatalog.json`**, and it changes the round-3 conclusion:
the 1.1 factor is not two separate phenomena (56 unexplained + 260
material-explained) — it is **one single mechanism, uniform across all 316
pairs**, and material grade turns out to be a mostly-independent, coincidental
label. This is a genuine correction to §17, not just an addition to it.

### 19.0 SUPERSEDED FINDINGS

**Superseded (§17, round 3):** "260 apparent duplicate keys are legitimate
different material grades (МП350/МП390), and their `Пред момент` values
differ by exactly ×1.1 *because* of the material difference; separately, 56
МП220/1.0mm pairs are an unrelated, unexplained duplication." This framing
treated the 260 and the 56 as two different phenomena, one explained and one
not.

**Replaced by (§19, round 4):** `Пред момент = raw_moment ×
макс_к_т_исп_по_умолчанию × material_coeff`, verified exactly on all 632
rows with no exceptions. `material_coeff` is **0.55 for МП220 and exactly
1.0 for BOTH МП350 and МП390** — material label does not distinguish
МП350 from МП390 at all. The ×1.1 actually lives in `raw_moment`, which is
1.1× higher in the "second block" row of **every one of the 316 name-pairs**
— the 56 МП220 pairs and the 260 material-differing pairs alike, with
identical exactness. Therefore:

- **"MP350 vs MP390 causes the ×1.1 Пред момент difference" — disproven.**
  The material label and the ×1.1 split are two different axes of the same
  underlying table structure that happen to co-occur for 260 of 316
  profiles; the label is not the cause.
- **"MP220 1mm duplicates are a separate, unexplained mechanism" —
  disproven.** They are the identical raw-moment split found everywhere
  else in the catalog; what's still unexplained is narrower — why 260 of
  the 316 splits also carry a material relabel and 56 don't, not why the
  56 differ in the first place.
- **What remains valid, unchanged:** МП350 and МП390 rows are still
  genuinely different, correctly-labeled material records (the field itself
  is accurate) — they just aren't what drives the moment difference.
  `CURRENT_SELECTOR_CAPACITY_AMBIGUOUS = YES` stands, for the same
  underlying reason as before (§17.5/§17.8): `resolvePricedProfile()` still
  can't see whichever field actually matters, whether that's framed as
  material or as the raw-moment branch itself.

No git history was rewritten — this is a forward-only correction, in the
same document, dated by section number.

### FROZEN EVIDENCE (checkpoint, Phase 3)

```
GIRT_PRODUCTION_ROWS              = 632
GIRT_PAIR_COUNT                   = 316
RAW_MOMENT_PAIR_RATIO_1_1         = PROVEN   (all 316 pairs, exact)
PRED_MOMENT_FORMULA               = PROVEN   (raw_moment × к_т_исп × material_coeff, all 632 rows)
MATERIAL_COEFFICIENT_MP220        = 0.55
MATERIAL_COEFFICIENT_MP350        = 1.0
MATERIAL_COEFFICIENT_MP390        = 1.0
MP220_1MM_SEPARATE_MECHANISM      = DISPROVEN
CAPACITY_BRANCH_EXISTS_ALL_PAIRS  = PROVEN
CAPACITY_BRANCH_ENGINEERING_SEMANTICS = UNKNOWN   (numeric mechanism proven; the underlying
                                                    engineering reason for two raw-moment blocks
                                                    per profile — e.g. two restraint schemes, two
                                                    calc methods, or something else — is not
                                                    recovered from source and is not guessed here)
CURRENT_SELECTOR_CAPACITY_AMBIGUOUS = YES
SAFE_TO_CHANGE_SELECTOR           = NO
SAFE_TO_IMPORT_PLUS_STUD_ROWS     = NO
```

**Naming note for future schema/contract work:** until the engineering
semantics above are actually proven from source, any future field for this
should use a neutral name — `sourceBlock`, `capacityBranch`, or
`rawMoment` — not `r350r390` or similar. The material-grade correlation is
real for 260/316 profiles but is not the mechanism, and naming a schema
field after it would misrepresent what's actually known.

### 19.1 The 56 pairs, enumerated (Task 1)

Full machine-readable table: **`data/audit/mp220_1mm_pairs.json`** (56
entries, every field from `girtBearingCatalog.json` plus source row indices,
row delta, and both moment values).

```
PAIR_COUNT         = 56   (recomputed from scratch this round — matches round 3)
ALL_THICKNESS_1MM  = YES
ALL_MATERIAL_MP220 = YES
ALL_RATIO_1_1      = YES
```

Breakdown by family: ПП=14, ТПП=12, ПС=12, ТПС=10, ТПГС=8 — **no ПГССигма**
rows, but this isn't part of the mystery: `ПГССигма` simply has no 1.0mm
rows anywhere in the 632-row catalog at all (its thinnest is 1.2mm), so it
was never eligible to appear here. All 56 share `раскреп` mixed
(30 True / 26 False — not a discriminator) and `к_т_исп_по_умолчанию = 0.85`
for every single one.

### 19.2 Source row structure (Task 2)

Row deltas between the two rows of each of the 56 pairs: **114 (26 pairs),
25 (22 pairs), 16 (8 pairs)** — the exact same three values found for the
full 316-pair set in §17.4. The 56 are not a separate block; they sit
inside the same repeated-block structure as everything else. Index 114
lines up with where the `вид` sequence (ПП→ПС→ПГССигма→ТПП→ТПС→ТПГС)
restarts from `ПП` in the raw array — i.e. a second full pass over the
family list, not an adjacent second column.

### 19.3–19.5 P4/X7 semantics, numeric correlation, and the actual discriminator (Tasks 3–5)

No literal `Расчет Угловая!X7` formula was recovered — same access
limitation as every prior round (no local xlsx). But re-reading
`nesushki.csv` **with its full column range**, not just the 13 columns that
made it into `girtBearingCatalog.json`, surfaced two things the earlier
rounds missed entirely:

**A legend block sits directly above the header row, in the same column
that later holds `материал`:**

```
row 0, col 13: "R220/R350"
row 1, col 13: "0.55"
row 2, col 13: "R390/R350"
row 3, col 13: "1.1"   (this is the row the CSV export mistakes for a column header)
```

`R220/R350` and `R390/R350` read as steel-grade design-resistance ratios;
`0.55` and `1.1` are their values. **`1.1` is sitting right there, in the
source data, as the ratio label for `R390/R350`** — this is almost
certainly what the old `selectGirt.ts` comment calls "P4": not a
1mm-specific correction at all, but a general material-resistance ratio the
whole несушки table is built from.

**An unlabeled column (index 16, between `Профиль` and `Пред М`) holds a
"raw moment" value that `Пред М` is computed from.** Recovered the exact
relationship, verified on **all 632 rows without a single exception**:

```
Пред_момент = raw_moment × макс_к_т_исп_по_умолчанию × material_coeff

material_coeff:  МП220 → 0.55   МП350 → 1.0   МП390 → 1.0   (exactly, all 632 rows)
```

This is the real source of the `R220/R350 = 0.55` legend value: it's the
grade-220 multiplier, applied uniformly. **МП350 and МП390 get the *same*
material_coeff (1.0)** — the material label does **not** distinguish their
final moment at all, contrary to round 3's working assumption.

Then, checking the **raw_moment column itself** (not `Пред М`) across all
316 name-pairs:

```
raw_moment(high) / raw_moment(low) = 1.1   for ALL 316 pairs, no exceptions
                                            (56 same-material AND 260 material-differing alike)
```

**This is the actual mechanism.** Every profile in the table has a "low
block" and a "high block" row (matching the 114/25/16 row-delta structure
in 19.2/17.4), and the high block's raw capacity is always exactly 1.1× the
low block's — completely independent of whichever material label happens to
be attached to each block. For 260 profiles, the source table's low/high
blocks *also* happen to carry different material labels (МП350 then МП390);
for these 56, both blocks kept the same label (МП220). The material
relabeling and the 1.1 raw-moment split are two **independent** things that
mostly, but not always, coincide in the same two blocks.

```
NUMERIC_CORRELATION = PROVEN     (exact ×1.1 on raw_moment, all 316 pairs, to full float precision)
SEMANTIC_LINK        = PARTIAL   (P4=1.1 is well-supported as the R390/R350 legend value and matches
                                   the raw-moment split exactly, but this round also DISPROVES the old
                                   "P4 applies only to 1.0mm profiles" framing — the same split exists
                                   on every thickness, not just 1mm. What X7 specifically does with it
                                   — pick a block, multiply, or something else — is still not recovered
                                   as a literal formula.)
```

**This corrects round 3's own framing**, which treated the 56 as
"unexplained" and the 260 as "explained by material" as if they were
different phenomena. They are not — they're the same 1.1 split with material
labeling as a mostly-coincidental second axis. The genuinely open question
is narrower than round 3 stated: not "why do these 56 differ" but "why does
material relabeling (350→390) accompany the split for 260 profiles but not
the other 56" — and that remains unanswered.

### 19.6 Hidden material-grade search (Task 6)

Searched `nesushki.csv` and every other locally available CSV/upload for
any grade token beyond the three already known:

```
grep -oE "МП[0-9]+" nesushki.csv  →  МП220, МП350, МП390 only. No МП240, МП250, or others found.
```

No fourth grade exists anywhere in the accessible data. **`HIDDEN_MATERIAL_GRADE
= UNKNOWN`** stands — not because a grade is likely hidden, but because
19.5 already found the *actual* driver (raw_moment, independent of material
labeling), which makes a hidden-fourth-grade explanation for the 56
unnecessary rather than merely unproven.

### 19.7 Selector risk for the 56 pairs (Task 7)

```
AFFECTED_PROFILE_KEYS = 56   (every one of the 56 pairs, by construction — each has a
                              (moment_low, moment_high] interval where the current
                              selector's pass/fail depends on which row of the pair
                              is checked)
```

Full interval table for all 56: `data/audit/mp220_1mm_pairs.json`
(`moment_low`, `moment_high`, `ratio` per pair — ratio is 1.1 throughout, so
the interval width is always exactly 10% of the low value). Mechanism is
identical to §17.5/17.7: `resolvePricedProfile()` cannot see `материал`, so
both rows resolve to the same priced output; whichever row's moment the
actual demand satisfies determines pass/fail, invisibly.

### 19.8 Golden-project search (Task 8)

Checked Благовещенск first: its two selected corner/typical profiles
(`[]ПП 145x45x1,5` / `[]ПП 145x45x1,2`) are 1.5mm/1.2mm, not 1.0mm — outside
the 56-pair set entirely (already established in §17.6, which covers the
material-labeled 260-set instead).

Checked the one other locally-available real profnastil-wall object,
`21604.xlsx` (all sheets): its actual, quantity-bearing wall-girt lines
(`B34`/`B35`: `ПС 145х45х1,5`, `ПС 145х45х1,2`) are also 1.5mm/1.2mm. The
file does contain several bare "×1" mentions (`ТПП 110х1`, `ПП 110x1`,
`B174`, `I38`, `B56`) but these sit inside generic price/section lookup
tables elsewhere in the sheet, with no associated quantity formula tying
them to this object's own selected wall girt — they're reference rows, not
evidence of a resolved 1.0mm selection.

**`NO_DISCRIMINATING_FIXTURE_FOUND`** — per instruction, not escalating to
mass Drive indexing to search for one this round.

### 19.9 Architectural consequence (Task 9)

```
STRUCTURAL_GRADE_PRESERVED = YES   (GirtBearingRow already has a `материал` field, correctly
                                    populated — МП220/350/390 are distinguished at this layer)
PRICING_GRADE_PRESERVED    = NO    (resolvePricedProfile()'s output, GirtProfileOption, has no
                                    material/grade field at all — confirmed by reading the type
                                    and by the live run in §17.5: both rows of a pair resolve to
                                    byte-identical weightPerMeter_kg/pricePerMeter)
```

Recommendation carried into §13's `EnclosureCore` sketch stands and is now
better-supported: any future catalog needs to keep `материал` (or better,
the raw_moment/material_coeff split found in 19.5) as an explicit,
queryable field through to the pricing layer — not just at the
`GirtBearingRow` level where it already exists today but is effectively
discarded one function call later.

---

## 20. Round-4 final statuses

```
MP220_1MM_DUPLICATE_PAIRS       = 56
MP220_1MM_PAIR_RATIO_1_1        = PROVEN
P4_VALUE                        = 1.1   (well-supported: found as the literal "R390/R350" legend
                                          value in the source column, and matches the raw-moment
                                          split exactly on all 316 pairs — not from a recovered
                                          formula reference, so treat as strong-not-certain)
P4_SEMANTICS                    = PARTIAL   (identified as a material-resistance ratio driving a
                                              uniform raw-moment split; the literal X7 formula that
                                              consumes it was not recovered)
X7_1MM_RULE                     = PARTIAL   (this round DISPROVES the "1.0mm-only" framing of the
                                              old comment — the same 1.1 split exists at every
                                              thickness; X7's exact role, if it's thickness-specific
                                              at all, is not recovered)
MP220_DUPLICATES_LINKED_TO_P4   = PARTIAL   (same numeric mechanism as the proven 260 material
                                              pairs — not a separate phenomenon — but WHY material
                                              relabeling accompanies 260 of the 316 splits and not
                                              the other 56 is still open)
HIDDEN_MATERIAL_GRADE           = UNKNOWN   (none found; also no longer needed as an explanation —
                                              see 19.6)
CURRENT_SELECTOR_CAPACITY_AMBIGUOUS = YES
STRUCTURAL_GRADE_PRESERVED      = YES
PRICING_GRADE_PRESERVED         = NO
SAFE_TO_CHANGE_SELECTOR         = NO
PRODUCTION_CODE_CHANGED         = NO
```

New artifact this round: **`data/audit/mp220_1mm_pairs.json`** (56 pairs,
full field set + source rows + demand intervals). Not committed yet, not
wired into production.

Verified via `git status --short`: only new/updated files under
`COLD_ENCLOSURE_COMPLETION_AUDIT.md` and `data/audit/` — nothing under `src/`
touched this round either.

---

### What would unblock the `NOT_PROVEN`/`UNKNOWN` items

Every remaining gap above traces back to one thing: **no tool in this
environment can read past the first ~1MB of the 34MB ограждайка workbook.**
The fastest path forward isn't more Drive searching — it's the same thing
that unblocked the *proven* parts of this system originally: either (a) the
расчётчик pastes the specific formula text for the sheet/rows in question
directly (as was done earlier this session for the wind-load chain and the
несушки columns), or (b) a CSV export of the specific deeper sheets
(`Расчет Рядовая`, whichever sheet holds openings/TN-TO/P4 logic) the same
way `rt_columns.csv` and `filter_tables.csv` were produced.
