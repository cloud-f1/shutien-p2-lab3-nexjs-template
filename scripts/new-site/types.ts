/**
 * E21 — Interactive Site Builder CLI
 * Shared types for project configuration and step tracking.
 */

export interface PrereqResult {
  name: string;
  required: string;       // semver or "any"
  found: string | null;   // detected version or null
  pass: boolean;
  installHint: string;
}

export interface ProjectConfig {
  slug: string;            // kebab-case project name
  displayName: string;
  description: string;
  author: string;          // "Name <email>"
  dbName: string;
  theme: "dark" | "indigo" | "navy" | "sage";
  oauthProviders: ("google" | "github")[];
  deployTarget: "zeabur" | "docker" | "manual";
}

export interface StepResult {
  step: string;
  status: "pass" | "fail" | "skip";
  at: string;              // ISO 8601 timestamp
  error?: string;
}

export interface DomainChoice {
  type: "blog" | "todo" | "crm" | "custom" | "skip";
  exampleConfig?: string;  // path to example YAML
}

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
  hint?: string;     // shown when not done
  docLink?: string;  // link to relevant guide
}

export interface TutorialResult {
  domainChoice: DomainChoice;
  testsPassed: boolean;
  checklist: ChecklistItem[];
}

export interface BuildManifest {
  version: string;
  created_at: string;
  project: {
    name: string;
    display_name: string;
    description: string;
    author: string;
  };
  config: {
    database: string;
    theme: string;
    oauth_providers: string[];
    deploy_target: string;
  };
  prerequisites: Record<string, string>;
  steps_completed: StepResult[];
}
