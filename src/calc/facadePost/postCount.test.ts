import { describe, expect, it } from "vitest";
import { facadePostCount } from "./postCount";

describe("facadePostCount", () => {
  it("gives 4 posts for spans up to 18m", () => {
    expect(facadePostCount(9)).toBe(4);
    expect(facadePostCount(12)).toBe(4);
    expect(facadePostCount(15)).toBe(4);
    expect(facadePostCount(18)).toBe(4);
  });

  it("gives 6 posts for spans 21m and up", () => {
    expect(facadePostCount(21)).toBe(6);
    expect(facadePostCount(24)).toBe(6);
  });
});
