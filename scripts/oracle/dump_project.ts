import { computeProject, type ProjectInputs } from "../../src/calc/project/computeProject";
import { buildBill } from "../../src/calc/bill/buildBill";
const inputs: ProjectInputs = JSON.parse(process.argv[2]);
const p = computeProject(inputs);
const bill = buildBill(p);
const totals: Record<string, number | null> = {};
for (const s of [...bill.materials, ...bill.additional]) totals[s.sourceCell] = s.totalCost;
totals["F82"] = bill.materialsTotal; totals["F148"] = bill.additionalTotal;
totals["F149"] = bill.recommendedPrice; totals["F150"] = bill.packaging;
totals["F151"] = bill.totalWithPackaging; totals["F154"] = bill.buildingMass_kg;
console.log(JSON.stringify({
  totals,
  sel: {
    sv: p.climate.ok ? p.climate.value.standard : null,
    district: p.bankBlock?.snowDistrict, k: p.bankBlock?.bankK,
    pitch: p.geometry.framePitch_m, maxStep: p.maxPurlinStep, step: p.purlin?.step_mm,
    beam: p.frame.ok ? p.frame.value.beam.profile : null,
    column: p.frame.ok ? p.frame.value.column.profile : null,
    purlin: p.purlin?.profile.name,
    purlinMass: p.purlinLayout?.totalMass_kg,
    boltsTotal: p.frame.ok ? p.frame.value.bolts.totalInFrame : null,
    gusset: p.frame.ok ? p.frame.value.massGussetPlates_kg : null,
    lines: p.purlinLayout?.lineCount,
    frameCount: p.frameTakeoff?.frameCount,
    strutTube: p.effectiveStrutTube,
  },
  transcribe: {
    beamPrice: p.frameTakeoff?.beam.priceSale_perM, beamMass: p.frameTakeoff?.beam.massPerM_kg,
    columnPrice: p.frameTakeoff?.column.priceSale_perM, columnMass: p.frameTakeoff?.column.massPerM_kg,
    purlinProfilePrice: p.purlinLayout && p.purlinLayout.totalProfileLength_m > 0 && p.purlinLayout.totalCost != null
      ? p.purlinLayout.totalCost / p.purlinLayout.totalProfileLength_m : null,
    purlinProfileMass: p.purlin ? p.purlin.profile.mass_kg_per_m / 2 : null,
    purlinProfileName: p.purlin?.profile.name.replace(/^2/, ""),
    screwRate: p.frameFasteners ? p.frameFasteners.items.find((i) => i.name.startsWith("Саморез 5,5"))!.count / (p.frameTakeoff?.frameCount ?? 1) : null,
    wallPanelPrice: bill.additional.find((s) => s.sourceCell === "F114")!.rows[0].unitPrice,
    wallPanelMass: (() => { const r = bill.additional.find((s) => s.sourceCell === "F114")!.rows[0]; return r.count ? (r.mass_kg ?? 0) / r.count : 0; })(),
    roofPanelPrice: bill.additional.find((s) => s.sourceCell === "F147")?.rows[0].unitPrice ?? null,
    roofPanelMass: (() => { const s = bill.additional.find((x) => x.sourceCell === "F147"); if (!s) return 0; const r = s.rows[0]; return r.count ? (r.mass_kg ?? 0) / r.count : 0; })(),
  },
}));
