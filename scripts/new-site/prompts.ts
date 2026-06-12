/**
 * E21 — Interactive config prompts
 * Uses @clack/prompts to collect project configuration.
 */

import * as p from "@clack/prompts";
import type { ProjectConfig } from "./types.js";

/**
 * Convert a string to kebab-case slug.
 */
export function toSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Derive database name from slug (replace hyphens with underscores).
 */
export function toDbName(slug: string): string {
  return slug.replace(/-/g, "_");
}

/**
 * Run the interactive prompt wizard. Returns ProjectConfig or null if cancelled.
 */
export async function collectConfig(): Promise<ProjectConfig | null> {
  const project = await p.group(
    {
      slug: () =>
        p.text({
          message: "Project name (kebab-case slug)",
          placeholder: "my-awesome-app",
          validate: (v) => {
            if (!v.trim()) return "Project name is required";
            if (!/^[a-z][a-z0-9-]*$/.test(v.trim()))
              return "Must be lowercase letters, numbers, and hyphens (start with a letter)";
          },
        }),
      displayName: ({ results }) =>
        p.text({
          message: "Display name",
          placeholder: results.slug
            ? results.slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
            : "My Awesome App",
        }),
      description: () =>
        p.text({
          message: "Project description",
          placeholder: "A full-stack web application",
        }),
      author: () =>
        p.text({
          message: "Author (Name <email>)",
          placeholder: "Developer <dev@example.com>",
        }),
      dbName: ({ results }) =>
        p.text({
          message: "Database name",
          initialValue: results.slug ? toDbName(results.slug as string) : "",
        }),
      theme: () =>
        p.select({
          message: "Default theme",
          options: [
            { value: "dark", label: "Dark (default)" },
            { value: "indigo", label: "Indigo" },
            { value: "navy", label: "Navy" },
            { value: "sage", label: "Sage" },
          ],
        }),
      oauthProviders: () =>
        p.multiselect({
          message: "OAuth providers (space to toggle, enter to confirm)",
          options: [
            { value: "google", label: "Google" },
            { value: "github", label: "GitHub" },
          ],
          required: false,
        }),
      deployTarget: () =>
        p.select({
          message: "Deploy target",
          options: [
            { value: "zeabur", label: "Zeabur (recommended)" },
            { value: "docker", label: "Docker" },
            { value: "manual", label: "Manual" },
          ],
        }),
    },
    {
      onCancel: () => {
        p.cancel("Setup cancelled.");
        return process.exit(0);
      },
    },
  );

  return {
    slug: toSlug(project.slug as string),
    displayName: (project.displayName as string) || (project.slug as string),
    description: (project.description as string) || "",
    author: (project.author as string) || "",
    dbName: (project.dbName as string) || toDbName(project.slug as string),
    theme: project.theme as ProjectConfig["theme"],
    oauthProviders: (project.oauthProviders as ProjectConfig["oauthProviders"]) || [],
    deployTarget: project.deployTarget as ProjectConfig["deployTarget"],
  };
}
