/**
 * E26 — Post-setup checklist with file existence detection
 * Detects progress across 8 items and renders a formatted checklist.
 */

import { existsSync, readdirSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as p from "@clack/prompts";
import type { ChecklistItem } from "./types.js";
import { checkAllPrerequisites } from "./checks.js";

/**
 * Check whether all prerequisite tools are installed.
 */
export function detectPrerequisites(): boolean {
  const prereqs = checkAllPrerequisites();
  return prereqs.every((r) => r.pass);
}

/**
 * Check whether .build-manifest.yaml exists.
 */
export function detectManifest(projectRoot: string): boolean {
  return existsSync(join(projectRoot, ".build-manifest.yaml"));
}

/**
 * Check whether dependencies are installed (node_modules + server/.venv).
 */
export function detectDependencies(projectRoot: string): boolean {
  return (
    existsSync(join(projectRoot, "node_modules")) &&
    existsSync(join(projectRoot, "server", ".venv"))
  );
}

/**
 * Check whether the database has been migrated.
 * Reads the build manifest for an alembic_migrate step with status "pass".
 */
export function detectMigration(projectRoot: string): boolean {
  const manifestPath = join(projectRoot, ".build-manifest.yaml");
  if (!existsSync(manifestPath)) return false;
  try {
    const content = readFileSync(manifestPath, "utf-8");
    return content.includes("alembic_migrate") && content.includes("status: pass");
  } catch {
    return false;
  }
}

/**
 * Check whether a first domain has been created.
 * Looks for any subdirectory in server/app/domains/ besides __init__.py and __pycache__.
 */
export function detectFirstDomain(projectRoot: string): boolean {
  const domainsDir = join(projectRoot, "server", "app", "domains");
  if (!existsSync(domainsDir)) return false;
  try {
    const entries = readdirSync(domainsDir);
    return entries.some((entry) => {
      if (entry === "__init__.py" || entry === "__pycache__") return false;
      const full = join(domainsDir, entry);
      return statSync(full).isDirectory();
    });
  } catch {
    return false;
  }
}

/**
 * Check whether the OpenAPI spec has been updated after scaffold.
 * Compares mtime of docs/openapi/ against .build-manifest.yaml.
 */
export function detectOpenApiUpdated(projectRoot: string): boolean {
  const manifestPath = join(projectRoot, ".build-manifest.yaml");
  const openapiDir = join(projectRoot, "docs", "openapi");
  if (!existsSync(manifestPath) || !existsSync(openapiDir)) return false;
  try {
    const manifestMtime = statSync(manifestPath).mtimeMs;
    const entries = readdirSync(openapiDir);
    return entries.some((entry) => {
      const full = join(openapiDir, entry);
      return statSync(full).mtimeMs > manifestMtime;
    });
  } catch {
    return false;
  }
}

/**
 * Check whether EPIC_INDEX.md has a non-template epic entry.
 * Looks for a line matching "| E" that doesn't have "⬜" in all step columns.
 */
export function detectFirstEpic(projectRoot: string): boolean {
  const epicPath = join(projectRoot, "docs", "epics", "EPIC_INDEX.md");
  if (!existsSync(epicPath)) return false;
  try {
    const content = readFileSync(epicPath, "utf-8");
    const lines = content.split("\n");
    // Look for any epic row that has at least one non-pending step
    return lines.some((line) => {
      if (!line.startsWith("| E")) return false;
      // Count non-pending status markers
      const hasProgress = line.includes("✅") || line.includes("🔄");
      return hasProgress;
    });
  } catch {
    return false;
  }
}

/**
 * Build the full 8-item checklist with detection results.
 */
export function buildChecklist(
  projectRoot: string,
  options?: { testsPassed?: boolean },
): ChecklistItem[] {
  return [
    {
      id: "prerequisites",
      label: "Prerequisites installed",
      done: detectPrerequisites(),
      hint: "Run: npx tsx scripts/new-site/index.ts",
      docLink: "docs/guides/quickstart.md",
    },
    {
      id: "scaffolded",
      label: "Project scaffolded",
      done: detectManifest(projectRoot),
      hint: "Run: pnpm new-site",
      docLink: "docs/guides/quickstart.md",
    },
    {
      id: "dependencies",
      label: "Dependencies installed",
      done: detectDependencies(projectRoot),
      hint: "Run: pnpm install && cd server && uv sync",
      docLink: "docs/guides/quickstart.md",
    },
    {
      id: "database",
      label: "Database created + migrated",
      done: detectMigration(projectRoot),
      hint: "Run: make db-create && make db-migrate",
      docLink: "docs/guides/quickstart.md",
    },
    {
      id: "tests",
      label: "Tests passing",
      done: options?.testsPassed ?? false,
      hint: "Run: make test",
      docLink: "docs/guides/quickstart.md",
    },
    {
      id: "first_domain",
      label: "First domain created",
      done: detectFirstDomain(projectRoot),
      hint: 'Run: claude "/athena:domain blog"',
      docLink: "docs/guides/first-epic-walkthrough.md",
    },
    {
      id: "openapi_updated",
      label: "OpenAPI spec updated",
      done: detectOpenApiUpdated(projectRoot),
      hint: "Edit: docs/openapi/ to add your domain endpoints",
      docLink: "docs/guides/openapi-patterns.md",
    },
    {
      id: "first_epic",
      label: "First epic started",
      done: detectFirstEpic(projectRoot),
      hint: "Run: /athena:loop",
      docLink: "docs/epics/EPIC_INDEX.md",
    },
  ];
}

/**
 * Render the checklist using @clack/prompts formatting.
 */
export function renderChecklist(items: ChecklistItem[]): void {
  const doneCount = items.filter((i) => i.done).length;
  const total = items.length;

  const lines: string[] = [];

  for (const item of items) {
    const icon = item.done ? "\x1b[32m✓\x1b[0m" : "\x1b[90m○\x1b[0m";
    lines.push(`${icon}  ${item.label}`);
    if (!item.done) {
      if (item.hint) {
        lines.push(`   \x1b[90m→ ${item.hint}\x1b[0m`);
      }
      if (item.docLink) {
        lines.push(`   \x1b[90m→ Guide: ${item.docLink}\x1b[0m`);
      }
    }
  }

  const summary =
    doneCount === total
      ? "All done! Your project is fully set up."
      : `${doneCount} of ${total} complete — keep going!`;

  lines.push("");
  lines.push(summary);

  p.note(lines.join("\n"), "Post-Setup Checklist");
}
