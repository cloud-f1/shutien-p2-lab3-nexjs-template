import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Reset module registry before each test so we can re-import with different NODE_ENV
beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("logger (development mode)", () => {
  it("info emits a human-readable [INFO] line", async () => {
    vi.stubEnv("NODE_ENV", "development")
    const { logger } = await import("./logger")
    const spy = vi.spyOn(console, "info").mockImplementation(() => {})
    logger.info("測試訊息")
    expect(spy).toHaveBeenCalledOnce()
    const output = spy.mock.calls[0][0] as string
    expect(output).toContain("[INFO]")
    expect(output).toContain("測試訊息")
  })

  it("warn emits a human-readable [WARN] line", async () => {
    vi.stubEnv("NODE_ENV", "development")
    const { logger } = await import("./logger")
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {})
    logger.warn("警告訊息", { code: 42 })
    expect(spy).toHaveBeenCalledOnce()
    const output = spy.mock.calls[0][0] as string
    expect(output).toContain("[WARN]")
    expect(output).toContain("警告訊息")
    expect(output).toContain("42")
  })

  it("error emits a human-readable [ERROR] line", async () => {
    vi.stubEnv("NODE_ENV", "development")
    const { logger } = await import("./logger")
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    logger.error("發生錯誤", new Error("oops"))
    expect(spy).toHaveBeenCalledOnce()
    const output = spy.mock.calls[0][0] as string
    expect(output).toContain("[ERROR]")
    expect(output).toContain("發生錯誤")
  })

  it("info without data omits the data field", async () => {
    vi.stubEnv("NODE_ENV", "development")
    const { logger } = await import("./logger")
    const spy = vi.spyOn(console, "info").mockImplementation(() => {})
    logger.info("無附加資料")
    const output = spy.mock.calls[0][0] as string
    // Should not contain a trailing JSON object
    expect(output).toBe("[INFO] 無附加資料")
  })
})

describe("logger (production mode)", () => {
  it("info emits a valid JSON line with level=info", async () => {
    vi.stubEnv("NODE_ENV", "production")
    const { logger } = await import("./logger")
    const spy = vi.spyOn(console, "info").mockImplementation(() => {})
    logger.info("prod 訊息", { userId: "u1" })
    expect(spy).toHaveBeenCalledOnce()
    const output = spy.mock.calls[0][0] as string
    const parsed = JSON.parse(output) as Record<string, unknown>
    expect(parsed.level).toBe("info")
    expect(parsed.message).toBe("prod 訊息")
    expect(parsed.ts).toBeTruthy()
    expect((parsed.data as Record<string, unknown>).userId).toBe("u1")
  })

  it("warn emits a valid JSON line with level=warn", async () => {
    vi.stubEnv("NODE_ENV", "production")
    const { logger } = await import("./logger")
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {})
    logger.warn("prod 警告")
    const output = spy.mock.calls[0][0] as string
    const parsed = JSON.parse(output) as Record<string, unknown>
    expect(parsed.level).toBe("warn")
    expect(parsed.message).toBe("prod 警告")
    expect(parsed.data).toBeUndefined()
  })

  it("error emits a valid JSON line with level=error", async () => {
    vi.stubEnv("NODE_ENV", "production")
    const { logger } = await import("./logger")
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    logger.error("prod 錯誤", { reason: "db" })
    const output = spy.mock.calls[0][0] as string
    const parsed = JSON.parse(output) as Record<string, unknown>
    expect(parsed.level).toBe("error")
    expect((parsed.data as Record<string, unknown>).reason).toBe("db")
  })

  it("ts field is an ISO 8601 string", async () => {
    vi.stubEnv("NODE_ENV", "production")
    const { logger } = await import("./logger")
    const spy = vi.spyOn(console, "info").mockImplementation(() => {})
    logger.info("timestamp test")
    const output = spy.mock.calls[0][0] as string
    const parsed = JSON.parse(output) as Record<string, unknown>
    expect(new Date(parsed.ts as string).toISOString()).toBe(parsed.ts)
  })
})
