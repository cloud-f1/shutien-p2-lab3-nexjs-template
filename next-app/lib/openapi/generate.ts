/**
 * E281 — Generate docs/openapi.yaml from the Zod-derived registry.
 *
 * Run with `pnpm openapi:generate`. Builds the OpenAPI 3.1 document in memory
 * (buildOpenApiDocument) and writes it as YAML to the repo-root docs/openapi.yaml.
 *
 * This is the ONLY supported way to update docs/openapi.yaml — never hand-edit it.
 * A smoke drift gate (scripts/smoke.sh) regenerates + `git diff --exit-code` to
 * fail if the committed spec is stale vs the Zod source.
 */

import { writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

import { stringify } from "yaml"

import { buildOpenApiDocument } from "@/lib/openapi/registry"

const __dirname = dirname(fileURLToPath(import.meta.url))
// lib/openapi/ → next-app/ → repo root → docs/openapi.yaml
const OUTPUT_PATH = resolve(__dirname, "../../../docs/openapi.yaml")

const doc = buildOpenApiDocument()
const yaml = stringify(doc, { lineWidth: 0 })

const banner =
  "# AUTO-GENERATED from Zod — do NOT hand-edit. Regenerate with `pnpm openapi:generate` (next-app/).\n" +
  "# Source of truth: next-app/lib/openapi/registry.ts + lib/validations/*. Drift-guarded in scripts/smoke.sh.\n"

writeFileSync(OUTPUT_PATH, banner + yaml, "utf8")

console.log(`✓ Wrote ${OUTPUT_PATH} (${doc.paths ? Object.keys(doc.paths).length : 0} paths)`)
