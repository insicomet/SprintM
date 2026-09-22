# Sprint Real-Project Validation Corpus — File Inventory + Golden Fixtures (Phase 9)

**Status: file inventory EXHAUSTIVE over all 160 canonical Sprint projects.
Workbook-type classification is GROUNDED but not exhaustive — see §3. Not
committed, not pushed**, per instruction. Companion machine-readable file
(rewritten this round): `data/audit/sprint_project_index.json`.

This round does **not** rebuild the census (still 160, unchanged from Phase
8). It enriches every existing record with real file listings and derives
completeness/golden/comparison/duplicate/opening fields from that evidence.

## 1. File inventory (Phase 1/2)

Every one of the 160 canonical Sprint project folders was listed directly
(`parentId = '<projectFolderId>'`), not searched.

```
PROJECT_FOLDERS_FILE_LISTED = 160/160
PROJECTS_WITH_XLSX          = 160
PROJECTS_WITH_PDF           = 147
PROJECTS_WITH_BOTH          = 147
XLSX_ONLY                   = 13
PDF_ONLY                    = 0
EMPTY                       = 0
```

No project folder came back empty and none is PDF-only — every one has at
least a source XLSX, which is the more important of the two for
regression validation per the task's own instruction.

**Structural finding not anticipated by Phase 8**: several project folders
contain files that are **not their own project's files**. Two distinct
patterns:

1. **Multi-parent Drive files** — a handful of files (e.g. `21529.pdf`,
   `21558 (Спринт).xlsx`, `21478.pdf`, `21394 (спринт с зат.)…`) appear
   inside 2+ different project folders simultaneously with the *same* Drive
   file ID. This is Google Drive's native multi-parent-folder feature, not
   a data error — someone added these files to a second folder (likely a
   "similar precedent" reference) without removing them from the first. 7
   folders show this (`MULTI_PARENT_FILES` tag in the index).
2. **One outright mislabeled folder**: the folder titled `"21418 (18х105х3,15
   + пристрой,Еврокод ,СП Птичник)"` (`1-JvTubr0owtbafdllqhi1kjQKJoEGZA3`,
   Декабрь 2025) contains **only** files named `21295(1).xlsx/pdf` and
   `21295 (спринт).xlsx/pdf` — nothing named 21418 at all. Its *content* is
   project 21295, not 21418. The other folder titled 21418
   (`1mNj2O-HZOIB0ti8OVpsTYHsg7T1kmG_n`) does contain a real `21418.xlsx`
   and is the genuine 21418. **Practical effect**: project 21295 exists as
   real data but was never captured as its own record in the Phase 8
   title-based census, because its folder is titled 21418. This one folder
   sits outside the 160-record canonical set (161st folder inventoried
   this round) — flagged, not silently folded into either project number.

**49 of 160** folders contain more than one xlsx+pdf variant pair (e.g.
"Великан" vs "Спринт нов.констр." vs "с затяжкой" as separate calculated
alternatives in the same folder) — tagged `MULTI_VARIANT` with a count.
This is normal: the same object was evaluated under 2-4 different
structural-system assumptions before a final one was chosen.

## 2. Duplicate project-number cases, re-examined with file evidence (Phase 5)

The 5 cases carried over from Phase 8 now have file-level evidence:

| # | Classification | Evidence |
|---|---|---|
| 21231 | SAME_COPY_DIFFERENT_LOCATION | Both folders' single xlsx+pdf pair are named identically `21231.xlsx/.pdf`; file sizes/content pattern match a straight copy. |
| 21418 | **DIFFERENT_PROJECT_WITH_SAME_NUMBER** (correction from Phase 8's "DIFFERENT_REVISION candidate") | File-level check (§1) shows one "21418" folder's actual content is project 21295, not a revision of 21418 at all — these are two unrelated projects that happen to share a folder-title number. |
| 21487 | DIFFERENT_REVISION (unresolved) | Both folders have their own clean xlsx+pdf pair, same 10×60×6 geometry, different title wording — file inventory alone doesn't resolve which is newer without opening content; left as a candidate, not proven. |
| 21672 | DIFFERENT_REVISION (unresolved) | Same pattern as 21487 — not opened this round. |
| 21673 | DIFFERENT_REVISION (unresolved) | Same pattern as 21487 — not opened this round. |

## 3. Workbook-type classification (Phase 3) — grounded on 2 real reads, not 160

Per instruction ("do NOT deeply parse all workbooks; first classify the
most important candidates"), two files were actually opened and read:
`21640.xlsx` (АХ, seismic-pair member) and `21629.xlsx` (АХ, annex-trio
member). Both have **the same structure**: a single sheet titled around
"Предварительная ведомость материалов" that mixes (a) input parameters
(ТЗ №, geometry, snow/wind zone, seismic zone, cladding type, insulation),
(b) an embedded ИНСИ profile price/weight catalog fragment, and (c) a
priced, weighed material list (frame count formula-derived, not a flat
export). That is **MIXED** by the task's own definition — not a pure
downstream BOM (it carries live-looking input cells and an embedded
catalog) and not obviously a pure calculation sheet either (it also *is*
the final priced ведомость).

```
SOURCE_SELECTOR_WORKBOOKS = 0    (none independently confirmed pure-calc this round)
DOWNSTREAM_BOM_WORKBOOKS  = 0    (none independently confirmed pure-BOM this round)
MIXED_WORKBOOKS           = 2    (directly confirmed: 21640, 21629)
UNKNOWN_WORKBOOK_TYPE     = 158  (not opened; index field is MIXED_INFERRED as an
                                   extrapolation from the 2 confirmed samples plus
                                   this project's established knowledge that Sprint
                                   calculators are single-workbook calc+BOM — but
                                   this is inference, not verification, and is
                                   labeled as such in the JSON, not silently
                                   presented as confirmed)
```

**19/19 AX projects have a usable XLSX** (`AX_WITH_USABLE_XLSX = 19/19`) —
none of the priority-A candidates are missing their source file.

## 4. Strong comparison groups re-enriched with real files (Phase 4)

All 4 groups now have confirmed file-level evidence (all members clean
xlsx+pdf pairs, no cross-contamination, no missing files):

```
18×30×6 seismic:       21639 (SP) vs 21640 (AX)                      → STRONG
18×40×7+annex trio:    21627 (SP,frame-only) / 21628 (SP) / 21629(AX) → STRONG (+bonus point)
20×90×7 three-way:     21501 (SP) / 21502 (AT) / 21484 (AX)          → STRONG
15×66×6 AX/ASP:        21892 (AX) vs 21893 (ASP)                     → STRONG
                        (differs in enclosure only; ASP side tests a
                        mixed-enclosure contrast, not pure AX/SP)
```

City/location and exact file timestamps were recorded but not
cross-checked project-by-project this round (out of scope — the file
inventory confirms *availability*, not *content equivalence*).

## 5. Opening evidence (Phase 6) — filename-level search, explicitly limited

Searched all 160 folders' file **names** (not content, except the 2 files
opened in §3) for: окно, окна, остекление, ленточное остекление, дверь,
ворота, проем, проёмы. **Zero matches.** The only opening-adjacent
evidence found was in **folder titles** (not filenames), already recorded
by Phase 8:

```
22033 (18х30х4, СП, "фонарь")        — skylight named in title
21998 (18х81х8, СП, "зенит.фонарь")  — skylight named in title
21781 (18х35х3, АХ, "поликарбонат")  — polycarbonate cladding named
```

`OPENING_FRAMING_CANDIDATE = YES` was set **only** for the two explicit
skylight titles — per instruction, "no openings" is never inferred from
title/filename silence, so every other project is `UNKNOWN` for this
field, not `NO`. Window/door/gate framing evidence would require opening
PDF/XLSX *content*, not filenames — not done this round beyond the 2
structural samples (neither of which showed opening framing in the
visible portion read).

## 6. Golden classification (Phase 7) — metadata + file-inventory evidence

Applied mechanically: `GOLDEN_A` = clean single-system Sprint project
(СП/АХ/АТ), no special feature tag, has a usable XLSX. `GOLDEN_B` = same
but with a recorded special condition (seismic, multi-storey, partition,
etc.) or multi-variant complexity. `REFERENCE_ONLY` = mixed structural
system in the same folder (e.g. РСК variants alongside Спринт), the
21418/21295 mislabel case, or the ASP mixed-enclosure project.

```
GOLDEN_A_COUNT       = 88
GOLDEN_B_COUNT       = 49
REFERENCE_ONLY_COUNT = 23
```

This is **not** a re-derivation of Phase 7's retired 77/12/49 split (which
rested on the wrong 138-project base) — it's a fresh classification over
the correct 160, and is not comparable number-for-number to the old one.

## 7. AX shortlist (Phase 8)

All 19 AX projects have a usable XLSX; picking for cold-envelope
validation breadth (span/height variety, avoiding an all-narrow-span set,
prioritizing comparison-pair members first since they carry a built-in SP
control):

```
21640 (18×30×6, seismic, GOLDEN_B, pair member)
21629 (18×40×7+annex, GOLDEN_A, trio member)
21484 (20×90×7, GOLDEN_A, three-way member)
21892 (15×66×6, GOLDEN_A, AX/ASP pair member)
21873 (20×50×7, GOLDEN_A, standalone, no known pair)
```
Reserve/alternates if a wider AX-only set is wanted later: 21252 (18×25×4),
21874 (15×30×6), 21876 (12×30×4,5), 21985 (20×40×4), 21953 (24×24×8) — all
GOLDEN_A, clean, no pair partner found.

## 8. First detailed-extraction fixture set (Phase 9) — 10 projects

```
1. 21640  18×30×6   AX  seismic pair member       — validates wall girt+profsheet vs its SP twin
2. 21639  18×30×6   SP  seismic pair member        — SP control for #1
3. 21629  18×40×7+annex AX  trio member             — 2nd AX/SP control pair, wider span
4. 21628  18×40×7+annex SP  trio member             — SP control for #3
5. 21627  18×40×7+annex SP frame-only 3rd point     — edge/special: frame-only delivery, already
                                                        a proven code path (frameOnly)
6. 21484  20×90×7   AX  three-way member            — widest-span AX control point
7. 21501  20×90×7   SP  three-way member             — SP control for #6 (AT sibling 21502 available too)
8. 21892  15×66×6   AX  AX/ASP pair member          — tests AX vs mixed-enclosure ASP, not plain SP
9. 21873  20×50×7   AX  standalone clean            — 5th AX cold-envelope point, no pair confound
10. 21998 18×81×8   SP  skylight named in title      — only project this round with explicit
                                                        opening-adjacent evidence in its title
```

Mix: 5 AX, 4 SP (one frame-only), 1 opening-adjacent — close to the
requested split; no seismic-only or multi-storey-only skew since 3 of the
5 AX picks are plain single-system projects.

## 9. Opening-framing priority set (Phase 10)

```
OPENING_FRAMING_PRIORITY_PROJECTS = [21998, 22033]
```

Only 2, both from filename-level skylight evidence (§5), both with a full
xlsx+pdf source set. **Honestly short of the requested "up to 5"** — no
window/door/gate/strip-glazing evidence was found anywhere in 160 folders'
titles or filenames; finding more candidates needs a content-level pass
(opening PDFs/XLSX to look for these terms inside calculation sheets),
which is future work, not done here.

## 10. Capacity-branch discriminating candidates (Phase 11)

`CAPACITY_BRANCH_DISCRIMINATING_CANDIDATE = UNKNOWN` for all 160 —
unchanged from Phase 7/8. Determining this needs a project's actual
selected girt profile and computed demand compared against the duplicate
Пред-момент pairs from the earlier Cold Enclosure audit — that requires
opening and interpreting calculation sheets project-by-project, out of
scope for this metadata+file-inventory round.

## Final status

```
CANONICAL_PROJECT_CENSUS            = 160
PROJECT_FOLDERS_FILE_LISTED         = 160/160
PROJECTS_WITH_XLSX                  = 160
PROJECTS_WITH_PDF                   = 147
PROJECTS_WITH_BOTH                  = 147
AX_WITH_USABLE_XLSX                 = 19/19
SOURCE_SELECTOR_WORKBOOKS           = 0    (see §3 — none independently pure-confirmed)
DOWNSTREAM_BOM_WORKBOOKS            = 0    (see §3)
MIXED_WORKBOOKS                     = 2 confirmed + 158 MIXED_INFERRED (not independently verified)
UNKNOWN_WORKBOOK_TYPE               = 0 fields left blank, but confidence is INFERRED not VERIFIED for 158/160
GOLDEN_A_COUNT                      = 88
GOLDEN_B_COUNT                      = 49
REFERENCE_ONLY_COUNT                = 23
STRONG_COMPARISON_GROUPS            = 4   (unchanged from Phase 8, now file-verified)
DUPLICATE_PROJECT_ID_CASES_RESOLVED = 2/5 (21231 confirmed same-copy; 21418 corrected to
                                            different-project-same-number; 21487/21672/21673
                                            remain unresolved candidates)
OPENING_FRAMING_CANDIDATES          = 2   (skylight-only, filename-level)
FIRST_GOLDEN_FIXTURES               = [21640, 21639, 21629, 21628, 21627, 21484, 21501, 21892, 21873, 21998]
OPENING_FRAMING_PRIORITY_PROJECTS   = [21998, 22033]
CORPUS_READY_FOR_DETAILED_EXTRACTION = PARTIAL   (file inventory and a defensible first-10 fixture
                                                    set ARE ready; workbook-type and opening-evidence
                                                    fields are inferred/sparse, not independently
                                                    verified per project — extraction should re-open
                                                    each fixture's actual xlsx before trusting its
                                                    classification)
PRODUCTION_CODE_CHANGED             = NO
```

No production code, selector, pricing, catalog, or EnclosureCore logic was
touched. No source XLSX/PDF was committed. `data/audit/sprint_project_index.json`
was rewritten in place with full provenance retained (archiveRoot,
monthFolderId, projectFolderId, plus new files/fileCompleteness/
workbookType/goldenClass/openingsEvidence/comparisonGroup/duplicateStatus/
notes fields) — still uncommitted, per instruction. Nothing pushed.
