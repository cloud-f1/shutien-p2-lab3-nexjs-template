#!/usr/bin/env node
/**
 * anchor-check.cjs — verify dev-docs cross-page #fragment anchors + local asset refs.
 *
 * Why this exists: VitePress fails its build on dead *page* links but does NOT validate
 * cross-page **#fragment** anchors — a `[x](/concepts#wrong-anchor)` builds green and 404s
 * the jump at runtime. This automates the manual "§6 verify anchors by hand" step from the
 * `user-guide-builder` skill. It also checks that referenced local images/assets resolve under
 * `dev-docs/public/` (so a screenshot-heavy manual doesn't ship broken <img>s).
 *
 * Deterministic, zero-dependency (Node built-ins only). Wired into scripts/smoke.sh.
 *
 * Usage:  node scripts/docs/anchor-check.cjs [dev-docs-dir]   (default: ./dev-docs)
 * Exit:   0 = clean · 1 = dead anchor or missing asset · 2 = setup error
 */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const DOCS = path.resolve(process.argv[2] || path.join(ROOT, "dev-docs"));
const PUBLIC = path.join(DOCS, "public");

const C = { red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m", dim: "\x1b[2m", b: "\x1b[1m", r: "\x1b[0m" };

if (!fs.existsSync(DOCS)) {
  console.log(`anchor-check: no dev-docs at ${DOCS} — skipping (exit 0)`);
  process.exit(0);
}

// ---- VitePress / @mdit-vue slugify (matches default theme anchor generation) ----
// lowercase · strip accents · drop punctuation except hyphen · spaces→hyphen · keep CJK.
function slugify(str) {
  return String(str)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // accents
    .replace(/[^\w一-鿿㐀-䶿\- ]/g, "") // keep word chars, CJK, hyphen, space
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
}

// Strip inline markdown from heading text before slugifying (code, links, emphasis).
function headingText(raw) {
  return raw
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_~]/g, "")
    .replace(/<[^>]+>/g, "")
    .trim();
}

// ---- collect markdown files (skip build/cache/vendor) ----
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === "dist" || e.name === "cache" || e.name === ".vitepress") {
      // still descend .vitepress for nothing — config is not a content page; skip entirely
      if (e.name === ".vitepress") continue;
      if (e.name === "node_modules" || e.name === "dist" || e.name === "cache") continue;
    }
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.isFile() && e.name.endsWith(".md")) out.push(full);
  }
  return out;
}

const files = walk(DOCS);

// Map a doc file to its VitePress route key (e.g. dev-docs/modules/admin.md -> /modules/admin,
// dev-docs/docs/index.md -> /docs/). Used to resolve absolute /path links to a source file.
function routeKey(file) {
  let rel = "/" + path.relative(DOCS, file).replace(/\\/g, "/");
  rel = rel.replace(/\.md$/, "");
  rel = rel.replace(/\/index$/, "/");
  return rel;
}

// Build: route -> Set(heading slugs); and a quick lookup of all known routes/files.
const headings = new Map(); // route -> Set<slug>
const routeToFile = new Map();
for (const f of files) {
  const key = routeKey(f);
  routeToFile.set(key, f);
  const slugs = new Set();
  const src = fs.readFileSync(f, "utf8");
  // strip fenced code blocks so ``` ## not a heading ``` doesn't register
  const noFences = src.replace(/```[\s\S]*?```/g, "").replace(/~~~[\s\S]*?~~~/g, "");
  for (const m of noFences.matchAll(/^#{1,6}\s+(.+?)\s*$/gm)) {
    slugs.add(slugify(headingText(m[1])));
  }
  // explicit custom anchors: "## Title {#custom-id}"
  for (const m of src.matchAll(/\{#([^}]+)\}/g)) slugs.add(m[1].trim());
  headings.set(key, slugs);
}

// Resolve a link target (absolute "/x", relative "./x" / "x", or same-page "") to a route key.
function resolveRoute(linkPath, fromFile) {
  if (linkPath === "" || linkPath === undefined) return routeKey(fromFile); // same-page #anchor
  let p = linkPath;
  if (p.startsWith("/")) {
    p = p.replace(/\.(md|html)$/, "");
    if (p.endsWith("/")) return p; // /docs/ -> index
    return p;
  }
  // relative
  const baseDir = path.dirname(fromFile);
  let abs = path.resolve(baseDir, p);
  let rel = "/" + path.relative(DOCS, abs).replace(/\\/g, "/");
  rel = rel.replace(/\.(md|html)$/, "").replace(/\/index$/, "/");
  return rel;
}

// Does a route key exist as a page (allow trailing-slash/index variants)?
function routeExists(route) {
  if (routeToFile.has(route)) return true;
  if (routeToFile.has(route + "/")) return true; // /docs -> /docs/
  if (route.endsWith("/") && routeToFile.has(route.slice(0, -1))) return true;
  return false;
}
function slugsFor(route) {
  if (headings.has(route)) return headings.get(route);
  if (headings.has(route + "/")) return headings.get(route + "/");
  if (route.endsWith("/") && headings.has(route.slice(0, -1))) return headings.get(route.slice(0, -1));
  return null;
}

const problems = [];
let anchorLinks = 0;
let assetRefs = 0;

const LINK_RE = /(!?)\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

for (const f of files) {
  const src = fs.readFileSync(f, "utf8").replace(/```[\s\S]*?```/g, "").replace(/~~~[\s\S]*?~~~/g, "");
  const relf = path.relative(ROOT, f);
  for (const m of src.matchAll(LINK_RE)) {
    const isImage = m[1] === "!";
    const target = m[2];
    if (/^(https?:|mailto:|tel:)/i.test(target)) continue; // external — out of scope

    if (isImage) {
      // local asset: resolve under public/ (VitePress serves public/ at root) or relative file
      assetRefs++;
      let assetPath;
      if (target.startsWith("/")) assetPath = path.join(PUBLIC, target);
      else assetPath = path.resolve(path.dirname(f), target);
      if (!fs.existsSync(assetPath.split("#")[0].split("?")[0])) {
        problems.push(`${relf}: image asset not found → ${target}`);
      }
      continue;
    }

    const hashIdx = target.indexOf("#");
    if (hashIdx === -1) continue; // page-only link — VitePress build already validates these
    anchorLinks++;
    const linkPath = target.slice(0, hashIdx);
    const frag = target.slice(hashIdx + 1);
    if (!frag) continue;

    const route = resolveRoute(linkPath, f);
    // same-page (empty linkPath) always resolves to this file
    if (linkPath !== "" && !routeExists(route)) {
      problems.push(`${relf}: link target page not found → ${target}  (resolved ${route})`);
      continue;
    }
    const slugs = slugsFor(route) || headings.get(routeKey(f));
    if (!slugs || !slugs.has(frag)) {
      problems.push(`${relf}: dead anchor → ${target}  (no heading "#${frag}" on ${linkPath || routeKey(f)})`);
    }
  }
}

console.log(`\n${C.b}anchor-check${C.r} — ${files.length} md files · ${anchorLinks} #anchor links · ${assetRefs} image refs`);
if (problems.length === 0) {
  console.log(`  ${C.green}✓ all cross-page anchors resolve${C.r}`);
  console.log(`  ${C.green}✓ all referenced assets exist${C.r}`);
  console.log(`\n${C.green}✅ anchor-check passed — 0 problem(s)${C.r}\n`);
  process.exit(0);
}
for (const p of problems) console.log(`  ${C.red}✗${C.r} ${p}`);
console.log(`\n${C.red}✖ anchor-check FAILED — ${problems.length} problem(s)${C.r}\n`);
process.exit(1);
