/* ============================================================================
 * E177 — Accessibility audit helper
 *
 * Wraps `@axe-core/playwright` with a project-tuned config so every spec
 * runs the same WCAG 2.1 AA rule set and produces a consistent failure
 * message. Use `runAxe(page)` for the default page-level scan and
 * `runAxeOnSelector(page, sel)` to scope a scan to an open primitive.
 *
 * The reporter prints violations as a compact table (rule id, impact,
 * count, first node selector, help URL) — the full JSON dump is also
 * logged so CI artifacts stay self-contained.
 *
 * See docs/design/A11Y_BASELINE.md for the rule rationale and how to
 * suppress an intentional violation (don't — fix the primitive instead).
 * ============================================================================ */

import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { Result as AxeResult, ImpactValue } from "axe-core";

/** WCAG levels we gate on — A + AA per E177 acceptance criteria. */
export const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] as const;

export interface AxeScanOptions {
  /** Limit the scan to one or more selectors. Omit to scan the full page. */
  include?: string | string[];
  /** Selectors excluded from the scan (e.g. third-party iframes). */
  exclude?: string | string[];
  /** Disable specific axe rule ids — DO NOT USE for new primitives.
   *  Provided only for emergency CI unblocks; prefer fixing the violation. */
  disableRules?: string[];
  /**
   * Fail only on these impact levels. The E177 baseline is "fail on any
   * violation" (default `[]` = include all impacts). Pass
   * `["critical", "serious"]` to mirror the legacy E130 behavior.
   */
  failOnImpacts?: ImpactValue[];
}

/**
 * Run axe against the current page and return the filtered violation list.
 *
 * Callers are expected to assert `.toHaveLength(0)` on the result. The helper
 * does NOT assert itself so a spec can format its own failure message or
 * conditionally skip if the dev server isn't reachable.
 */
export async function runAxe(
  page: Page,
  opts: AxeScanOptions = {},
): Promise<AxeResult[]> {
  let builder = new AxeBuilder({ page }).withTags([...WCAG_TAGS]);

  if (opts.include) {
    const targets = Array.isArray(opts.include) ? opts.include : [opts.include];
    for (const sel of targets) builder = builder.include(sel);
  }
  if (opts.exclude) {
    const targets = Array.isArray(opts.exclude) ? opts.exclude : [opts.exclude];
    for (const sel of targets) builder = builder.exclude(sel);
  }
  if (opts.disableRules?.length) {
    builder = builder.disableRules(opts.disableRules);
  }

  const results = await builder.analyze();
  const filterImpacts = opts.failOnImpacts;
  if (!filterImpacts || filterImpacts.length === 0) {
    return results.violations;
  }
  return results.violations.filter((v) => filterImpacts.includes(v.impact));
}

/** Convenience: scan a single open primitive (Modal/Drawer body, etc). */
export function runAxeOnSelector(
  page: Page,
  selector: string,
  opts: Omit<AxeScanOptions, "include"> = {},
): Promise<AxeResult[]> {
  return runAxe(page, { ...opts, include: selector });
}

/**
 * Format axe violations as a one-screen-friendly summary so CI logs surface
 * the actual issue without dumping 400 lines of JSON. Pair with the raw
 * `JSON.stringify` dump for forensic detail.
 */
export function formatViolations(violations: AxeResult[]): string {
  if (violations.length === 0) return "(none)";
  return violations
    .map((v) => {
      const firstNode = v.nodes[0];
      const target = firstNode?.target?.join(" ") ?? "(no target)";
      return [
        `  ❌ ${v.id} (${v.impact ?? "unknown"}) × ${v.nodes.length}`,
        `     ${v.description}`,
        `     first: ${target}`,
        `     fix:   ${v.help}`,
        `     docs:  ${v.helpUrl}`,
      ].join("\n");
    })
    .join("\n\n");
}
