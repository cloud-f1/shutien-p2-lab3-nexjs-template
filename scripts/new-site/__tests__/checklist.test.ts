/**
 * E26 — Unit tests for checklist module
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import {
  mkdirSync,
  mkdtempSync,
  writeFileSync,
  existsSync,
  rmSync,
  utimesSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  detectManifest,
  detectDependencies,
  detectMigration,
  detectFirstDomain,
  detectOpenApiUpdated,
  detectFirstEpic,
  buildChecklist,
  renderChecklist,
} from "../checklist.js";

describe("detectManifest", () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns true when .build-manifest.yaml exists", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "checklist-"));
    writeFileSync(join(tmpDir, ".build-manifest.yaml"), "version: '1.0'");
    expect(detectManifest(tmpDir)).toBe(true);
  });

  it("returns false when .build-manifest.yaml does not exist", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "checklist-"));
    expect(detectManifest(tmpDir)).toBe(false);
  });
});

describe("detectDependencies", () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns true when both node_modules and server/.venv exist", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "checklist-"));
    mkdirSync(join(tmpDir, "node_modules"), { recursive: true });
    mkdirSync(join(tmpDir, "server", ".venv"), { recursive: true });
    expect(detectDependencies(tmpDir)).toBe(true);
  });

  it("returns false when node_modules missing", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "checklist-"));
    mkdirSync(join(tmpDir, "server", ".venv"), { recursive: true });
    expect(detectDependencies(tmpDir)).toBe(false);
  });

  it("returns false when server/.venv missing", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "checklist-"));
    mkdirSync(join(tmpDir, "node_modules"), { recursive: true });
    expect(detectDependencies(tmpDir)).toBe(false);
  });
});

describe("detectMigration", () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns true when manifest contains alembic_migrate pass", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "checklist-"));
    writeFileSync(
      join(tmpDir, ".build-manifest.yaml"),
      [
        "steps_completed:",
        "  - step: alembic_migrate",
        "    status: pass",
        '    at: "2026-01-01T00:00:00Z"',
      ].join("\n"),
    );
    expect(detectMigration(tmpDir)).toBe(true);
  });

  it("returns false when manifest missing", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "checklist-"));
    expect(detectMigration(tmpDir)).toBe(false);
  });

  it("returns false when alembic_migrate has fail status", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "checklist-"));
    writeFileSync(
      join(tmpDir, ".build-manifest.yaml"),
      [
        "steps_completed:",
        "  - step: alembic_migrate",
        "    status: fail",
      ].join("\n"),
    );
    expect(detectMigration(tmpDir)).toBe(false);
  });
});

describe("detectFirstDomain", () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns true when a domain directory exists", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "checklist-"));
    const domainsDir = join(tmpDir, "server", "app", "domains", "blog");
    mkdirSync(domainsDir, { recursive: true });
    writeFileSync(join(domainsDir, "__init__.py"), "");
    expect(detectFirstDomain(tmpDir)).toBe(true);
  });

  it("returns false when only __init__.py and __pycache__ exist", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "checklist-"));
    const domainsDir = join(tmpDir, "server", "app", "domains");
    mkdirSync(domainsDir, { recursive: true });
    writeFileSync(join(domainsDir, "__init__.py"), "");
    mkdirSync(join(domainsDir, "__pycache__"));
    expect(detectFirstDomain(tmpDir)).toBe(false);
  });

  it("returns false when domains dir does not exist", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "checklist-"));
    expect(detectFirstDomain(tmpDir)).toBe(false);
  });
});

describe("detectOpenApiUpdated", () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns true when openapi files are newer than manifest", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "checklist-"));
    const manifestPath = join(tmpDir, ".build-manifest.yaml");
    writeFileSync(manifestPath, "version: '1.0'");

    // Set manifest mtime to past
    const past = new Date(Date.now() - 60_000);
    utimesSync(manifestPath, past, past);

    // Create openapi file (will have current mtime)
    const openapiDir = join(tmpDir, "docs", "openapi");
    mkdirSync(openapiDir, { recursive: true });
    writeFileSync(join(openapiDir, "openapi.yaml"), "openapi: 3.1.0");

    expect(detectOpenApiUpdated(tmpDir)).toBe(true);
  });

  it("returns false when openapi dir does not exist", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "checklist-"));
    writeFileSync(join(tmpDir, ".build-manifest.yaml"), "version: '1.0'");
    expect(detectOpenApiUpdated(tmpDir)).toBe(false);
  });

  it("returns false when manifest does not exist", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "checklist-"));
    expect(detectOpenApiUpdated(tmpDir)).toBe(false);
  });
});

describe("detectFirstEpic", () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns true when EPIC_INDEX has a completed epic", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "checklist-"));
    const epicDir = join(tmpDir, "docs", "epics");
    mkdirSync(epicDir, { recursive: true });
    writeFileSync(
      join(epicDir, "EPIC_INDEX.md"),
      "| E1 | My Feature | S | ✅ | 🔄 | ⬜ | ⬜ | ⬜ | WIP |",
    );
    expect(detectFirstEpic(tmpDir)).toBe(true);
  });

  it("returns false when all epics are pending", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "checklist-"));
    const epicDir = join(tmpDir, "docs", "epics");
    mkdirSync(epicDir, { recursive: true });
    writeFileSync(
      join(epicDir, "EPIC_INDEX.md"),
      "| E1 | My Feature | S | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |",
    );
    expect(detectFirstEpic(tmpDir)).toBe(false);
  });

  it("returns false when EPIC_INDEX does not exist", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "checklist-"));
    expect(detectFirstEpic(tmpDir)).toBe(false);
  });
});

describe("buildChecklist", () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns 8 items", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "checklist-"));
    const items = buildChecklist(tmpDir);
    expect(items).toHaveLength(8);
  });

  it("uses testsPassed option for tests item", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "checklist-"));
    const passing = buildChecklist(tmpDir, { testsPassed: true });
    const testsItem = passing.find((i) => i.id === "tests");
    expect(testsItem?.done).toBe(true);

    const failing = buildChecklist(tmpDir, { testsPassed: false });
    const testsItemFail = failing.find((i) => i.id === "tests");
    expect(testsItemFail?.done).toBe(false);
  });

  it("detects scaffolded project", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "checklist-"));
    writeFileSync(join(tmpDir, ".build-manifest.yaml"), "version: '1.0'");
    const items = buildChecklist(tmpDir);
    const scaffolded = items.find((i) => i.id === "scaffolded");
    expect(scaffolded?.done).toBe(true);
  });

  it("all items have id, label, hint, and docLink", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "checklist-"));
    const items = buildChecklist(tmpDir);
    for (const item of items) {
      expect(item.id).toBeTruthy();
      expect(item.label).toBeTruthy();
      expect(item.hint).toBeTruthy();
      expect(item.docLink).toBeTruthy();
    }
  });
});

describe("renderChecklist", () => {
  it("does not throw when rendering items", () => {
    const items = [
      { id: "a", label: "Item A", done: true },
      { id: "b", label: "Item B", done: false, hint: "Fix this", docLink: "docs/guide.md" },
    ];
    // renderChecklist uses p.note which writes to stdout — just verify no throw
    expect(() => renderChecklist(items)).not.toThrow();
  });
});
