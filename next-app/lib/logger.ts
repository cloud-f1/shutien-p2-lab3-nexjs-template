/**
 * lib/logger.ts — 結構化日誌記錄器
 *
 * 在 production (NODE_ENV=production) 輸出 JSON 行（方便 log aggregator 解析）。
 * 在 development 輸出人類可讀的前綴格式。
 * 不依賴任何外部套件，也不連接資料庫，可在 Server Components 中安全使用。
 */

type LogLevel = "info" | "warn" | "error"

interface LogEntry {
  level: LogLevel
  message: string
  ts: string
  data?: unknown
}

function formatDev(level: LogLevel, message: string, data?: unknown): string {
  const prefix = level === "error" ? "[ERROR]" : level === "warn" ? "[WARN]" : "[INFO]"
  const dataStr = data !== undefined ? " " + JSON.stringify(data) : ""
  return `${prefix} ${message}${dataStr}`
}

function formatProd(level: LogLevel, message: string, data?: unknown): string {
  const entry: LogEntry = {
    level,
    message,
    ts: new Date().toISOString(),
  }
  if (data !== undefined) {
    entry.data = data
  }
  return JSON.stringify(entry)
}

function log(level: LogLevel, message: string, data?: unknown): void {
  const isProd = process.env.NODE_ENV === "production"
  const line = isProd ? formatProd(level, message, data) : formatDev(level, message, data)

  if (level === "error") {
    console.error(line)
  } else if (level === "warn") {
    console.warn(line)
  } else {
    console.info(line)
  }
}

export const logger = {
  info(message: string, data?: unknown): void {
    log("info", message, data)
  },
  warn(message: string, data?: unknown): void {
    log("warn", message, data)
  },
  error(message: string, data?: unknown): void {
    log("error", message, data)
  },
}
