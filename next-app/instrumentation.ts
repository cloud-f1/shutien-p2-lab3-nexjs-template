/**
 * instrumentation.ts — Next.js 可觀測性初始化鉤子
 *
 * Next.js 在伺服器啟動時呼叫 `register()`，此處用於初始化 Sentry（如有設定）。
 * 當 SENTRY_DSN 未設定時，此函式為完全無操作（no-op）——模板可在無任何觀測設定下正常運行。
 * 不可在此處加入 withSentryConfig (next.config.ts 保持不變)。
 *
 * 執行環境守衛：
 *   - NEXT_RUNTIME=nodejs  → 伺服器端初始化
 *   - NEXT_RUNTIME=edge    → Edge Runtime 初始化
 *   - 其他 (測試/build)   → 略過
 */
export async function register(): Promise<void> {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) {
    // 未設定 DSN — 完全跳過，不載入 Sentry 套件
    return
  }

  const runtime = process.env.NEXT_RUNTIME

  if (runtime === "nodejs") {
    const Sentry = await import("@sentry/nextjs")
    Sentry.init({
      dsn,
      // 生產環境啟用效能取樣，開發環境維持 100% 方便偵錯
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
      // 生產環境不開啟 debug 輸出
      debug: process.env.NODE_ENV !== "production",
    })
  }

  if (runtime === "edge") {
    const Sentry = await import("@sentry/nextjs")
    Sentry.init({
      dsn,
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
      debug: process.env.NODE_ENV !== "production",
    })
  }
}
