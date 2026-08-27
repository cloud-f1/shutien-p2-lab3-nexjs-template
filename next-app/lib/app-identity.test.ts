import { describe, expect, it } from "vitest"

import {
  computeAppInstanceId,
  normalizeProjectPath,
  resolveAppInstanceId,
} from "./app-identity"

describe("computeAppInstanceId", () => {
  it("is deterministic for the same path", () => {
    expect(computeAppInstanceId("/Users/dev/projects/app/next-app")).toBe(
      computeAppInstanceId("/Users/dev/projects/app/next-app")
    )
  })

  it("separates two checkouts that differ ONLY by path", () => {
    // The E357 scenario: `cp -R` of this repo, zero config changes — same
    // package name, same version, same NEXT_PUBLIC_APP_NAME, same everything.
    const upstream = computeAppInstanceId(
      "/Users/dev/git/ai-coding-nexjs-template/next-app"
    )
    const fork = computeAppInstanceId(
      "/Users/dev/git/data-clarity-portal/next-app"
    )
    expect(fork).not.toBe(upstream)
  })

  it("separates a git worktree from its parent checkout", () => {
    const main = computeAppInstanceId("/repo/next-app")
    const worktree = computeAppInstanceId(
      "/repo/.claude/worktrees/agent-abc/next-app"
    )
    expect(worktree).not.toBe(main)
  })

  it("normalises equivalent spellings of the same path to one id", () => {
    expect(computeAppInstanceId("/repo/next-app")).toBe(
      computeAppInstanceId("/repo/./next-app/")
    )
    expect(computeAppInstanceId("/repo/next-app")).toBe(
      computeAppInstanceId("/repo/lib/../next-app")
    )
  })

  it("returns a short opaque lowercase-hex token that does not leak the path", () => {
    const path = "/Users/someone-private/secret-project/next-app"
    const id = computeAppInstanceId(path)
    expect(id).toMatch(/^[0-9a-f]{16}$/)
    expect(id).not.toContain("someone-private")
    expect(id).not.toContain("secret-project")
  })
})

describe("normalizeProjectPath", () => {
  it("falls back to an absolute path when the path cannot be resolved on disk", () => {
    // Nonexistent path: realpath throws, and we must degrade to resolve() so a
    // bad path produces a mismatch, never a crash inside the health route.
    expect(normalizeProjectPath("/definitely/not/a/real/path/../path")).toBe(
      "/definitely/not/a/real/path"
    )
  })
})

describe("resolveAppInstanceId", () => {
  it("derives the id from the server's working directory by default", () => {
    expect(resolveAppInstanceId({}, "/repo/next-app")).toBe(
      computeAppInstanceId("/repo/next-app")
    )
  })

  it("honours an explicit APP_INSTANCE_ID override (containers, standalone builds)", () => {
    expect(
      resolveAppInstanceId({ APP_INSTANCE_ID: "staging-web-1" }, "/app")
    ).toBe("staging-web-1")
  })

  it("trims the override and ignores a blank one", () => {
    expect(
      resolveAppInstanceId({ APP_INSTANCE_ID: "  pinned  " }, "/app")
    ).toBe("pinned")
    expect(
      resolveAppInstanceId({ APP_INSTANCE_ID: "   " }, "/repo/next-app")
    ).toBe(computeAppInstanceId("/repo/next-app"))
  })
})
