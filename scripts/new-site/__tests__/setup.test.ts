/**
 * E21 — Unit tests for setup module
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ProjectConfig } from "../types.js";

// Mock execFileSync before importing module
const mockExecFileSync = vi.fn();
vi.mock("node:child_process", () => ({
  execFileSync: (...args: unknown[]) => mockExecFileSync(...args),
}));

// Import after mocking
const { runSetup } = await import("../setup.js");

function makeConfig(overrides?: Partial<ProjectConfig>): ProjectConfig {
  return {
    slug: "test-app",
    displayName: "Test App",
    description: "A test application",
    author: "Dev <dev@test.com>",
    dbName: "test_app",
    theme: "indigo",
    oauthProviders: ["google"],
    deployTarget: "zeabur",
    ...overrides,
  };
}

beforeEach(() => {
  mockExecFileSync.mockReset();
});

describe("runSetup", () => {
  it("runs all 5 setup commands with docker-based DB creation", () => {
    mockExecFileSync.mockReturnValue("");
    const results = runSetup("/project", makeConfig());

    expect(results).toHaveLength(5);
    expect(results.map((r) => r.step)).toEqual([
      "pnpm_install",
      "uv_sync",
      "docker_db_create",
      "alembic_migrate",
      "generate_types",
    ]);
  });

  it("returns pass for all steps when commands succeed", () => {
    mockExecFileSync.mockReturnValue("");
    const results = runSetup("/project", makeConfig());

    for (const r of results) {
      expect(r.status).toBe("pass");
      expect(r.at).toBeTruthy();
    }
  });

  it("returns fail with recovery hint when docker db create throws", () => {
    mockExecFileSync.mockImplementation(
      (bin: string, args: string[]) => {
        if (bin === "docker") {
          throw new Error("Cannot connect to the Docker daemon");
        }
        return "";
      },
    );

    const results = runSetup("/project", makeConfig());

    const dbResult = results.find((r) => r.step === "docker_db_create");
    expect(dbResult?.status).toBe("fail");
    expect(dbResult?.error).toContain("Cannot connect to the Docker daemon");
    expect(dbResult?.error).toContain("docker compose up -d db");

    // Other steps should still pass
    const pnpmResult = results.find((r) => r.step === "pnpm_install");
    expect(pnpmResult?.status).toBe("pass");
  });

  it("includes recovery hints for all failing steps", () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error("command failed");
    });

    const results = runSetup("/project", makeConfig());

    for (const r of results) {
      expect(r.status).toBe("fail");
      // All steps should have recovery guidance
      expect(r.error).toContain("\n");
    }
  });

  it("uses docker compose exec for DB creation with correct user and dbName", () => {
    mockExecFileSync.mockReturnValue("");
    runSetup("/project", makeConfig({ dbName: "my_custom_db" }));

    // Find the docker call
    const dockerCall = mockExecFileSync.mock.calls.find(
      (call: unknown[]) => call[0] === "docker",
    );
    expect(dockerCall).toBeTruthy();
    expect(dockerCall![1]).toEqual([
      "compose", "exec", "-T", "db", "createdb", "-U", "my_custom_db_user", "my_custom_db",
    ]);
  });

  it("uses correct cwd for server commands", () => {
    mockExecFileSync.mockReturnValue("");
    runSetup("/my/project", makeConfig());

    // uv sync should use server dir
    const uvCall = mockExecFileSync.mock.calls.find(
      (call: unknown[]) => call[0] === "uv" && call[1][0] === "sync",
    );
    expect(uvCall![2].cwd).toBe("/my/project/server");

    // pnpm install should use project root
    const pnpmCall = mockExecFileSync.mock.calls.find(
      (call: unknown[]) => call[0] === "pnpm" && call[1][0] === "install",
    );
    expect(pnpmCall![2].cwd).toBe("/my/project");
  });

  it("handles non-Error exceptions", () => {
    mockExecFileSync.mockImplementation(() => {
      throw "string error";
    });

    const results = runSetup("/project", makeConfig());
    expect(results[0].status).toBe("fail");
    expect(results[0].error).toContain("string error");
  });

  it("each step has an ISO timestamp", () => {
    mockExecFileSync.mockReturnValue("");
    const results = runSetup("/project", makeConfig());

    for (const r of results) {
      expect(r.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });
});
