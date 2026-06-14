/**
 * validate-manifest.ts
 *
 * Validates a module.manifest.json file against the module.manifest.schema.json spec.
 * Used by `pnpm module:validate` and by vitest tests.
 *
 * No runtime deps beyond Node.js built-ins — intentionally no ajv/zod to keep this
 * lightweight and usable as a CLI script via tsx.
 */

import { readFileSync, existsSync } from "fs"
import { resolve } from "path"

export interface ValidationError {
  path: string
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  manifest?: ModuleManifest
}

// ─── Manifest Types (mirrors the JSON Schema) ────────────────────────────────

export interface EnvVar {
  name: string
  description?: string
  required?: boolean
  example?: string
}

export interface DbConfig {
  schemaFragmentPath?: string
  generateCommand?: string
  migrateCommand?: string
}

export interface PostInstallStep {
  step: number
  action?: "env-wire" | "db-generate" | "db-migrate" | "db-seed" | "command" | "manual" | "docs"
  description: string
  command?: string
}

export interface ManifestFile {
  path: string
  type:
    | "registry:component"
    | "registry:lib"
    | "registry:hook"
    | "registry:page"
    | "registry:block"
    | "registry:file"
  target?: string
}

export interface DemoConfig {
  path?: string
  iframeSrc?: string
  apiDemoPath?: string
}

export interface ModuleManifest {
  $schema?: string
  id: string
  version: string
  title: string
  summary: string
  registryDependencies?: string[]
  npmDependencies?: Record<string, string>
  npmDevDependencies?: Record<string, string>
  envVars?: EnvVar[]
  dbTables?: string[]
  db?: DbConfig
  routes?: string[]
  serverActions?: string[]
  postInstall?: PostInstallStep[]
  docs?: string
  demo?: DemoConfig
  files?: ManifestFile[]
}

// ─── Validation Logic ─────────────────────────────────────────────────────────

const SEMVER_PATTERN = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/
const KEBAB_ID_PATTERN = /^[a-z][a-z0-9-]*$/
const SNAKE_TABLE_PATTERN = /^[a-z][a-z0-9_]*$/
const UPPER_ENV_PATTERN = /^[A-Z_][A-Z0-9_]*$/

const VALID_FILE_TYPES = new Set([
  "registry:component",
  "registry:lib",
  "registry:hook",
  "registry:page",
  "registry:block",
  "registry:file",
])

const VALID_POST_INSTALL_ACTIONS = new Set([
  "env-wire",
  "db-generate",
  "db-migrate",
  "db-seed",
  "command",
  "manual",
  "docs",
])

export function validateManifest(raw: unknown): ValidationResult {
  const errors: ValidationError[] = []

  function err(path: string, message: string) {
    errors.push({ path, message })
  }

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { valid: false, errors: [{ path: "$", message: "Manifest must be a JSON object." }] }
  }

  const m = raw as Record<string, unknown>

  // Required string fields
  if (!m.id || typeof m.id !== "string") {
    err("$.id", "Required field 'id' must be a non-empty string.")
  } else if (!KEBAB_ID_PATTERN.test(m.id)) {
    err("$.id", `'id' must be kebab-case (a-z, 0-9, hyphen), got: "${m.id}".`)
  }

  if (!m.version || typeof m.version !== "string") {
    err("$.version", "Required field 'version' must be a non-empty string.")
  } else if (!SEMVER_PATTERN.test(m.version)) {
    err("$.version", `'version' must be a semver string (e.g. '1.0.0'), got: "${m.version}".`)
  }

  if (!m.title || typeof m.title !== "string") {
    err("$.title", "Required field 'title' must be a non-empty string.")
  }

  if (!m.summary || typeof m.summary !== "string") {
    err("$.summary", "Required field 'summary' must be a non-empty string.")
  }

  // registryDependencies — optional array of strings
  if (m.registryDependencies !== undefined) {
    if (!Array.isArray(m.registryDependencies)) {
      err("$.registryDependencies", "Must be an array.")
    } else {
      m.registryDependencies.forEach((dep, i) => {
        if (typeof dep !== "string") {
          err(`$.registryDependencies[${i}]`, "Each dependency must be a string.")
        }
      })
    }
  }

  // npmDependencies / npmDevDependencies — optional objects
  for (const field of ["npmDependencies", "npmDevDependencies"] as const) {
    if (m[field] !== undefined) {
      if (typeof m[field] !== "object" || Array.isArray(m[field])) {
        err(`$.${field}`, "Must be an object mapping package name to semver range.")
      }
    }
  }

  // envVars — optional array of EnvVar objects
  if (m.envVars !== undefined) {
    if (!Array.isArray(m.envVars)) {
      err("$.envVars", "Must be an array.")
    } else {
      ;(m.envVars as unknown[]).forEach((v, i) => {
        if (typeof v !== "object" || v === null) {
          err(`$.envVars[${i}]`, "Each env var must be an object.")
          return
        }
        const ev = v as Record<string, unknown>
        if (!ev.name || typeof ev.name !== "string") {
          err(`$.envVars[${i}].name`, "Required field 'name' must be a non-empty string.")
        } else if (!UPPER_ENV_PATTERN.test(ev.name)) {
          err(
            `$.envVars[${i}].name`,
            `Env var name must be UPPER_SNAKE_CASE, got: "${ev.name}".`,
          )
        }
        if (ev.required !== undefined && typeof ev.required !== "boolean") {
          err(`$.envVars[${i}].required`, "Must be a boolean.")
        }
      })
    }
  }

  // dbTables — optional array of snake_case strings
  if (m.dbTables !== undefined) {
    if (!Array.isArray(m.dbTables)) {
      err("$.dbTables", "Must be an array.")
    } else {
      ;(m.dbTables as unknown[]).forEach((t, i) => {
        if (typeof t !== "string") {
          err(`$.dbTables[${i}]`, "Each table name must be a string.")
        } else if (!SNAKE_TABLE_PATTERN.test(t)) {
          err(`$.dbTables[${i}]`, `Table name must be snake_case, got: "${t}".`)
        }
      })
    }
  }

  // db — optional object
  if (m.db !== undefined) {
    if (typeof m.db !== "object" || Array.isArray(m.db)) {
      err("$.db", "Must be an object.")
    } else {
      const db = m.db as Record<string, unknown>
      for (const f of ["schemaFragmentPath", "generateCommand", "migrateCommand"]) {
        if (db[f] !== undefined && typeof db[f] !== "string") {
          err(`$.db.${f}`, "Must be a string.")
        }
      }
    }
  }

  // routes / serverActions — optional arrays of strings
  for (const field of ["routes", "serverActions"] as const) {
    if (m[field] !== undefined) {
      if (!Array.isArray(m[field])) {
        err(`$.${field}`, "Must be an array.")
      } else {
        ;(m[field] as unknown[]).forEach((r, i) => {
          if (typeof r !== "string") {
            err(`$.${field}[${i}]`, "Must be a string.")
          }
        })
      }
    }
  }

  // postInstall — optional array of PostInstallStep objects
  if (m.postInstall !== undefined) {
    if (!Array.isArray(m.postInstall)) {
      err("$.postInstall", "Must be an array.")
    } else {
      ;(m.postInstall as unknown[]).forEach((s, i) => {
        if (typeof s !== "object" || s === null) {
          err(`$.postInstall[${i}]`, "Each step must be an object.")
          return
        }
        const step = s as Record<string, unknown>
        if (step.step === undefined || typeof step.step !== "number" || step.step < 1) {
          err(`$.postInstall[${i}].step`, "Required field 'step' must be a positive integer.")
        }
        if (!step.description || typeof step.description !== "string") {
          err(`$.postInstall[${i}].description`, "Required field 'description' must be a string.")
        }
        if (step.action !== undefined) {
          if (typeof step.action !== "string" || !VALID_POST_INSTALL_ACTIONS.has(step.action)) {
            err(
              `$.postInstall[${i}].action`,
              `Invalid action '${step.action}'. Must be one of: ${[...VALID_POST_INSTALL_ACTIONS].join(", ")}.`,
            )
          }
        }
        if (step.command !== undefined && typeof step.command !== "string") {
          err(`$.postInstall[${i}].command`, "Must be a string.")
        }
      })
    }
  }

  // docs — optional string
  if (m.docs !== undefined && typeof m.docs !== "string") {
    err("$.docs", "Must be a string (path or URL).")
  }

  // demo — optional object
  if (m.demo !== undefined) {
    if (typeof m.demo !== "object" || Array.isArray(m.demo)) {
      err("$.demo", "Must be an object.")
    } else {
      const demo = m.demo as Record<string, unknown>
      for (const f of ["path", "iframeSrc", "apiDemoPath"]) {
        if (demo[f] !== undefined && typeof demo[f] !== "string") {
          err(`$.demo.${f}`, "Must be a string.")
        }
      }
    }
  }

  // files — optional array of ManifestFile objects
  if (m.files !== undefined) {
    if (!Array.isArray(m.files)) {
      err("$.files", "Must be an array.")
    } else {
      ;(m.files as unknown[]).forEach((f, i) => {
        if (typeof f !== "object" || f === null) {
          err(`$.files[${i}]`, "Each file entry must be an object.")
          return
        }
        const file = f as Record<string, unknown>
        if (!file.path || typeof file.path !== "string") {
          err(`$.files[${i}].path`, "Required field 'path' must be a string.")
        }
        if (!file.type || typeof file.type !== "string" || !VALID_FILE_TYPES.has(file.type)) {
          err(
            `$.files[${i}].type`,
            `Required field 'type' must be one of: ${[...VALID_FILE_TYPES].join(", ")}.`,
          )
        }
        if (file.target !== undefined && typeof file.target !== "string") {
          err(`$.files[${i}].target`, "Must be a string.")
        }
      })
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors }
  }

  return { valid: true, errors: [], manifest: raw as ModuleManifest }
}

/**
 * Load and validate a module.manifest.json file from disk.
 */
export function validateManifestFile(filePath: string): ValidationResult {
  const absPath = resolve(filePath)
  if (!existsSync(absPath)) {
    return {
      valid: false,
      errors: [{ path: "$", message: `File not found: ${absPath}` }],
    }
  }

  let raw: unknown
  try {
    const content = readFileSync(absPath, "utf-8")
    raw = JSON.parse(content)
  } catch (e) {
    return {
      valid: false,
      errors: [{ path: "$", message: `Failed to parse JSON: ${(e as Error).message}` }],
    }
  }

  return validateManifest(raw)
}

// ─── CLI entry point ──────────────────────────────────────────────────────────

// Only run as CLI when executed directly (tsx validate-manifest.ts <path>)
if (process.argv[1] && process.argv[1].endsWith("validate-manifest.ts")) {
  const args = process.argv.slice(2)
  if (args.length === 0) {
    console.error("Usage: tsx lib/registry/validate-manifest.ts <path-to-manifest.json>")
    process.exit(1)
  }

  const filePath = args[0]
  const result = validateManifestFile(filePath)

  if (result.valid) {
    console.log(`✓ ${filePath} is valid.`)
    console.log(`  Module: ${result.manifest?.title} (${result.manifest?.id}@${result.manifest?.version})`)
    process.exit(0)
  } else {
    console.error(`✗ ${filePath} has ${result.errors.length} validation error(s):`)
    result.errors.forEach((e) => {
      console.error(`  [${e.path}] ${e.message}`)
    })
    process.exit(1)
  }
}
