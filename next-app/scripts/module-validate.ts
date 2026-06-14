// scripts/module-validate.ts
// CLI entry point for `pnpm module:validate`.
// Validates module.manifest.json files against the module manifest schema.
// Run with no args to validate all registry modules, or pass a path to validate one.
// Exit 0 = valid. Exit 1 = errors found.

import { readdirSync, existsSync } from "fs"
import { resolve, join, dirname } from "path"
import { fileURLToPath } from "url"
import { validateManifestFile } from "../lib/registry/validate-manifest"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const REGISTRY_DIR = resolve(join(__dirname, "..", "registry"))

function findAllManifests(registryDir: string): string[] {
  if (!existsSync(registryDir)) return []
  return readdirSync(registryDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== "schema")
    .map((d) => join(registryDir, d.name, "module.manifest.json"))
    .filter((p) => existsSync(p))
}

function main() {
  const args = process.argv.slice(2)

  let paths: string[]
  if (args.length > 0) {
    // Validate specific files passed as arguments
    paths = args.map((a) => resolve(a))
  } else {
    // Auto-discover all manifests under next-app/registry/*/
    paths = findAllManifests(REGISTRY_DIR)
    if (paths.length === 0) {
      console.log("No module.manifest.json files found under registry/. Nothing to validate.")
      process.exit(0)
    }
    console.log(`Found ${paths.length} manifest(s) to validate...\n`)
  }

  let allValid = true

  for (const filePath of paths) {
    const result = validateManifestFile(filePath)
    if (result.valid) {
      console.log(
        `✓ ${filePath}  →  ${result.manifest?.title} (${result.manifest?.id}@${result.manifest?.version})`,
      )
    } else {
      allValid = false
      console.error(`✗ ${filePath}  →  ${result.errors.length} error(s):`)
      result.errors.forEach((e) => {
        console.error(`    [${e.path}] ${e.message}`)
      })
    }
  }

  if (allValid) {
    console.log(`\nAll ${paths.length} manifest(s) valid.`)
    process.exit(0)
  } else {
    console.error(`\nValidation failed. Fix errors above and re-run 'pnpm module:validate'.`)
    process.exit(1)
  }
}

main()
