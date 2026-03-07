import { describe, it, expect } from "vitest";
import { getRandomString } from "@/lib/utils";

describe("getRandomString", () => {
  it("returns string of requested length when length is positive", () => {
    const result = getRandomString(8);
    expect(result).toHaveLength(8);
    expect(typeof result).toBe("string");
  });

  it("returns non-empty string when length is 1", () => {
    const result = getRandomString(1);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(typeof result).toBe("string");
  });

  it("returns string of at most requested length for small length", () => {
    const result = getRandomString(3);
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it("returns different values on multiple calls", () => {
    const a = getRandomString(16);
    const b = getRandomString(16);
    expect(a).not.toBe(b);
  });

  it("handles zero or negative length by producing at least 1 chunk", () => {
    const result = getRandomString(0);
    expect(typeof result).toBe("string");
    expect(result.length).toBeLessThanOrEqual(8);
  });
});
