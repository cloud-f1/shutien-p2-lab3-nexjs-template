/**
 * E21 — Prerequisite validation
 * Detects installed tools and compares versions via semver.
 *
 * Note: execSync is used here with hardcoded commands only (no user input),
 * so command injection is not a concern. This is a CLI bootstrap tool.
 */

import { execSync } from "node:child_process";
import semver from "semver";
import type { PrereqResult } from "./types.js";

interface ToolSpec {
  name: string;
  command: string;
  required: string;       // semver range or "any"
  versionExtract: RegExp; // first capture group = version
  installHint: string;
}

const TOOL_SPECS: ToolSpec[] = [
  {
    name: "node",
    command: "node --version",
    required: ">=20.0.0",
    versionExtract: /v?(\d+\.\d+\.\d+)/,
    installHint: "Install Node.js 20+: https://nodejs.org/ or `brew install node`",
  },
  {
    name: "pnpm",
    command: "pnpm --version",
    required: "any",
    versionExtract: /(\d+\.\d+\.\d+)/,
    installHint: "Install pnpm: `corepack enable && corepack prepare pnpm@latest --activate`",
  },
  {
    name: "python",
    command: "python3 --version",
    required: ">=3.12.0",
    versionExtract: /(\d+\.\d+\.\d+)/,
    installHint: "Install Python 3.12+: https://python.org/ or `brew install python@3.12`",
  },
  {
    name: "uv",
    command: "uv --version",
    required: "any",
    versionExtract: /(\d+\.\d+\.\d+)/,
    installHint: "Install uv: `curl -LsSf https://astral.sh/uv/install.sh | sh`",
  },
  {
    name: "postgresql",
    command: "psql --version",
    required: "any",
    versionExtract: /(\d+\.\d+\.?\d*)/,
    installHint: "Install PostgreSQL: `brew install postgresql@16` or https://postgresql.org/download/",
  },
  {
    name: "git",
    command: "git --version",
    required: "any",
    versionExtract: /(\d+\.\d+\.\d+)/,
    installHint: "Install git: `brew install git` or https://git-scm.com/",
  },
];

/**
 * Run a command and return stdout, or null on failure.
 * Only used with hardcoded commands — no user input.
 */
function tryExec(command: string): string | null {
  try {
    return execSync(command, {
      encoding: "utf-8",
      timeout: 10_000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Extract a semver-ish version from command output.
 */
function extractVersion(output: string, pattern: RegExp): string | null {
  const match = output.match(pattern);
  if (!match?.[1]) return null;
  // Normalize 2-part versions like "16.2" to "16.2.0"
  const parts = match[1].split(".");
  while (parts.length < 3) parts.push("0");
  return parts.join(".");
}

/**
 * Check a single prerequisite tool.
 */
export function checkTool(spec: ToolSpec): PrereqResult {
  const output = tryExec(spec.command);
  const found = output ? extractVersion(output, spec.versionExtract) : null;

  let pass = false;
  if (found) {
    if (spec.required === "any") {
      pass = true;
    } else {
      pass = semver.satisfies(found, spec.required);
    }
  }

  return {
    name: spec.name,
    required: spec.required,
    found,
    pass,
    installHint: spec.installHint,
  };
}

/**
 * Run all prerequisite checks. Returns array of results.
 */
export function checkAllPrerequisites(): PrereqResult[] {
  return TOOL_SPECS.map(checkTool);
}

// Exported for testing — allows injecting custom specs
export { TOOL_SPECS, extractVersion, tryExec };
export type { ToolSpec };
