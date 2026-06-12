/**
 * E21 — Unit tests for prerequisite checks
 */

import { describe, it, expect } from "vitest";
import { extractVersion, checkTool } from "../checks.js";
import type { ToolSpec } from "../checks.js";

describe("extractVersion", () => {
  it("extracts 3-part semver from node output", () => {
    expect(extractVersion("v20.11.0", /v?(\d+\.\d+\.\d+)/)).toBe("20.11.0");
  });

  it("extracts version without 'v' prefix", () => {
    expect(extractVersion("3.12.3", /(\d+\.\d+\.\d+)/)).toBe("3.12.3");
  });

  it("normalizes 2-part version to 3-part", () => {
    expect(extractVersion("psql (PostgreSQL) 16.2", /(\d+\.\d+\.?\d*)/)).toBe(
      "16.2.0",
    );
  });

  it("returns null for no match", () => {
    expect(extractVersion("no version here", /(\d+\.\d+\.\d+)/)).toBeNull();
  });

  it("extracts from verbose output", () => {
    expect(
      extractVersion("Python 3.12.3", /(\d+\.\d+\.\d+)/),
    ).toBe("3.12.3");
  });

  it("extracts from git version output", () => {
    expect(
      extractVersion("git version 2.44.0", /(\d+\.\d+\.\d+)/),
    ).toBe("2.44.0");
  });
});

describe("checkTool", () => {
  it("returns pass for tool meeting semver requirement", () => {
    // Create a spec that checks 'node' which should be available in test env
    const spec: ToolSpec = {
      name: "node",
      command: "node --version",
      required: ">=16.0.0", // Low bar — any modern Node passes
      versionExtract: /v?(\d+\.\d+\.\d+)/,
      installHint: "Install Node.js",
    };
    const result = checkTool(spec);
    expect(result.pass).toBe(true);
    expect(result.found).toBeTruthy();
    expect(result.name).toBe("node");
  });

  it("returns fail for impossibly high version requirement", () => {
    const spec: ToolSpec = {
      name: "node",
      command: "node --version",
      required: ">=999.0.0",
      versionExtract: /v?(\d+\.\d+\.\d+)/,
      installHint: "Install Node.js",
    };
    const result = checkTool(spec);
    expect(result.pass).toBe(false);
    expect(result.found).toBeTruthy(); // Found but doesn't satisfy
  });

  it("returns fail for missing tool", () => {
    const spec: ToolSpec = {
      name: "nonexistent",
      command: "this-tool-does-not-exist-xyz --version",
      required: "any",
      versionExtract: /(\d+\.\d+\.\d+)/,
      installHint: "Install it",
    };
    const result = checkTool(spec);
    expect(result.pass).toBe(false);
    expect(result.found).toBeNull();
  });

  it("returns pass for 'any' requirement when tool exists", () => {
    const spec: ToolSpec = {
      name: "node",
      command: "node --version",
      required: "any",
      versionExtract: /v?(\d+\.\d+\.\d+)/,
      installHint: "Install Node.js",
    };
    const result = checkTool(spec);
    expect(result.pass).toBe(true);
  });

  it("includes installHint in result", () => {
    const spec: ToolSpec = {
      name: "missing",
      command: "fake-tool-xyz",
      required: "any",
      versionExtract: /(\d+\.\d+\.\d+)/,
      installHint: "brew install fake-tool",
    };
    const result = checkTool(spec);
    expect(result.installHint).toBe("brew install fake-tool");
  });
});
