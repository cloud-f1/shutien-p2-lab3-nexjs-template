/**
 * E21 — Unit tests for manifest module
 */

import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import YAML from "yaml";
import { buildManifest, manifestToYaml, writeManifest } from "../manifest.js";
import type { ProjectConfig, PrereqResult, StepResult } from "../types.js";

function makeConfig(): ProjectConfig {
  return {
    slug: "test-app",
    displayName: "Test App",
    description: "A test application",
    author: "Dev <dev@test.com>",
    dbName: "test_app",
    theme: "navy",
    oauthProviders: ["google", "github"],
    deployTarget: "docker",
  };
}

function makePrereqs(): PrereqResult[] {
  return [
    { name: "node", required: ">=20.0.0", found: "20.11.0", pass: true, installHint: "" },
    { name: "pnpm", required: "any", found: "9.1.0", pass: true, installHint: "" },
    { name: "python", required: ">=3.12.0", found: "3.12.3", pass: true, installHint: "" },
    { name: "postgresql", required: "any", found: null, pass: false, installHint: "install pg" },
  ];
}

function makeSteps(): StepResult[] {
  return [
    { step: "prerequisites", status: "pass", at: "2026-03-13T12:00:00Z" },
    { step: "configure", status: "pass", at: "2026-03-13T12:01:00Z" },
    { step: "scaffold", status: "pass", at: "2026-03-13T12:02:00Z" },
  ];
}

describe("buildManifest", () => {
  it("produces correct manifest structure", () => {
    const manifest = buildManifest(makeConfig(), makePrereqs(), makeSteps());

    expect(manifest.version).toBe("1.0");
    expect(manifest.created_at).toBeTruthy();
    expect(manifest.project.name).toBe("test-app");
    expect(manifest.project.display_name).toBe("Test App");
    expect(manifest.project.description).toBe("A test application");
    expect(manifest.project.author).toBe("Dev <dev@test.com>");
  });

  it("maps config correctly", () => {
    const manifest = buildManifest(makeConfig(), makePrereqs(), makeSteps());

    expect(manifest.config.database).toBe("test_app");
    expect(manifest.config.theme).toBe("navy");
    expect(manifest.config.oauth_providers).toEqual(["google", "github"]);
    expect(manifest.config.deploy_target).toBe("docker");
  });

  it("only includes found prerequisites", () => {
    const manifest = buildManifest(makeConfig(), makePrereqs(), makeSteps());

    expect(manifest.prerequisites["node"]).toBe("20.11.0");
    expect(manifest.prerequisites["pnpm"]).toBe("9.1.0");
    expect(manifest.prerequisites["python"]).toBe("3.12.3");
    // postgresql was not found — should be absent
    expect(manifest.prerequisites["postgresql"]).toBeUndefined();
  });

  it("includes all step results", () => {
    const steps = makeSteps();
    const manifest = buildManifest(makeConfig(), makePrereqs(), steps);

    expect(manifest.steps_completed).toHaveLength(3);
    expect(manifest.steps_completed[0].step).toBe("prerequisites");
    expect(manifest.steps_completed[2].status).toBe("pass");
  });

  it("handles empty arrays", () => {
    const config = makeConfig();
    config.oauthProviders = [];
    const manifest = buildManifest(config, [], []);

    expect(manifest.config.oauth_providers).toEqual([]);
    expect(manifest.prerequisites).toEqual({});
    expect(manifest.steps_completed).toEqual([]);
  });
});

describe("manifestToYaml", () => {
  it("produces valid YAML", () => {
    const manifest = buildManifest(makeConfig(), makePrereqs(), makeSteps());
    const yamlStr = manifestToYaml(manifest);

    // Parse it back to verify it's valid YAML
    const parsed = YAML.parse(yamlStr);
    expect(parsed.version).toBe("1.0");
    expect(parsed.project.name).toBe("test-app");
    expect(parsed.config.theme).toBe("navy");
  });

  it("includes step results with correct fields", () => {
    const manifest = buildManifest(makeConfig(), makePrereqs(), makeSteps());
    const yamlStr = manifestToYaml(manifest);
    const parsed = YAML.parse(yamlStr);

    expect(parsed.steps_completed[0]).toEqual({
      step: "prerequisites",
      status: "pass",
      at: "2026-03-13T12:00:00Z",
    });
  });

  it("handles step with error field", () => {
    const steps: StepResult[] = [
      { step: "install", status: "fail", at: "2026-03-13T12:00:00Z", error: "Command failed" },
    ];
    const manifest = buildManifest(makeConfig(), makePrereqs(), steps);
    const yamlStr = manifestToYaml(manifest);
    const parsed = YAML.parse(yamlStr);

    expect(parsed.steps_completed[0].error).toBe("Command failed");
  });
});

describe("writeManifest", () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes .build-manifest.yaml to project root", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "manifest-"));
    const manifest = buildManifest(makeConfig(), makePrereqs(), makeSteps());
    const filePath = writeManifest(tmpDir, manifest);

    expect(filePath).toBe(join(tmpDir, ".build-manifest.yaml"));

    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("# .build-manifest.yaml");
    expect(content).toContain("auto-generated by new-site CLI");

    // Verify YAML is valid and contains expected data
    const lines = content.split("\n");
    // Remove the comment header line
    const yamlPart = lines.slice(1).join("\n");
    const parsed = YAML.parse(yamlPart);
    expect(parsed.version).toBe("1.0");
    expect(parsed.project.name).toBe("test-app");
  });

  it("returns the file path", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "manifest-"));
    const manifest = buildManifest(makeConfig(), makePrereqs(), makeSteps());
    const filePath = writeManifest(tmpDir, manifest);
    expect(filePath).toMatch(/\.build-manifest\.yaml$/);
  });
});
