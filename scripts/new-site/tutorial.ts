/**
 * E26 — Tutorial mode orchestrator
 * Adds --tutorial guided onboarding: domain type prompt, post-scaffold
 * verification, and next-steps checklist with file existence detection.
 */

import * as p from "@clack/prompts";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import YAML from "yaml";
import type { DomainChoice, TutorialResult, StepResult } from "./types.js";
import { buildChecklist, renderChecklist } from "./checklist.js";

/** Domain options for the interactive select prompt. */
export const DOMAIN_OPTIONS = [
  {
    value: "blog" as const,
    label: "Blog (posts with title, body, published status)",
    example: "docs/templates/domain/examples/blog.yaml",
  },
  {
    value: "todo" as const,
    label: "Todo App (tasks with priority and due dates)",
    example: "docs/templates/domain/examples/todo.yaml",
  },
  {
    value: "crm" as const,
    label: "CRM (contacts with company, email, phone)",
    example: "docs/templates/domain/examples/crm.yaml",
  },
  {
    value: "custom" as const,
    label: "Custom — I'll design my own domain",
  },
  {
    value: "skip" as const,
    label: "Skip for now",
  },
];

/**
 * Format a YAML domain example's fields for display.
 */
export function formatDomainFields(yamlPath: string): string | null {
  if (!existsSync(yamlPath)) return null;
  try {
    const content = readFileSync(yamlPath, "utf-8");
    const parsed = YAML.parse(content) as {
      name: string;
      fields: Array<{ name: string; type: string; required: boolean }>;
    };

    const lines = [`Domain: ${parsed.name}`, "Fields:"];
    for (const field of parsed.fields) {
      const req = field.required ? "(required)" : "(optional)";
      lines.push(`  - ${field.name}: ${field.type} ${req}`);
    }
    return lines.join("\n");
  } catch {
    return null;
  }
}

/**
 * Step 7: Interactive domain type prompt.
 * Returns the user's domain choice.
 */
export async function promptDomainType(projectRoot: string): Promise<DomainChoice> {
  p.log.step("Choose your first domain");

  const selected = await p.select({
    message: "What are you building?",
    options: DOMAIN_OPTIONS.map((opt) => ({
      value: opt.value,
      label: opt.label,
    })),
  });

  if (p.isCancel(selected)) {
    return { type: "skip" };
  }

  const choice = DOMAIN_OPTIONS.find((o) => o.value === selected);

  if (selected === "custom") {
    p.note(
      [
        "To design your own domain, follow the SDD workflow:",
        "",
        "1. Design your API spec first:",
        "   → Guide: docs/guides/openapi-patterns.md",
        "",
        "2. Follow the epic pipeline (spec → implement → qa):",
        "   → Guide: docs/guides/first-epic-walkthrough.md",
        "",
        "3. OpenAPI first → server code → client code",
      ].join("\n"),
      "Custom Domain",
    );
    return { type: "custom" };
  }

  if (selected === "skip") {
    p.log.info("No worries — you can create a domain later with:");
    p.log.info('  claude "/athena:domain blog"');
    return { type: "skip" };
  }

  // Preset domain selected — show example config
  const domainType = selected as "blog" | "todo" | "crm";
  const examplePath = choice?.example
    ? resolve(projectRoot, choice.example)
    : null;

  if (examplePath) {
    const formatted = formatDomainFields(examplePath);
    if (formatted) {
      p.note(formatted, `${domainType.charAt(0).toUpperCase() + domainType.slice(1)} Domain`);
    }
  }

  p.log.info("To generate this domain, run:");
  p.log.info(`  claude "/athena:domain ${domainType}"`);
  p.log.info("");
  p.log.info("Full walkthrough: docs/guides/first-epic-walkthrough.md");

  return {
    type: domainType,
    exampleConfig: choice?.example,
  };
}

/**
 * Step 8: Post-scaffold verification — run `make test`.
 */
export function runVerification(projectRoot: string): StepResult {
  const spinner = p.spinner();
  spinner.start("Running tests to verify scaffold...");

  try {
    execFileSync("make", ["test"], {
      cwd: projectRoot,
      timeout: 120_000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    spinner.stop("All tests passed");
    return {
      step: "verify_tests",
      status: "pass",
      at: new Date().toISOString(),
    };
  } catch (err: unknown) {
    spinner.stop("Some tests failed");

    let errorMsg = "Unknown error";
    if (err && typeof err === "object" && "stderr" in err) {
      const stderr = (err as { stderr: Buffer | string }).stderr;
      errorMsg = String(stderr).slice(0, 200);
    }

    p.log.warn("Some tests failed. This may be expected before full setup.");
    p.log.info("Troubleshooting: docs/guides/quickstart.md");
    if (errorMsg !== "Unknown error") {
      p.log.info(`Error: ${errorMsg}`);
    }
    p.log.info("Try running `make test` again after completing setup.");

    return {
      step: "verify_tests",
      status: "fail",
      at: new Date().toISOString(),
      error: "Some tests failed. See docs/guides/quickstart.md for troubleshooting.",
    };
  }
}

/**
 * Run the full tutorial flow (steps 7-9).
 */
export async function runTutorial(
  projectRoot: string,
  options?: { skipVerification?: boolean },
): Promise<TutorialResult> {
  p.log.step("Tutorial Mode — Guided Onboarding");

  // Step 7: Domain type prompt
  const domainChoice = await promptDomainType(projectRoot);

  // Step 8: Post-scaffold verification
  let testsPassed = false;
  if (!options?.skipVerification) {
    const verifyResult = runVerification(projectRoot);
    testsPassed = verifyResult.status === "pass";
  }

  // Step 9: Checklist with status detection
  const checklist = buildChecklist(projectRoot, { testsPassed });
  renderChecklist(checklist);

  return {
    domainChoice,
    testsPassed,
    checklist,
  };
}
