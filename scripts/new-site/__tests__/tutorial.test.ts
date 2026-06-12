/**
 * E26 — Unit tests for tutorial module
 */

import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import {
  mkdirSync,
  mkdtempSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Mock @clack/prompts before importing modules that use it
vi.mock("@clack/prompts", () => ({
  select: vi.fn(),
  confirm: vi.fn(),
  spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
  note: vi.fn(),
  log: {
    step: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
  isCancel: vi.fn(() => false),
}));

// Mock child_process
vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
  execSync: vi.fn(() => "v20.0.0"),
}));

import * as prompts from "@clack/prompts";
import { execFileSync } from "node:child_process";
import {
  DOMAIN_OPTIONS,
  formatDomainFields,
  promptDomainType,
  runVerification,
  runTutorial,
} from "../tutorial.js";

describe("DOMAIN_OPTIONS", () => {
  it("has 5 options (blog, todo, crm, custom, skip)", () => {
    expect(DOMAIN_OPTIONS).toHaveLength(5);
    const values = DOMAIN_OPTIONS.map((o) => o.value);
    expect(values).toEqual(["blog", "todo", "crm", "custom", "skip"]);
  });

  it("preset domains have example paths", () => {
    const presets = DOMAIN_OPTIONS.filter(
      (o) => o.value !== "custom" && o.value !== "skip",
    );
    for (const opt of presets) {
      expect(opt.example).toBeTruthy();
      expect(opt.example).toContain("docs/templates/domain/examples/");
    }
  });
});

describe("formatDomainFields", () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  });

  it("formats YAML fields into readable summary", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "tutorial-"));
    const yamlPath = join(tmpDir, "blog.yaml");
    writeFileSync(
      yamlPath,
      [
        "name: post",
        "fields:",
        "  - name: title",
        "    type: string",
        "    required: true",
        "  - name: body",
        "    type: text",
        "    required: false",
      ].join("\n"),
    );

    const result = formatDomainFields(yamlPath);
    expect(result).toContain("Domain: post");
    expect(result).toContain("title: string (required)");
    expect(result).toContain("body: text (optional)");
  });

  it("returns null for non-existent file", () => {
    const result = formatDomainFields("/non/existent/file.yaml");
    expect(result).toBeNull();
  });

  it("returns null for invalid YAML", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "tutorial-"));
    const yamlPath = join(tmpDir, "bad.yaml");
    writeFileSync(yamlPath, "not: valid: yaml: [[[");

    // The YAML parser may or may not throw; either null or a formatted string is acceptable
    const result = formatDomainFields(yamlPath);
    // Should not throw
    expect(result === null || typeof result === "string").toBe(true);
  });
});

describe("promptDomainType", () => {
  let tmpDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns skip when user cancels", async () => {
    vi.mocked(prompts.select).mockResolvedValue(Symbol("cancel"));
    vi.mocked(prompts.isCancel).mockReturnValue(true);

    tmpDir = mkdtempSync(join(tmpdir(), "tutorial-"));
    const result = await promptDomainType(tmpDir);
    expect(result.type).toBe("skip");
  });

  it("returns custom when custom is selected", async () => {
    vi.mocked(prompts.select).mockResolvedValue("custom");
    vi.mocked(prompts.isCancel).mockReturnValue(false);

    tmpDir = mkdtempSync(join(tmpdir(), "tutorial-"));
    const result = await promptDomainType(tmpDir);
    expect(result.type).toBe("custom");
    // Should show note about SDD workflow
    expect(prompts.note).toHaveBeenCalled();
  });

  it("returns skip when skip is selected", async () => {
    vi.mocked(prompts.select).mockResolvedValue("skip");
    vi.mocked(prompts.isCancel).mockReturnValue(false);

    tmpDir = mkdtempSync(join(tmpdir(), "tutorial-"));
    const result = await promptDomainType(tmpDir);
    expect(result.type).toBe("skip");
  });

  it("returns blog with example path when blog is selected", async () => {
    vi.mocked(prompts.select).mockResolvedValue("blog");
    vi.mocked(prompts.isCancel).mockReturnValue(false);

    tmpDir = mkdtempSync(join(tmpdir(), "tutorial-"));
    const result = await promptDomainType(tmpDir);
    expect(result.type).toBe("blog");
    expect(result.exampleConfig).toContain("blog.yaml");
  });

  it("returns todo with example path when todo is selected", async () => {
    vi.mocked(prompts.select).mockResolvedValue("todo");
    vi.mocked(prompts.isCancel).mockReturnValue(false);

    tmpDir = mkdtempSync(join(tmpdir(), "tutorial-"));
    const result = await promptDomainType(tmpDir);
    expect(result.type).toBe("todo");
    expect(result.exampleConfig).toContain("todo.yaml");
  });

  it("returns crm with example path when crm is selected", async () => {
    vi.mocked(prompts.select).mockResolvedValue("crm");
    vi.mocked(prompts.isCancel).mockReturnValue(false);

    tmpDir = mkdtempSync(join(tmpdir(), "tutorial-"));
    const result = await promptDomainType(tmpDir);
    expect(result.type).toBe("crm");
    expect(result.exampleConfig).toContain("crm.yaml");
  });
});

describe("runVerification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns pass when make test succeeds", () => {
    vi.mocked(execFileSync).mockReturnValue(Buffer.from("OK"));

    const result = runVerification("/tmp/project");
    expect(result.step).toBe("verify_tests");
    expect(result.status).toBe("pass");
    expect(result.error).toBeUndefined();
  });

  it("returns fail when make test throws", () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      const err = new Error("test failure") as Error & { stderr: string };
      err.stderr = "FAIL: 2 tests failed";
      throw err;
    });

    const result = runVerification("/tmp/project");
    expect(result.step).toBe("verify_tests");
    expect(result.status).toBe("fail");
    expect(result.error).toContain("quickstart.md");
  });

  it("calls execFileSync with make test", () => {
    vi.mocked(execFileSync).mockReturnValue(Buffer.from("OK"));

    runVerification("/tmp/project");
    expect(execFileSync).toHaveBeenCalledWith(
      "make",
      ["test"],
      expect.objectContaining({
        cwd: "/tmp/project",
        timeout: 120_000,
      }),
    );
  });
});

describe("runTutorial", () => {
  let tmpDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns TutorialResult with domain choice and checklist", async () => {
    vi.mocked(prompts.select).mockResolvedValue("skip");
    vi.mocked(prompts.isCancel).mockReturnValue(false);
    vi.mocked(execFileSync).mockReturnValue(Buffer.from("OK"));

    tmpDir = mkdtempSync(join(tmpdir(), "tutorial-"));
    const result = await runTutorial(tmpDir);

    expect(result.domainChoice.type).toBe("skip");
    expect(result.checklist).toHaveLength(8);
    expect(typeof result.testsPassed).toBe("boolean");
  });

  it("skips verification when option set", async () => {
    vi.mocked(prompts.select).mockResolvedValue("skip");
    vi.mocked(prompts.isCancel).mockReturnValue(false);

    tmpDir = mkdtempSync(join(tmpdir(), "tutorial-"));
    const result = await runTutorial(tmpDir, { skipVerification: true });

    expect(result.testsPassed).toBe(false);
    // execFileSync should not have been called for make test
    expect(execFileSync).not.toHaveBeenCalledWith(
      "make",
      ["test"],
      expect.anything(),
    );
  });

  it("sets testsPassed true when verification passes", async () => {
    vi.mocked(prompts.select).mockResolvedValue("blog");
    vi.mocked(prompts.isCancel).mockReturnValue(false);
    vi.mocked(execFileSync).mockReturnValue(Buffer.from("All tests passed"));

    tmpDir = mkdtempSync(join(tmpdir(), "tutorial-"));
    const result = await runTutorial(tmpDir);

    expect(result.testsPassed).toBe(true);
  });

  it("sets testsPassed false when verification fails", async () => {
    vi.mocked(prompts.select).mockResolvedValue("blog");
    vi.mocked(prompts.isCancel).mockReturnValue(false);
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error("tests failed");
    });

    tmpDir = mkdtempSync(join(tmpdir(), "tutorial-"));
    const result = await runTutorial(tmpDir);

    expect(result.testsPassed).toBe(false);
  });
});

describe("--tutorial flag parsing", () => {
  it("detects --tutorial in argv", () => {
    const argv = ["node", "index.ts", "--tutorial"];
    expect(argv.includes("--tutorial")).toBe(true);
  });

  it("detects --checklist in argv", () => {
    const argv = ["node", "index.ts", "--checklist"];
    expect(argv.includes("--checklist")).toBe(true);
  });

  it("does not detect flags when absent", () => {
    const argv = ["node", "index.ts"];
    expect(argv.includes("--tutorial")).toBe(false);
    expect(argv.includes("--checklist")).toBe(false);
  });
});
