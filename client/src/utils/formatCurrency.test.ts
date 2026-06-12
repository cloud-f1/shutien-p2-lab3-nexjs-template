import { describe, it, expect } from "vitest";
import { formatCurrency, formatPercent, gainDirection } from "./formatCurrency";

describe("formatCurrency", () => {
  it("formats a large decimal string", () => {
    expect(formatCurrency("1200000.00")).toBe("$1,200,000.00");
  });

  it("formats zero", () => {
    expect(formatCurrency("0.00")).toBe("$0.00");
  });

  it("formats null as $0.00", () => {
    expect(formatCurrency(null)).toBe("$0.00");
  });

  it("formats undefined as $0.00", () => {
    expect(formatCurrency(undefined)).toBe("$0.00");
  });

  it("supports custom currency and locale", () => {
    const result = formatCurrency("1234.56", "TWD", "zh-TW");
    // TWD format varies by environment; just check it contains digits
    expect(result).toMatch(/1,?234/);
  });
});

describe("formatPercent", () => {
  it("formats positive percentage with + sign", () => {
    expect(formatPercent("6.67")).toBe("+6.67%");
  });

  it("formats negative percentage", () => {
    expect(formatPercent("-3.50")).toBe("-3.50%");
  });

  it("returns em dash for null", () => {
    expect(formatPercent(null)).toBe("\u2014");
  });

  it("returns em dash for undefined", () => {
    expect(formatPercent(undefined)).toBe("\u2014");
  });

  it("formats zero without + sign", () => {
    expect(formatPercent("0.00")).toBe("0.00%");
  });
});

describe("gainDirection", () => {
  it("returns 'up' for positive value", () => {
    expect(gainDirection("200000.00")).toBe("up");
  });

  it("returns 'down' for negative value", () => {
    expect(gainDirection("-500.00")).toBe("down");
  });

  it("returns 'flat' for zero", () => {
    expect(gainDirection("0.00")).toBe("flat");
  });

  it("returns 'flat' for null", () => {
    expect(gainDirection(null)).toBe("flat");
  });

  it("returns 'flat' for undefined", () => {
    expect(gainDirection(undefined)).toBe("flat");
  });
});
