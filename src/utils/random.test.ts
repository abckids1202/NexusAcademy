import { afterEach, describe, expect, it, vi } from "vitest";
import { randomInteger, randomUnit, type Uint32Filler } from "./random";

describe("random utilities", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("uses Web Crypto for the default integer source when available", () => {
    const getRandomValues = vi.fn((values: Uint32Array) => {
      values[0] = 0xffff_fff9;
      return values;
    });
    vi.stubGlobal("crypto", { getRandomValues });

    expect(randomInteger(10)).toBe(9);
    expect(getRandomValues).toHaveBeenCalledOnce();
  });

  it("falls back to Math.random in runtimes without Web Crypto", () => {
    vi.stubGlobal("crypto", undefined);
    vi.spyOn(Math, "random").mockReturnValueOnce(0.5).mockReturnValueOnce(0);

    expect(randomUnit()).toBe(0.5);
  });

  it("maps 53 random bits into a unit interval that excludes one", () => {
    const fill: Uint32Filler = (values) => values.fill(0xffff_ffff);
    expect(randomUnit(fill)).toBe(1 - 2 ** -53);
  });

  it("uses rejection sampling before reducing random integers into a range", () => {
    const words = [0xffff_ffff, 5];
    let calls = 0;
    const fill: Uint32Filler = (values) => {
      values[0] = words[calls];
      calls += 1;
    };

    expect(randomInteger(3, fill)).toBe(2);
    expect(calls).toBe(2);
  });

  it("validates integer range bounds", () => {
    expect(() => randomInteger(0)).toThrow(RangeError);
    expect(() => randomInteger(1.5)).toThrow(RangeError);
    expect(() => randomInteger(0x1_0000_0001)).toThrow(RangeError);
    expect(randomInteger(1, (values) => values.fill(123))).toBe(0);
  });
});
