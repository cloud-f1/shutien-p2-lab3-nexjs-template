/**
 * E21 + E75 — Setup: install dependencies, create DB, run migrations, verify.
 *
 * Uses execFileSync with explicit argv arrays to avoid shell injection risks.
 * This is a CLI bootstrap tool that only runs hardcoded commands.
 *
 * E75: Docker-based DB creation (consistent with `make ensure-db`),
 *      actionable error recovery guidance per step.
 */

import { execFileSync } from "node:child_process";
import type { ProjectConfig, StepResult } from "./types.js";

function timestamp(): string {
  return new Date().toISOString();
}

interface SetupCommand {
  stepName: string;
  bin: string;
  args: string[];
  cwd: string;
  /** Actionable guidance shown when this step fails. */
  recoveryHint?: string;
}

/** Recovery hints for each setup step (E75-S3). */
const RECOVERY_HINTS: Record<string, string> = {
  pnpm_install:
    "pnpm install failed. Ensure pnpm is installed (npm i -g pnpm) or run `make doctor` for diagnostics.",
  uv_sync:
    "uv sync failed. Ensure uv is installed (curl -LsSf https://astral.sh/uv/install.sh | sh) or run `make doctor`.",
  docker_db_create:
    "Database creation failed. Ensure Docker is running and the DB container is up: `docker compose up -d db`. " +
    "Then retry, or run `make ensure-db` manually.",
  alembic_migrate:
    "Alembic migration failed. Ensure the database is running (`docker compose up -d db`) " +
    "and the DATABASE_URL in .env is correct. Run `make doctor` for diagnostics.",
  generate_types:
    "Type generation failed. Ensure `pnpm install` succeeded first. Run `make doctor` for diagnostics.",
};

/**
 * Run a setup command, returning a StepResult.
 * Appends recovery guidance to the error message on failure (E75-S3).
 */
function runStep(cmd: SetupCommand): StepResult {
  try {
    execFileSync(cmd.bin, cmd.args, {
      cwd: cmd.cwd,
      encoding: "utf-8",
      timeout: 300_000, // 5 minutes
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { step: cmd.stepName, status: "pass", at: timestamp() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const hint = cmd.recoveryHint ?? RECOVERY_HINTS[cmd.stepName] ?? "";
    const fullError = hint ? `${message.slice(0, 150)}\n💡 ${hint}` : message.slice(0, 200);
    return {
      step: cmd.stepName,
      status: "fail",
      at: timestamp(),
      error: fullError,
    };
  }
}

/**
 * Run all setup steps. Each step is independent — failures don't block others.
 *
 * E75: createdb replaced with `docker compose exec -T db createdb` to match
 * the Docker-based workflow used by `make ensure-db` / `make go`.
 */
export function runSetup(
  projectRoot: string,
  config: ProjectConfig,
): StepResult[] {
  const serverDir = `${projectRoot}/server`;
  const dbUser = `${config.dbName}_user`;
  const commands: SetupCommand[] = [
    {
      stepName: "pnpm_install",
      bin: "pnpm",
      args: ["install"],
      cwd: projectRoot,
    },
    {
      stepName: "uv_sync",
      bin: "uv",
      args: ["sync"],
      cwd: serverDir,
    },
    {
      stepName: "docker_db_create",
      bin: "docker",
      args: ["compose", "exec", "-T", "db", "createdb", "-U", dbUser, config.dbName],
      cwd: projectRoot,
      recoveryHint: RECOVERY_HINTS.docker_db_create,
    },
    {
      stepName: "alembic_migrate",
      bin: "uv",
      args: ["run", "alembic", "upgrade", "head"],
      cwd: serverDir,
    },
    {
      stepName: "generate_types",
      bin: "pnpm",
      args: ["generate:types"],
      cwd: projectRoot,
    },
  ];

  return commands.map(runStep);
}
