import { describe, it, expect } from "vitest"
import { validateManifest, validateManifestFile } from "./validate-manifest"
import { resolve } from "path"

// ─── Minimal valid manifest ────────────────────────────────────────────────────

const MINIMAL: Record<string, unknown> = {
  id: "hello-module",
  version: "1.0.0",
  title: "Hello Module",
  summary: "Smoke-test registry item.",
}

// ─── Full valid manifest (mirrors billing sample) ──────────────────────────────

const FULL: Record<string, unknown> = {
  $schema: "../schema/module.manifest.schema.json",
  id: "billing",
  version: "1.0.0",
  title: "Billing (Stripe)",
  summary: "Stripe subscription billing for the @saas template.",
  registryDependencies: ["@saas/hello-module"],
  npmDependencies: { stripe: "^17.0.0", "@stripe/stripe-js": "^5.0.0" },
  npmDevDependencies: {},
  envVars: [
    {
      name: "STRIPE_SECRET_KEY",
      description: "Stripe secret key.",
      required: true,
      example: "sk_test_...",
    },
    {
      name: "STRIPE_WEBHOOK_SECRET",
      description: "Webhook signing secret.",
      required: true,
    },
  ],
  dbTables: ["subscriptions", "stripe_customers"],
  db: {
    schemaFragmentPath: "lib/billing/schema.ts",
    generateCommand: "pnpm db:generate",
    migrateCommand: "pnpm db:migrate",
  },
  routes: ["(dashboard)/billing/page.tsx", "api/webhooks/stripe/route.ts"],
  serverActions: ["actions/billing.ts"],
  postInstall: [
    { step: 1, action: "env-wire", description: "Add env vars to .env.local." },
    {
      step: 2,
      action: "db-generate",
      description: "Generate Drizzle migrations.",
      command: "pnpm db:generate",
    },
    { step: 3, action: "db-migrate", description: "Apply migrations.", command: "pnpm db:migrate" },
    {
      step: 4,
      action: "manual",
      description: "Configure Stripe webhook endpoint in the Stripe Dashboard.",
    },
  ],
  docs: "/docs/modules/billing",
  demo: {
    path: "/demo/billing",
    iframeSrc: "http://localhost:3000/demo/billing",
    apiDemoPath: "/api/demo/billing/checkout",
  },
  files: [
    {
      path: "registry/billing/components/billing-card.tsx",
      type: "registry:component",
      target: "components/billing/billing-card.tsx",
    },
    {
      path: "registry/billing/lib/billing-provider.ts",
      type: "registry:lib",
      target: "lib/billing/provider.ts",
    },
    {
      path: "registry/billing/app/api/webhooks/stripe/route.ts",
      type: "registry:file",
      target: "app/api/webhooks/stripe/route.ts",
    },
  ],
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("validateManifest — valid manifests", () => {
  it("accepts a minimal manifest with only required fields", () => {
    const result = validateManifest(MINIMAL)
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.manifest?.id).toBe("hello-module")
  })

  it("accepts a full manifest with all optional fields", () => {
    const result = validateManifest(FULL)
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.manifest?.id).toBe("billing")
    expect(result.manifest?.version).toBe("1.0.0")
    expect(result.manifest?.envVars).toHaveLength(2)
    expect(result.manifest?.postInstall).toHaveLength(4)
  })

  it("accepts a manifest with empty optional arrays", () => {
    const result = validateManifest({
      ...MINIMAL,
      registryDependencies: [],
      envVars: [],
      dbTables: [],
      postInstall: [],
      files: [],
    })
    expect(result.valid).toBe(true)
  })

  it("accepts pre-release semver versions", () => {
    const result = validateManifest({ ...MINIMAL, version: "2.0.0-beta.1" })
    expect(result.valid).toBe(true)
  })
})

describe("validateManifest — required field errors", () => {
  it("rejects non-object input", () => {
    expect(validateManifest(null).valid).toBe(false)
    expect(validateManifest("string").valid).toBe(false)
    expect(validateManifest([]).valid).toBe(false)
    expect(validateManifest(42).valid).toBe(false)
  })

  it("requires 'id'", () => {
    const rest = { version: MINIMAL.version, title: MINIMAL.title, summary: MINIMAL.summary }
    const result = validateManifest(rest)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.path === "$.id")).toBe(true)
  })

  it("requires 'version'", () => {
    const rest = { id: MINIMAL.id, title: MINIMAL.title, summary: MINIMAL.summary }
    const result = validateManifest(rest)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.path === "$.version")).toBe(true)
  })

  it("requires 'title'", () => {
    const rest = { id: MINIMAL.id, version: MINIMAL.version, summary: MINIMAL.summary }
    const result = validateManifest(rest)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.path === "$.title")).toBe(true)
  })

  it("requires 'summary'", () => {
    const rest = { id: MINIMAL.id, version: MINIMAL.version, title: MINIMAL.title }
    const result = validateManifest(rest)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.path === "$.summary")).toBe(true)
  })
})

describe("validateManifest — id validation", () => {
  it("accepts valid kebab-case ids", () => {
    for (const id of ["billing", "user-profile", "hello-module", "a1b2"]) {
      expect(validateManifest({ ...MINIMAL, id }).valid).toBe(true)
    }
  })

  it("rejects ids with uppercase letters", () => {
    const result = validateManifest({ ...MINIMAL, id: "Billing" })
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.path === "$.id")).toBe(true)
  })

  it("rejects ids starting with a digit", () => {
    const result = validateManifest({ ...MINIMAL, id: "1billing" })
    expect(result.valid).toBe(false)
  })

  it("rejects ids with underscores", () => {
    const result = validateManifest({ ...MINIMAL, id: "user_profile" })
    expect(result.valid).toBe(false)
  })
})

describe("validateManifest — version validation", () => {
  it("rejects non-semver versions", () => {
    for (const version of ["v1.0.0", "1.0", "latest", "1"]) {
      const result = validateManifest({ ...MINIMAL, version })
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.path === "$.version")).toBe(true)
    }
  })
})

describe("validateManifest — envVars validation", () => {
  it("rejects non-array envVars", () => {
    const result = validateManifest({ ...MINIMAL, envVars: "BAD_VAR=value" })
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.path === "$.envVars")).toBe(true)
  })

  it("rejects env var names that are not UPPER_SNAKE_CASE", () => {
    const result = validateManifest({
      ...MINIMAL,
      envVars: [{ name: "myApiKey" }],
    })
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.path.startsWith("$.envVars"))).toBe(true)
  })

  it("accepts UPPER_SNAKE_CASE env var names", () => {
    const result = validateManifest({
      ...MINIMAL,
      envVars: [{ name: "MY_API_KEY", description: "An API key.", required: true }],
    })
    expect(result.valid).toBe(true)
  })

  it("rejects non-boolean 'required' field", () => {
    const result = validateManifest({
      ...MINIMAL,
      envVars: [{ name: "MY_KEY", required: "yes" }],
    })
    expect(result.valid).toBe(false)
  })
})

describe("validateManifest — dbTables validation", () => {
  it("accepts valid snake_case table names", () => {
    const result = validateManifest({
      ...MINIMAL,
      dbTables: ["subscriptions", "stripe_customers", "user_sessions"],
    })
    expect(result.valid).toBe(true)
  })

  it("rejects camelCase table names", () => {
    const result = validateManifest({ ...MINIMAL, dbTables: ["stripeCustomers"] })
    expect(result.valid).toBe(false)
  })

  it("rejects table names starting with underscore", () => {
    const result = validateManifest({ ...MINIMAL, dbTables: ["_private"] })
    expect(result.valid).toBe(false)
  })
})

describe("validateManifest — postInstall validation", () => {
  it("rejects steps missing 'step' number", () => {
    const result = validateManifest({
      ...MINIMAL,
      postInstall: [{ description: "Do something." }],
    })
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.path.includes("step"))).toBe(true)
  })

  it("rejects steps missing 'description'", () => {
    const result = validateManifest({
      ...MINIMAL,
      postInstall: [{ step: 1 }],
    })
    expect(result.valid).toBe(false)
  })

  it("rejects invalid action type", () => {
    const result = validateManifest({
      ...MINIMAL,
      postInstall: [{ step: 1, action: "run-script", description: "Run something." }],
    })
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.path.includes("action"))).toBe(true)
  })

  it("accepts all valid action types", () => {
    const actions = ["env-wire", "db-generate", "db-migrate", "db-seed", "command", "manual", "docs"]
    for (const action of actions) {
      const result = validateManifest({
        ...MINIMAL,
        postInstall: [{ step: 1, action, description: "A step." }],
      })
      expect(result.valid).toBe(true)
    }
  })
})

describe("validateManifest — files validation", () => {
  it("rejects files with invalid type", () => {
    const result = validateManifest({
      ...MINIMAL,
      files: [{ path: "some/file.ts", type: "registry:migration" }],
    })
    expect(result.valid).toBe(false)
  })

  it("rejects files missing required path", () => {
    const result = validateManifest({
      ...MINIMAL,
      files: [{ type: "registry:lib" }],
    })
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.path.includes("path"))).toBe(true)
  })

  it("accepts valid file entries with optional target", () => {
    const result = validateManifest({
      ...MINIMAL,
      files: [
        { path: "registry/billing/lib/schema.ts", type: "registry:lib", target: "lib/billing/schema.ts" },
        { path: "registry/billing/app/billing/page.tsx", type: "registry:page" },
      ],
    })
    expect(result.valid).toBe(true)
  })
})

describe("validateManifestFile — disk reads", () => {
  it("validates the real hello-module manifest on disk", () => {
    const manifestPath = resolve(
      import.meta.dirname,
      "../../registry/hello-module/module.manifest.json",
    )
    const result = validateManifestFile(manifestPath)
    expect(result.valid).toBe(true)
    expect(result.manifest?.id).toBe("hello-module")
  })

  it("validates the billing sample manifest on disk", () => {
    const manifestPath = resolve(
      import.meta.dirname,
      "../../registry/schema/samples/billing.module.manifest.json",
    )
    const result = validateManifestFile(manifestPath)
    expect(result.valid).toBe(true)
    expect(result.manifest?.id).toBe("billing")
    expect(result.manifest?.envVars?.length).toBeGreaterThan(0)
    expect(result.manifest?.postInstall?.length).toBeGreaterThan(0)
  })

  it("returns an error for a non-existent file", () => {
    const result = validateManifestFile("/tmp/does-not-exist-module.manifest.json")
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.message.includes("not found"))).toBe(true)
  })
})
