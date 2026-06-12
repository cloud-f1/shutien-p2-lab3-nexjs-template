/**
 * E21 — Unit tests for scaffold module
 */

import { describe, it, expect, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  buildReplacements,
  applyReplacements,
  generateEnvContent,
  generateEnvExampleContent,
  scaffoldFiles,
} from "../scaffold.js";
import type { ProjectConfig } from "../types.js";

function makeConfig(overrides?: Partial<ProjectConfig>): ProjectConfig {
  return {
    slug: "test-app",
    displayName: "Test App",
    description: "A test application",
    author: "Dev <dev@test.com>",
    dbName: "test_app",
    theme: "indigo",
    oauthProviders: ["google"],
    deployTarget: "zeabur",
    ...overrides,
  };
}

describe("buildReplacements", () => {
  it("maps config to template placeholders", () => {
    const config = makeConfig();
    const result = buildReplacements(config);

    expect(result["{{PROJECT_SLUG}}"]).toBe("test-app");
    expect(result["{{PROJECT_DISPLAY}}"]).toBe("Test App");
    expect(result["{{DB_NAME}}"]).toBe("test_app");
    expect(result["{{AUTHOR}}"]).toBe("Dev <dev@test.com>");
    expect(result["{{DEFAULT_THEME}}"]).toBe("indigo");
    expect(result["{{PROJECT_DESCRIPTION}}"]).toBe("A test application");
  });
});

describe("applyReplacements", () => {
  it("replaces all placeholders in a string", () => {
    const template = 'name: "{{PROJECT_SLUG}}" # {{PROJECT_DISPLAY}}';
    const result = applyReplacements(template, {
      "{{PROJECT_SLUG}}": "my-app",
      "{{PROJECT_DISPLAY}}": "My App",
    });
    expect(result).toBe('name: "my-app" # My App');
  });

  it("replaces multiple occurrences of same placeholder", () => {
    const template = "{{PROJECT_SLUG}} and {{PROJECT_SLUG}}";
    const result = applyReplacements(template, {
      "{{PROJECT_SLUG}}": "app",
    });
    expect(result).toBe("app and app");
  });

  it("leaves unmatched placeholders unchanged", () => {
    const template = "{{PROJECT_SLUG}} {{UNKNOWN}}";
    const result = applyReplacements(template, {
      "{{PROJECT_SLUG}}": "app",
    });
    expect(result).toBe("app {{UNKNOWN}}");
  });

  it("handles empty replacements", () => {
    const template = "hello world";
    const result = applyReplacements(template, {});
    expect(result).toBe("hello world");
  });
});

describe("generateEnvContent", () => {
  it("includes database URL with config dbName and derived user/pass", () => {
    const config = makeConfig({ dbName: "my_db" });
    const env = generateEnvContent(config);
    expect(env).toContain("postgresql+asyncpg://my_db_user:my_db_pass@localhost:5432/my_db");
  });

  it("includes Google OAuth section when selected", () => {
    const config = makeConfig({ oauthProviders: ["google"] });
    const env = generateEnvContent(config);
    expect(env).toContain("GOOGLE_CLIENT_ID=");
    expect(env).toContain("GOOGLE_CLIENT_SECRET=");
  });

  it("includes GitHub OAuth section when selected", () => {
    const config = makeConfig({ oauthProviders: ["github"] });
    const env = generateEnvContent(config);
    expect(env).toContain("GITHUB_CLIENT_ID=");
    expect(env).toContain("GITHUB_CLIENT_SECRET=");
  });

  it("omits OAuth sections when none selected", () => {
    const config = makeConfig({ oauthProviders: [] });
    const env = generateEnvContent(config);
    expect(env).not.toContain("GOOGLE_CLIENT_ID");
    expect(env).not.toContain("GITHUB_CLIENT_ID");
  });

  it("includes VITE_API_URL", () => {
    const config = makeConfig();
    const env = generateEnvContent(config);
    expect(env).toContain("VITE_API_URL=http://localhost:8080");
  });

  it("includes display name in header comment", () => {
    const config = makeConfig({ displayName: "Cool App" });
    const env = generateEnvContent(config);
    expect(env).toContain("# Project: Cool App");
  });

  it("includes EMAIL_PROVIDER and EMAIL_FROM (E75-S2)", () => {
    const config = makeConfig();
    const env = generateEnvContent(config);
    expect(env).toContain("EMAIL_PROVIDER=console");
    expect(env).toContain("EMAIL_FROM=noreply@localhost");
  });

  it("includes LOG_FORMAT (E75-S2)", () => {
    const config = makeConfig();
    const env = generateEnvContent(config);
    expect(env).toContain("LOG_FORMAT=console");
  });

  it("includes app config vars aligned with .env.example (E75-S2)", () => {
    const config = makeConfig();
    const env = generateEnvContent(config);
    expect(env).toContain("DEBUG=true");
    expect(env).toContain("ENVIRONMENT=development");
    expect(env).toContain("ALLOWED_ORIGINS_STR=http://localhost:3000,http://localhost:5173");
    expect(env).toContain("ACCESS_TOKEN_EXPIRE_MINUTES=15");
    expect(env).toContain("REFRESH_TOKEN_EXPIRE_DAYS=30");
    expect(env).toContain("RATE_LIMIT_AUTH=15/minute");
    expect(env).toContain("RATE_LIMIT_GENERAL=200/minute");
    expect(env).toContain("SESSION_CLEANUP_INTERVAL_MINUTES=60");
    expect(env).toContain("SESSION_RETENTION_DAYS=7");
  });

  it("does not contain stale SMTP vars", () => {
    const config = makeConfig();
    const env = generateEnvContent(config);
    expect(env).not.toContain("SMTP_");
    expect(env).not.toContain("CORS_ORIGINS=");
    expect(env).not.toContain("DATABASE_URL_SYNC");
  });
});

describe("generateEnvExampleContent", () => {
  it("redacts SECRET_KEY values", () => {
    const config = makeConfig();
    const envExample = generateEnvExampleContent(config);
    expect(envExample).toContain("SECRET_KEY=<generate-a-random-string>");
    expect(envExample).toContain("REFRESH_SECRET_KEY=<generate-a-random-string>");
    expect(envExample).not.toContain("change-me");
  });

  it("preserves non-secret values", () => {
    const config = makeConfig({ dbName: "my_db" });
    const envExample = generateEnvExampleContent(config);
    expect(envExample).toContain("my_db");
    expect(envExample).toContain("VITE_API_URL=http://localhost:8080");
  });
});

describe("scaffoldFiles", () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  });

  it("replaces template variables in existing files", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "scaffold-"));
    writeFileSync(
      join(tmpDir, "package.json"),
      '{ "name": "{{PROJECT_SLUG}}", "description": "{{PROJECT_DESCRIPTION}}" }',
    );
    const config = makeConfig({ slug: "my-app", description: "My desc" });
    const { processed, skipped } = scaffoldFiles(tmpDir, config);

    expect(processed).toContain("package.json");
    const content = readFileSync(join(tmpDir, "package.json"), "utf-8");
    expect(content).toContain('"my-app"');
    expect(content).toContain('"My desc"');
  });

  it("replaces template variables in TECHSTACK.md", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "scaffold-"));
    writeFileSync(
      join(tmpDir, "TECHSTACK.md"),
      "# {{PROJECT_DISPLAY}} — Tech Stack Summary\n\n*{{PROJECT_DISPLAY}} . Tech Stack Summary*",
    );
    const config = makeConfig({ displayName: "My SaaS" });
    const { processed } = scaffoldFiles(tmpDir, config);

    expect(processed).toContain("TECHSTACK.md");
    const content = readFileSync(join(tmpDir, "TECHSTACK.md"), "utf-8");
    expect(content).toContain("# My SaaS — Tech Stack Summary");
    expect(content).toContain("*My SaaS . Tech Stack Summary*");
    expect(content).not.toContain("{{PROJECT_DISPLAY}}");
  });

  it("skips files that do not exist", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "scaffold-"));
    // No files created — all TEMPLATE_FILES will be missing
    const config = makeConfig();
    const { processed, skipped } = scaffoldFiles(tmpDir, config);

    // package.json, pyproject.toml, docker-compose.yml, CLAUDE.md, TECHSTACK.md should all be skipped
    expect(skipped).toContain("package.json");
    expect(skipped).toContain("pyproject.toml");
    expect(skipped).toContain("TECHSTACK.md");
  });

  it("skips files with no matching placeholders", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "scaffold-"));
    writeFileSync(join(tmpDir, "package.json"), '{ "name": "static-content" }');
    const config = makeConfig();
    const { processed, skipped } = scaffoldFiles(tmpDir, config);

    expect(skipped).toContain("package.json");
    expect(processed).not.toContain("package.json");
  });

  it("writes .env and .env.example files", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "scaffold-"));
    const config = makeConfig({ dbName: "my_db" });
    const { processed } = scaffoldFiles(tmpDir, config);

    expect(processed).toContain(".env");
    expect(processed).toContain(".env.example");
    expect(existsSync(join(tmpDir, ".env"))).toBe(true);
    expect(existsSync(join(tmpDir, ".env.example"))).toBe(true);

    const envContent = readFileSync(join(tmpDir, ".env"), "utf-8");
    expect(envContent).toContain("my_db");
  });
});

