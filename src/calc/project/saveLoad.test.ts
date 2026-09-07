import { describe, expect, it } from "vitest";
import {
  SAVE_FORMAT_VERSION,
  defaultTitle,
  fileNameFor,
  parseSavedProject,
  serializeProject,
} from "./saveLoad";
import type { ProjectInputs } from "./computeProject";

const inputs: ProjectInputs = {
  city: "Берёзовский, Свердловская область",
  span: 18, length_m: 30, height_m: 5,
  gammaN: 1.0, bankK: "auto",
  roofingType: "С-П 150", deckingMark: "С44-1000-0,7",
  maxStepOverride_mm: 0, minStep_mm: 0, framePitchOverride_m: 0,
  wallPanel_mm: 100, roofPanel_mm: 150,
  openings: {
    gatesCount: 1, gateWidth_m: 4, gateHeight_m: 4.2,
    doorsCount: 1, doorWidth_m: 1, doorHeight_m: 2,
    windowsCount: 1, windowWidth_m: 30, windowHeight_m: 1,
  },
  snowGuards: true, railingPurlin: false, tubeStrutCount: 3, postSpacing_m: 2,
};

describe("сохранение и открытие расчёта", () => {
  it("survives a round trip unchanged", () => {
    const saved = serializeProject(inputs);
    const back = parseSavedProject(JSON.stringify(saved));
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.value.inputs).toEqual(inputs);
  });

  it("names the file after the city and the size", () => {
    expect(defaultTitle(inputs)).toBe("Берёзовский 18×30×5");
    expect(fileNameFor(serializeProject(inputs))).toBe("Берёзовский 18×30×5.sprintm.json");
    expect(fileNameFor(serializeProject(inputs, "Склад / цех №3"))).not.toContain("/");
  });

  it("refuses anything that is not ours, and says why", () => {
    expect(parseSavedProject("не json")).toMatchObject({ ok: false });
    expect(parseSavedProject('{"format":"что-то другое"}')).toMatchObject({
      ok: false,
      error: expect.stringContaining("СпринтМ"),
    });
    expect(
      parseSavedProject(JSON.stringify({ ...serializeProject(inputs), version: 99 })),
    ).toMatchObject({ ok: false, error: expect.stringContaining("новой версией") });
    expect(
      parseSavedProject(JSON.stringify({ format: "sprintm-project", version: 1 })),
    ).toMatchObject({ ok: false, error: expect.stringContaining("исходных данных") });
  });

  it("takes a copy, so editing the form afterwards does not rewrite the file", () => {
    const saved = serializeProject(inputs);
    const edited = { ...inputs, length_m: 99 };
    expect(saved.inputs.length_m).toBe(30);
    expect(edited.length_m).toBe(99);
  });

  it("refuses a file that lost a size, rather than calculating on a hole", () => {
    const broken = serializeProject(inputs);
    delete (broken.inputs as Partial<ProjectInputs>).length_m;
    expect(parseSavedProject(JSON.stringify(broken))).toMatchObject({
      ok: false,
      error: expect.stringContaining("length_m"),
    });
  });

  it("opens a file written by an older format", () => {
    const old = { ...serializeProject(inputs), version: SAVE_FORMAT_VERSION - 1 };
    expect(parseSavedProject(JSON.stringify(old)).ok).toBe(true);
  });
});
