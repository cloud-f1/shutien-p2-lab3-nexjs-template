/**
 * E21 — Unit tests for prompt utility functions and collectConfig
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @clack/prompts before any imports that use it
vi.mock("@clack/prompts", () => ({
  group: vi.fn(),
  cancel: vi.fn(),
  text: vi.fn(),
  select: vi.fn(),
  multiselect: vi.fn(),
}));

import { toSlug, toDbName, collectConfig } from "../prompts.js";
import * as clack from "@clack/prompts";

describe("toSlug", () => {
  it("converts spaces to hyphens", () => {
    expect(toSlug("My Cool App")).toBe("my-cool-app");
  });

  it("lowercases input", () => {
    expect(toSlug("MyApp")).toBe("myapp");
  });

  it("strips leading/trailing hyphens", () => {
    expect(toSlug("-my-app-")).toBe("my-app");
  });

  it("replaces special characters with hyphens", () => {
    expect(toSlug("my_app@v2")).toBe("my-app-v2");
  });

  it("collapses multiple hyphens", () => {
    expect(toSlug("my   app")).toBe("my-app");
  });

  it("handles already-valid slug", () => {
    expect(toSlug("my-app")).toBe("my-app");
  });
});

describe("toDbName", () => {
  it("replaces hyphens with underscores", () => {
    expect(toDbName("my-cool-app")).toBe("my_cool_app");
  });

  it("handles no hyphens", () => {
    expect(toDbName("myapp")).toBe("myapp");
  });

  it("handles multiple hyphens", () => {
    expect(toDbName("a-b-c-d")).toBe("a_b_c_d");
  });
});

describe("collectConfig", () => {
  beforeEach(() => {
    vi.mocked(clack.group).mockReset();
  });

  it("returns ProjectConfig from prompt answers", async () => {
    vi.mocked(clack.group).mockResolvedValue({
      slug: "my-app",
      displayName: "My App",
      description: "A great app",
      author: "Dev <dev@test.com>",
      dbName: "my_app",
      theme: "navy",
      oauthProviders: ["google"],

      deployTarget: "zeabur",
    });

    const config = await collectConfig();

    expect(config).not.toBeNull();
    expect(config!.slug).toBe("my-app");
    expect(config!.displayName).toBe("My App");
    expect(config!.description).toBe("A great app");
    expect(config!.author).toBe("Dev <dev@test.com>");
    expect(config!.dbName).toBe("my_app");
    expect(config!.theme).toBe("navy");
    expect(config!.oauthProviders).toEqual(["google"]);
    expect(config!.deployTarget).toBe("zeabur");
  });

  it("applies toSlug to the slug field", async () => {
    vi.mocked(clack.group).mockResolvedValue({
      slug: "My Cool App",
      displayName: "My Cool App",
      description: "",
      author: "",
      dbName: "my_cool_app",
      theme: "dark",
      oauthProviders: [],

      deployTarget: "manual",
    });

    const config = await collectConfig();
    expect(config!.slug).toBe("my-cool-app");
  });

  it("uses slug as displayName fallback when displayName is empty", async () => {
    vi.mocked(clack.group).mockResolvedValue({
      slug: "my-app",
      displayName: "",
      description: "",
      author: "",
      dbName: "",
      theme: "dark",
      oauthProviders: [],

      deployTarget: "manual",
    });

    const config = await collectConfig();
    expect(config!.displayName).toBe("my-app");
  });

  it("defaults empty array for undefined oauthProviders", async () => {
    vi.mocked(clack.group).mockResolvedValue({
      slug: "test",
      displayName: "Test",
      description: "",
      author: "",
      dbName: "test",
      theme: "dark",
      oauthProviders: undefined,
      deployTarget: "manual",
    });

    const config = await collectConfig();
    expect(config!.oauthProviders).toEqual([]);
  });

  it("derives dbName from slug when dbName is empty", async () => {
    vi.mocked(clack.group).mockResolvedValue({
      slug: "my-cool-app",
      displayName: "My Cool App",
      description: "",
      author: "",
      dbName: "",
      theme: "dark",
      oauthProviders: [],

      deployTarget: "manual",
    });

    const config = await collectConfig();
    expect(config!.dbName).toBe("my_cool_app");
  });

  it("defaults description and author to empty strings", async () => {
    vi.mocked(clack.group).mockResolvedValue({
      slug: "app",
      displayName: "App",
      description: undefined,
      author: undefined,
      dbName: "app",
      theme: "dark",
      oauthProviders: [],

      deployTarget: "manual",
    });

    const config = await collectConfig();
    expect(config!.description).toBe("");
    expect(config!.author).toBe("");
  });
});
