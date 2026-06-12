#!/usr/bin/env node
/**
 * E21 — Interactive Site Builder CLI
 * Entry point: npx tsx scripts/new-site/index.ts
 */

import * as p from "@clack/prompts";
import { execFileSync } from "node:child_process";
import { checkAllPrerequisites } from "./checks.js";
import { collectConfig } from "./prompts.js";
import { scaffoldFiles } from "./scaffold.js";
import { runSetup } from "./setup.js";
import { buildManifest, writeManifest } from "./manifest.js";
import { runTutorial } from "./tutorial.js";
import { buildChecklist, renderChecklist } from "./checklist.js";
import type { StepResult } from "./types.js";

// Graceful Ctrl+C handling
process.on("SIGINT", () => {
  p.cancel("Setup cancelled.");
  process.exit(0);
});

async function main() {
  const isDryRun = process.argv.includes("--dry-run");
  const isTutorial = process.argv.includes("--tutorial");
  const isChecklist = process.argv.includes("--checklist");
  const isSmoke = process.argv.includes("--smoke");
  const projectRoot = process.cwd();

  // ── Standalone checklist mode ─────────────────────────────────────
  if (isChecklist) {
    p.intro("AI-Coding-Template — Setup Checklist");
    const checklist = buildChecklist(projectRoot);
    renderChecklist(checklist);
    p.outro("Run with --tutorial for guided onboarding.");
    return;
  }

  p.intro("AI-Coding-Template — New Site Builder");

  // ── Step 1: Prerequisites ──────────────────────────────────────────
  const prereqSpinner = p.spinner();
  prereqSpinner.start("Checking prerequisites...");

  const prereqs = checkAllPrerequisites();
  const allPass = prereqs.every((r) => r.pass);

  prereqSpinner.stop(allPass ? "All prerequisites met" : "Some prerequisites missing");

  // Display results
  for (const r of prereqs) {
    const icon = r.pass ? "\x1b[32m+\x1b[0m" : "\x1b[31mx\x1b[0m";
    const version = r.found ?? "not found";
    const req = r.required === "any" ? "" : ` (requires ${r.required})`;
    p.log.info(`${icon} ${r.name}: ${version}${req}`);
    if (!r.pass) {
      p.log.warn(`  ${r.installHint}`);
    }
  }

  if (!allPass) {
    const shouldContinue = await p.confirm({
      message: "Some prerequisites are missing. Continue anyway?",
      initialValue: false,
    });
    if (p.isCancel(shouldContinue) || !shouldContinue) {
      p.cancel("Fix prerequisites and try again.");
      process.exit(1);
    }
  }

  const prereqStep: StepResult = {
    step: "prerequisites",
    status: allPass ? "pass" : "skip",
    at: new Date().toISOString(),
  };

  // ── Step 2: Collect config ─────────────────────────────────────────
  p.log.step("Project configuration");
  const config = await collectConfig();
  if (!config) {
    process.exit(0);
  }

  const configStep: StepResult = {
    step: "configure",
    status: "pass",
    at: new Date().toISOString(),
  };

  // Show summary
  p.note(
    [
      `Project:  ${config.displayName} (${config.slug})`,
      `Database: ${config.dbName}`,
      `Theme:    ${config.theme}`,
      `OAuth:    ${config.oauthProviders.join(", ") || "none"}`,
      `Deploy:   ${config.deployTarget}`,
    ].join("\n"),
    "Configuration Summary",
  );

  const confirmed = await p.confirm({
    message: "Proceed with this configuration?",
    initialValue: true,
  });

  if (p.isCancel(confirmed) || !confirmed) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }

  if (isDryRun) {
    p.log.info("Dry run — skipping scaffold, setup, and manifest.");
    const manifest = buildManifest(config, prereqs, [prereqStep, configStep]);
    p.log.info(`Manifest preview:\n${JSON.stringify(manifest, null, 2)}`);
    p.outro("Dry run complete.");
    return;
  }

  // ── Step 3: Scaffold ───────────────────────────────────────────────
  const scaffoldSpinner = p.spinner();
  scaffoldSpinner.start("Scaffolding files...");

  const { processed, skipped } = scaffoldFiles(projectRoot, config);

  scaffoldSpinner.stop(`Scaffolded ${processed.length} files`);

  if (processed.length > 0) {
    p.log.info(`Processed: ${processed.join(", ")}`);
  }

  const scaffoldStep: StepResult = {
    step: "scaffold",
    status: "pass",
    at: new Date().toISOString(),
  };

  // ── Step 4: Setup ──────────────────────────────────────────────────
  const setupSpinner = p.spinner();
  setupSpinner.start("Running setup (install, migrate, generate)...");

  const setupResults = runSetup(projectRoot, config);

  const failedSetups = setupResults.filter((r) => r.status === "fail");
  setupSpinner.stop(
    failedSetups.length === 0
      ? "Setup complete"
      : `Setup complete with ${failedSetups.length} warning(s)`,
  );

  for (const r of setupResults) {
    const icon = r.status === "pass" ? "\x1b[32m+\x1b[0m" : "\x1b[33m!\x1b[0m";
    p.log.info(`${icon} ${r.step}: ${r.status}`);
    if (r.error) {
      p.log.warn(`  ${r.error.slice(0, 100)}`);
    }
  }

  // ── Step 5: Write manifest ─────────────────────────────────────────
  const allSteps = [prereqStep, configStep, scaffoldStep, ...setupResults];
  const manifest = buildManifest(config, prereqs, allSteps);
  const manifestPath = writeManifest(projectRoot, manifest);

  p.log.success(`Build manifest written to ${manifestPath}`);

  // ── Step 6: Next steps ─────────────────────────────────────────────
  p.note(
    [
      "1. Run `make dev` to start the development server",
      "2. Edit `docs/openapi.yaml` to add your first endpoint",
      "3. Run `/athena:loop` to begin your first epic",
      "",
      failedSetups.length > 0
        ? "Note: Some setup steps had warnings — check the output above."
        : "All setup steps completed successfully!",
    ].join("\n"),
    "Next Steps",
  );

  // ── Smoke test (--smoke flag) ─────────────────────────────────────
  if (isSmoke) {
    const smokeSpinner = p.spinner();
    smokeSpinner.start("Running smoke tests...");

    let smokeStatus: "pass" | "fail" = "pass";
    let smokeError: string | undefined;
    try {
      execFileSync("bash", ["scripts/smoke-test.sh", projectRoot], {
        cwd: projectRoot,
        stdio: "inherit",
      });
    } catch (err) {
      smokeStatus = "fail";
      smokeError = err instanceof Error ? err.message : String(err);
    }

    smokeSpinner.stop(
      smokeStatus === "pass"
        ? "Smoke tests passed"
        : "Smoke tests failed",
    );

    const smokeStep: StepResult = {
      step: "smoke_test",
      status: smokeStatus,
      at: new Date().toISOString(),
      ...(smokeError && { error: smokeError }),
    };
    manifest.steps_completed.push(smokeStep);
    writeManifest(projectRoot, manifest);

    if (smokeStatus === "fail") {
      p.log.error("Smoke test failed — check output above.");
    }
  }

  // ── Tutorial mode (steps 7-9) ──────────────────────────────────────
  if (isTutorial) {
    const tutorialResult = await runTutorial(projectRoot);
    // Append tutorial steps to manifest
    const tutorialSteps: StepResult[] = tutorialResult.checklist
      .filter((c) => c.done)
      .map((c) => ({
        step: `checklist_${c.id}`,
        status: "pass" as const,
        at: new Date().toISOString(),
      }));
    if (tutorialSteps.length > 0) {
      manifest.steps_completed.push(...tutorialSteps);
      writeManifest(projectRoot, manifest);
    }
  }

  p.outro(`${config.displayName} is ready! Happy coding.`);
}

main().catch((err) => {
  p.log.error(String(err));
  process.exit(1);
});
