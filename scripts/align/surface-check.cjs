#!/usr/bin/env node
/*
 * surface-check.cjs — deterministic UI-surface alignment linter for the Next.js app.
 *
 * The mechanical half of the alignment audit (see .claude/skills/alignment-audit + /athena:align).
 * Catches the classes of "missing/misaligned part" that don't need judgment:
 *   1. dead-link     — an internal <Link>/href/router.push target that resolves to NO route  (FAIL)
 *   2. missing-label — a nav/route segment with no breadcrumb label (renders English/raw)     (FAIL)
 *   3. orphan-page   — a dashboard route reachable by URL but not in the nav nor allowlisted  (WARN)
 *
 * Usage:  node scripts/align/surface-check.cjs            # report + exit 1 on any FAIL
 *         node scripts/align/surface-check.cjs --strict   # orphans also FAIL
 *
 * Pure stdlib, no deps. Reads next-app/ source.
 * Wired into scripts/smoke.sh (surface-check gate).
 *
 * Template-specific notes:
 *   - Nav items are defined in next-app/components/app-sidebar.tsx (navMain array)
 *   - Breadcrumb labels are in next-app/components/app-breadcrumb.tsx (LABELS map)
 *   - Dashboard routes live under next-app/app/(dashboard)/dashboard/
 *   - REACHABLE_ALLOWLIST covers routes reachable via user dropdown / query params
 *     (not in the sidebar nav) — add new ones here as the app grows.
 *
 * TODO for project-specific adaptation:
 *   - If you add new nav components, add their href patterns to navUrls extraction.
 *   - If you rename LABELS in app-breadcrumb.tsx, adjust the labelKeys regex here.
 *   - For deep-link query params (e.g. ?new=1), those are not caught as dead links
 *     because they don't change the route — this is intentional.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const APP = path.join(ROOT, "next-app", "app");
const COMPONENTS = path.join(ROOT, "next-app", "components");

// This template's nav is defined inline in app-sidebar.tsx (not a separate nav-items file)
const SIDEBAR_FILE = path.join(COMPONENTS, "app-sidebar.tsx");
const BREADCRUMB_FILE = path.join(COMPONENTS, "app-breadcrumb.tsx");
const STRICT = process.argv.includes("--strict");

// Routes reachable by non-nav affordance (user dropdown, child routes, deep links, query-param modals).
// Extend this list as the template grows.
const REACHABLE_ALLOWLIST = [
  "/dashboard",
  "/dashboard/account",  // user dropdown
  "/dashboard/components", // component showcase (dev reference)
];

function walk(dir, test, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, test, out);
    else if (test(p)) out.push(p);
  }
  return out;
}

// ---- 1. Known routes (from app/**/page.tsx) ----
const routeOf = (file) => {
  let r = file.replace(/.*\/app\//, "/").replace(/\/page\.(t|j)sx?$/, "");
  r = r.replace(/\/\([^)]+\)/g, ""); // strip (route groups) like (dashboard), (auth)
  return r === "" ? "/" : r;
};
const routes = walk(APP, (p) => /\/page\.(t|j)sx?$/.test(p)).map(routeOf);
const routeSegs = routes.map((r) => r.split("/").filter(Boolean));

const matchesRoute = (linkPath) => {
  // Strip query params and hash
  const clean = linkPath.split("?")[0].split("#")[0];
  const ls = clean.split("/").filter(Boolean);
  return routeSegs.some(
    (rs) =>
      rs.length === ls.length &&
      rs.every((seg, i) => seg === ls[i] || seg.startsWith("[") || ls[i] === "[d]"),
  );
};

// ---- 2. Nav targets from app-sidebar.tsx ----
// Extracts url: "/dashboard/foo" patterns from the navMain array
const sidebarSrc = fs.existsSync(SIDEBAR_FILE) ? fs.readFileSync(SIDEBAR_FILE, "utf8") : "";
const navUrls = [...sidebarSrc.matchAll(/url:\s*["'`](\/[^"'`]+)["'`]/g)].map((m) => m[1]);
// Also extract any Link href= patterns in the sidebar
const sidebarLinkUrls = [...sidebarSrc.matchAll(/href=["'`](\/[^"'`?#{}]+)["'`]/g)].map((m) => m[1]);
const allNavUrls = [...new Set([...navUrls, ...sidebarLinkUrls])];

// ---- 3. Breadcrumb labels ----
// Extracts keys from: const LABELS: Record<string, string> = { dashboard: "...", ... }
const breadcrumbSrc = fs.existsSync(BREADCRUMB_FILE) ? fs.readFileSync(BREADCRUMB_FILE, "utf8") : "";
const labelKeys = new Set(
  [...breadcrumbSrc.matchAll(/^\s{2}([a-zA-Z][a-zA-Z0-9-_]*):\s*["']/gm)].map((m) => m[1]),
);

// ---- 4. Internal links across app + components ----
function ok(p) {
  return /\.(t|j)sx?$/.test(p) && !/\.(test|spec)\.(t|j)sx?$/.test(p);
}
const srcFiles = [...walk(APP, ok), ...walk(COMPONENTS, ok)];

// Match static internal hrefs/routes (skip template literals with ${} expressions)
const linkRe = /["'`](\/(?:dashboard|login|invite)(?:\/[^"'`?#${}]*)?)["'`]/g;
// Match template-literal paths like `/dashboard/items/${id}` → treat as `/dashboard/items/[d]`
const tmplRe = /["'`](\/dashboard\/[a-z-]+\/)\$\{[^}]+\}["'`]/g;

const deadLinks = new Map(); // link -> Set(file)
for (const f of srcFiles) {
  const txt = fs.readFileSync(f, "utf8");
  const rel = f.replace(ROOT + "/", "");
  const add = (link) => {
    if (!matchesRoute(link)) {
      if (!deadLinks.has(link)) deadLinks.set(link, new Set());
      deadLinks.get(link).add(rel);
    }
  };
  for (const m of txt.matchAll(linkRe)) add(m[1]);
  for (const m of txt.matchAll(tmplRe)) add(m[1] + "[d]");
}

// ---- Checks ----
const fails = [];
const warns = [];

// 1. dead links
for (const [link, files] of deadLinks) {
  fails.push(`dead-link  ${link}  →  no matching route  (in ${[...files].join(", ")})`);
}

// 2. missing labels in breadcrumb
// Check: every path segment used in nav + every top-level dashboard segment
const segsToLabel = new Set();
for (const u of allNavUrls) u.split("/").filter(Boolean).forEach((s) => segsToLabel.add(s));
for (const r of routes) {
  if (r.startsWith("/dashboard")) {
    r.split("/").filter(Boolean).forEach((s) => {
      if (!s.startsWith("[")) segsToLabel.add(s);
    });
  }
}
for (const seg of segsToLabel) {
  if (!labelKeys.has(seg)) {
    fails.push(`missing-label  "${seg}"  →  add to app-breadcrumb.tsx LABELS (renders English/raw)`);
  }
}

// 3. orphan pages (dashboard routes not in nav + not allowlisted)
for (const r of routes) {
  if (!r.startsWith("/dashboard")) continue;
  if (REACHABLE_ALLOWLIST.includes(r)) continue;
  // A route is in-nav if it IS a nav target, or a direct child of a non-root nav target
  const inNav = allNavUrls.some(
    (u) => r === u || (u !== "/dashboard" && r.startsWith(u + "/")),
  );
  if (!inNav) warns.push(`orphan-page  ${r}  →  reachable by URL but not in sidebar nav nor allowlisted`);
}

// ---- Report ----
console.log(
  `\nsurface-check — ${routes.length} routes · ${allNavUrls.length} nav targets · ${srcFiles.length} source files`,
);
const line = (kind, arr) => {
  if (!arr.length) { console.log(`  ✓ no ${kind}`); return; }
  console.log(`  ${arr.length} ${kind}:`);
  arr.forEach((a) => console.log(`    - ${a}`));
};
line("dead links", fails.filter((f) => f.startsWith("dead-link")));
line("missing labels", fails.filter((f) => f.startsWith("missing-label")));
line("orphan pages", warns);

const hardFail = fails.length > 0 || (STRICT && warns.length > 0);
console.log(
  `\n${hardFail ? "✗ surface-check FAILED" : "✅ surface-check passed"} — ${fails.length} error(s), ${warns.length} warning(s)\n`,
);
process.exit(hardFail ? 1 : 0);
