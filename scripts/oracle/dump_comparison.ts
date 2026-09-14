import { buildBill } from "../../src/calc/bill/buildBill";
import { computeProject, type ProjectInputs } from "../../src/calc/project/computeProject";

const inputs: ProjectInputs = JSON.parse(process.argv[2]);
const project = computeProject(inputs);
const bill = buildBill(project);

console.log(
  JSON.stringify({
    engineering: {
      sv: project.climate.ok ? project.climate.value.standard : null,
      bankBlock: project.bankBlock,
      framePitch_m: project.geometry.framePitch_m,
      frameCount: project.frameTakeoff?.frameCount ?? null,
      beam: project.frameTakeoff?.beam ?? null,
      column: project.frameTakeoff?.column ?? null,
      purlin: project.purlin ?? null,
      purlinLayout: project.purlinLayout ?? null,
      envelope: project.envelope,
      openingsArea_m2: project.openingsArea,
      openingsDeduction_m2: project.openingsDeduction,
      openingsFraming: project.openingsFraming,
      effectiveExtraTubeMass_t: project.effectiveExtraTubeMass_t,
      requiresCheck: project.requiresCheck,
      approximations: project.approximations,
      unpricedSections: project.unpricedSections,
    },
    sections: [...bill.materials, ...bill.additional],
    totals: {
      materials: bill.materialsTotal,
      additional: bill.additionalTotal,
      projectWithoutOpenings: bill.totalWithPackaging,
      mass_kg: bill.buildingMass_kg,
    },
  }),
);
