import { describe, expect, it } from "vitest"

import { generateApiKey, hashEquals, hashKey, parseApiKey } from "./api-keys-utils"

describe("api-keys-utils", () => {
  it("generates sk_<prefix>_<secret> with a parseable, hashed form", () => {
    const { plaintext, prefix, hashedKey } = generateApiKey()
    expect(plaintext.startsWith(`sk_${prefix}_`)).toBe(true)
    const parsed = parseApiKey(plaintext)
    expect(parsed).not.toBeNull()
    expect(parsed!.prefix).toBe(prefix)
    // stored hash matches a fresh hash of the parsed secret (verify roundtrip)
    expect(hashEquals(hashedKey, hashKey(parsed!.secret))).toBe(true)
  })

  it("parses a secret that contains '_' and '-' without truncating the prefix (regression)", () => {
    // base64url secrets routinely contain '_' and '-'. A greedy prefix group
    // used to eat into the secret here, breaking prefix lookup intermittently.
    const parsed = parseApiKey("sk_a1b2c3d4_abc_def-ghi_jkl-mno")
    expect(parsed).toEqual({ prefix: "a1b2c3d4", secret: "abc_def-ghi_jkl-mno" })
  })

  it("generates a delimiter-free (hex) prefix so the split is unambiguous (regression)", () => {
    // Run many times: with a non-hex/greedy prefix this was flaky by random seed.
    for (let i = 0; i < 200; i++) {
      const { plaintext, prefix } = generateApiKey()
      expect(prefix).toMatch(/^[0-9a-f]{8}$/)
      expect(parseApiKey(plaintext)!.prefix).toBe(prefix)
    }
  })

  it("parses a Bearer header and rejects malformed tokens", () => {
    const { plaintext } = generateApiKey()
    expect(parseApiKey(`Bearer ${plaintext}`)).not.toBeNull()
    expect(parseApiKey("not-a-key")).toBeNull()
    expect(parseApiKey("")).toBeNull()
    expect(parseApiKey(null)).toBeNull()
  })

  it("hashKey is deterministic; hashEquals rejects a different secret", () => {
    expect(hashKey("abc")).toBe(hashKey("abc"))
    expect(hashEquals(hashKey("abc"), hashKey("xyz"))).toBe(false)
  })
})
