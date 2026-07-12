/**
 * 藍新 NewebPay MPG (幕前支付) PaymentProvider adapter — E329
 *
 * Implements ONLY `OneTimePaymentGateway` from E327's ISP split — NewebPay's MPG
 * 幕前支付 is a single-charge hosted checkout. There are NO SubscriptionGateway
 * methods and NO NotImplemented stubs (LSP-clean): recurring intent is rejected
 * at resolve time by `resolveSubscription("newebpay")`, not by a throwing method
 * on this class.
 *
 * MPG protocol (Version 2.0), mirrored from the official 幕前支付串接手冊 and the
 * ECPay adapter's conventions:
 *   - TradeInfo  — the checkout params serialized as a URL-encoded query string,
 *     then **AES-256-CBC** encrypted with the 32-byte HashKey (key) + 16-byte
 *     HashIV (iv), PKCS#7 padding, lower-case **hex** output.
 *   - TradeSha   — `SHA256("HashKey={HashKey}&{TradeInfo}&HashIV={HashIV}")`
 *     upper-cased. Recomputed over the posted TradeInfo to authenticate a notify.
 *   - Gateway    — POST { MerchantID, TradeInfo, TradeSha, Version } to
 *     `${base}/MPG/mpg_gateway`. Sandbox base `https://ccore.newebpay.com`,
 *     production `https://core.newebpay.com`.
 *   - Notify     — NewebPay POSTs { Status, MerchantID, Version, TradeInfo,
 *     TradeSha } back. Status="SUCCESS" (top-level) means the charge succeeded;
 *     the decrypted TradeInfo is `{ Status, Message, Result: { MerchantOrderNo,
 *     TradeNo, Amt, ... } }`.
 *
 * Order traceability — the notify only round-trips **MerchantOrderNo** (max 30
 * chars, `[A-Za-z0-9_]`); it does NOT echo ItemDesc / OrderComment in `Result`.
 * A raw orders.id UUID (36 chars, hyphens) does not fit that field, so we carry
 * the order by encoding its 128-bit value as base36 (≤ 25 chars, url-safe) into
 * MerchantOrderNo and decode it back to the UUID in the notify route. This is the
 * NewebPay analogue of ECPay's CustomField3 orders.id round-trip.
 *
 * Environment variables required:
 *   NEWEBPAY_MERCHANT_ID   — 藍新商店代號 (MerchantID)
 *   NEWEBPAY_HASH_KEY      — 藍新 HashKey (32 chars → AES-256 key)
 *   NEWEBPAY_HASH_IV       — 藍新 HashIV  (16 chars → AES CBC iv)
 *   NEWEBPAY_API_BASE_URL  — (optional) explicit gateway base URL override
 *   NEWEBPAY_SANDBOX       — (optional) "false" → production; anything else → sandbox
 */

import crypto from "crypto"
import type {
  CheckoutResult,
  CreateCheckoutArgs,
  OneTimePaymentGateway,
  WebhookVerifyResult,
} from "../provider"
import { PaymentProviderError } from "../provider"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** MPG protocol version this adapter speaks. */
export const NEWEBPAY_VERSION = "2.0"

/** Sandbox (測試站) gateway base URL. */
export const NEWEBPAY_SANDBOX_BASE = "https://ccore.newebpay.com"

/** Production (正式站) gateway base URL. */
export const NEWEBPAY_PROD_BASE = "https://core.newebpay.com"

/** Max length of MerchantOrderNo per the MPG spec (`[A-Za-z0-9_]`). */
export const MERCHANT_ORDER_NO_MAX = 30

/** Max length of ItemDesc per the MPG spec. */
const ITEM_DESC_MAX = 50

// ---------------------------------------------------------------------------
// AES-256-CBC + SHA256 — official MPG crypto (Node `crypto` only, no deps)
// ---------------------------------------------------------------------------

/**
 * AES-256-CBC encrypt a UTF-8 string → lower-case hex, PKCS#7 padding.
 * Matches the official PHP `openssl_encrypt($data, "aes-256-cbc", $key, 0, $iv)`
 * (flag 0 ⇒ standard PKCS#7). HashKey MUST be 32 bytes, HashIV 16 bytes.
 */
export function encryptTradeInfo(
  plaintext: string,
  hashKey: string,
  hashIv: string,
): string {
  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    Buffer.from(hashKey, "utf8"),
    Buffer.from(hashIv, "utf8"),
  )
  // Default autoPadding = true ⇒ PKCS#7 on a 16-byte block, matching OpenSSL.
  return cipher.update(plaintext, "utf8", "hex") + cipher.final("hex")
}

/**
 * AES-256-CBC decrypt a hex string → UTF-8 plaintext.
 *
 * Uses manual padding-strip (`setAutoPadding(false)` + trim trailing control
 * bytes) so it is robust to BOTH standard PKCS#7 (our own encrypt) and the
 * zero/space padding some NewebPay responses carry — the same defensive trim the
 * official PHP samples do after `openssl_decrypt`.
 */
export function decryptTradeInfo(
  tradeInfoHex: string,
  hashKey: string,
  hashIv: string,
): string {
  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    Buffer.from(hashKey, "utf8"),
    Buffer.from(hashIv, "utf8"),
  )
  decipher.setAutoPadding(false)
  const out = Buffer.concat([
    decipher.update(Buffer.from(tradeInfoHex, "hex")),
    decipher.final(),
  ])
  // Strip trailing padding bytes (PKCS#7 pad 0x01–0x10 and NUL/space padding
  // are all <= 0x20; JSON never ends in a control/space byte).
  let end = out.length
  while (end > 0 && out[end - 1]! <= 0x20) end--
  return out.subarray(0, end).toString("utf8")
}

/**
 * Compute the MPG TradeSha over an (already hex-encoded) TradeInfo string:
 * `SHA256("HashKey={key}&{TradeInfo}&HashIV={iv}")` upper-cased.
 */
export function generateTradeSha(
  tradeInfoHex: string,
  hashKey: string,
  hashIv: string,
): string {
  return crypto
    .createHash("sha256")
    .update(`HashKey=${hashKey}&${tradeInfoHex}&HashIV=${hashIv}`, "utf8")
    .digest("hex")
    .toUpperCase()
}

/**
 * Verify a posted TradeSha against a recomputed one using a constant-time
 * comparison (`crypto.timingSafeEqual`). Returns false on any length/format
 * mismatch without leaking timing.
 */
export function verifyTradeSha(
  tradeInfoHex: string,
  receivedSha: string,
  hashKey: string,
  hashIv: string,
): boolean {
  const expected = generateTradeSha(tradeInfoHex, hashKey, hashIv)
  const a = Buffer.from(expected, "utf8")
  const b = Buffer.from((receivedSha ?? "").toUpperCase(), "utf8")
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

// ---------------------------------------------------------------------------
// Order traceability — orders.id UUID  ⇄  MerchantOrderNo (base36)
// ---------------------------------------------------------------------------

/**
 * Encode an `orders.id` UUID as a NewebPay MerchantOrderNo.
 *
 * The 128-bit UUID is rendered in base36 (`[0-9a-z]`, ≤ 25 chars) so it fits the
 * 30-char, `[A-Za-z0-9_]`-only MerchantOrderNo field AND round-trips through the
 * notify's `Result.MerchantOrderNo`. Deterministic ⇒ one order maps to one
 * MerchantOrderNo (NewebPay requires MerchantOrderNo uniqueness per successful
 * charge; a fresh order = a fresh UUID = a fresh MerchantOrderNo).
 */
export function orderIdToMerchantOrderNo(orderId: string): string {
  const hex = orderId.replace(/-/g, "")
  if (!/^[0-9a-f]{32}$/i.test(hex)) {
    throw new PaymentProviderError(
      `Cannot derive a MerchantOrderNo from "${orderId}" — expected an orders.id UUID.`,
      "newebpay",
      "invalid_order_id",
    )
  }
  return BigInt(`0x${hex}`).toString(36)
}

/**
 * Reverse {@link orderIdToMerchantOrderNo}: decode a MerchantOrderNo back to the
 * canonical `orders.id` UUID. Returns null when the value is not a valid base36
 * encoding of a 128-bit id (e.g. a MerchantOrderNo set by some other flow).
 */
export function merchantOrderNoToOrderId(merchantOrderNo: string): string | null {
  if (!/^[0-9a-z]+$/.test(merchantOrderNo)) return null
  const BASE = BigInt(36)
  let n = BigInt(0)
  for (const ch of merchantOrderNo) {
    const digit = parseInt(ch, 36)
    if (Number.isNaN(digit)) return null
    n = n * BASE + BigInt(digit)
  }
  const hex = n.toString(16)
  if (hex.length > 32) return null // overflows a 128-bit id
  const padded = hex.padStart(32, "0")
  const uuid = `${padded.slice(0, 8)}-${padded.slice(8, 12)}-${padded.slice(12, 16)}-${padded.slice(16, 20)}-${padded.slice(20)}`
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)
    ? uuid
    : null
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

interface NewebPayConfig {
  merchantId: string
  hashKey: string
  hashIv: string
  apiBaseUrl: string
}

function getNewebPayConfig(): NewebPayConfig {
  const merchantId = process.env.NEWEBPAY_MERCHANT_ID
  const hashKey = process.env.NEWEBPAY_HASH_KEY
  const hashIv = process.env.NEWEBPAY_HASH_IV

  if (!merchantId) {
    throw new PaymentProviderError(
      "NEWEBPAY_MERCHANT_ID is not set. Add it to your .env.local file.",
      "newebpay",
      "missing_merchant_id",
    )
  }
  if (!hashKey) {
    throw new PaymentProviderError(
      "NEWEBPAY_HASH_KEY is not set. Add it to your .env.local file.",
      "newebpay",
      "missing_hash_key",
    )
  }
  if (!hashIv) {
    throw new PaymentProviderError(
      "NEWEBPAY_HASH_IV is not set. Add it to your .env.local file.",
      "newebpay",
      "missing_hash_iv",
    )
  }

  // Explicit override wins; otherwise NEWEBPAY_SANDBOX="false" → production.
  const apiBaseUrl =
    process.env.NEWEBPAY_API_BASE_URL ??
    (process.env.NEWEBPAY_SANDBOX === "false"
      ? NEWEBPAY_PROD_BASE
      : NEWEBPAY_SANDBOX_BASE)

  return { merchantId, hashKey, hashIv, apiBaseUrl }
}

// ---------------------------------------------------------------------------
// Auto-submit form helper — mirror ecpay.ts's data-URI checkout form
// ---------------------------------------------------------------------------

function buildCheckoutForm(
  params: Record<string, string>,
  actionUrl: string,
): string {
  const fields = Object.entries(params)
    .map(
      ([k, v]) =>
        `<input type="hidden" name="${k}" value="${v.replace(/"/g, "&quot;")}">`,
    )
    .join("")

  const html = `<!DOCTYPE html><html><body><form id="f" method="post" action="${actionUrl}">${fields}</form><script>document.getElementById('f').submit();</script></body></html>`

  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
}

// ---------------------------------------------------------------------------
// NewebPayProvider — implements ONLY OneTimePaymentGateway (E327 ISP split)
// ---------------------------------------------------------------------------

export class NewebPayProvider implements OneTimePaymentGateway {
  readonly name = "newebpay"

  /**
   * Open a 藍新 MPG 幕前支付 checkout for a ONE-TIME product purchase.
   *
   * Returns an auto-submit HTML `<form>` (as a data URI, like ecpay.ts) that
   * POSTs { MerchantID, TradeInfo, TradeSha, Version } to the MPG gateway. The
   * order amount comes from `args.amount` (server-owned snapshot); `args.orderId`
   * is encoded into MerchantOrderNo so the notify route can settle the order.
   */
  async createCheckout(args: CreateCheckoutArgs): Promise<CheckoutResult> {
    if (args.mode === "subscription") {
      throw new PaymentProviderError(
        "NewebPay MPG (幕前支付) is a one-time-only gateway; use stripe or ecpay for subscriptions.",
        "newebpay",
        "subscription_unsupported",
      )
    }

    const config = getNewebPayConfig()

    const amount = args.amount ?? 0
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new PaymentProviderError(
        `Invalid one-time amount "${String(args.amount)}". Pass a positive integer Amt (NTD).`,
        "newebpay",
        "invalid_one_time_amount",
      )
    }

    if (!args.orderId) {
      throw new PaymentProviderError(
        "NewebPay one-time checkout requires args.orderId — it is encoded into MerchantOrderNo so the notify can settle the order.",
        "newebpay",
        "missing_order_id",
      )
    }

    const merchantOrderNo = orderIdToMerchantOrderNo(args.orderId)
    if (merchantOrderNo.length > MERCHANT_ORDER_NO_MAX) {
      throw new PaymentProviderError(
        `Derived MerchantOrderNo "${merchantOrderNo}" exceeds ${MERCHANT_ORDER_NO_MAX} chars.`,
        "newebpay",
        "merchant_order_no_too_long",
      )
    }

    const itemDesc = (args.productName ?? "One-time purchase").slice(0, ITEM_DESC_MAX)
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ?? new URL(args.successUrl).origin
    const notifyUrl = `${origin}/api/billing/newebpay/return`

    // TradeInfo params (Version 2.0). RespondType JSON ⇒ notify body decrypts to
    // a JSON object. ReturnURL (幕前) + NotifyURL (幕後) both hit our settlement
    // route — settleOrder() is idempotent, so receiving both is safe.
    const tradeInfoParams: Record<string, string> = {
      MerchantID: config.merchantId,
      RespondType: "JSON",
      TimeStamp: String(Math.floor(Date.now() / 1000)),
      Version: NEWEBPAY_VERSION,
      MerchantOrderNo: merchantOrderNo,
      Amt: String(amount),
      ItemDesc: itemDesc,
      ReturnURL: notifyUrl,
      NotifyURL: notifyUrl,
      // Buyer's "return to store" button lands on the thanks page.
      ClientBackURL: args.successUrl,
    }
    if (args.customerEmail) {
      tradeInfoParams.Email = args.customerEmail
    }

    const tradeInfoQuery = new URLSearchParams(tradeInfoParams).toString()
    const tradeInfo = encryptTradeInfo(tradeInfoQuery, config.hashKey, config.hashIv)
    const tradeSha = generateTradeSha(tradeInfo, config.hashKey, config.hashIv)

    const formParams: Record<string, string> = {
      MerchantID: config.merchantId,
      TradeInfo: tradeInfo,
      TradeSha: tradeSha,
      Version: NEWEBPAY_VERSION,
    }

    const actionUrl = `${config.apiBaseUrl}/MPG/mpg_gateway`
    const checkoutUrl = buildCheckoutForm(formParams, actionUrl)

    return {
      checkoutUrl,
      // MerchantOrderNo is the reconciliation key for a NewebPay order.
      sessionId: merchantOrderNo,
    }
  }

  /**
   * Verify a 藍新 MPG notify (ReturnURL / NotifyURL). NewebPay POSTs a
   * URL-encoded form with TradeInfo + TradeSha; auth is body-based (recompute
   * TradeSha, constant-time compare), not header-based.
   *
   * On success returns a normalized payload the settlement route consumes:
   *   { status, merchantOrderNo, tradeNo, amount, message, result }
   */
  async verifyWebhook(
    rawBody: Buffer | string,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<WebhookVerifyResult> {
    void headers // NewebPay auth is body-based via TradeSha, not header-based.
    const config = getNewebPayConfig()

    const bodyStr = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8")
    const params: Record<string, string> = {}
    for (const [k, v] of new URLSearchParams(bodyStr).entries()) {
      params[k] = v
    }

    const tradeInfo = params["TradeInfo"]
    const tradeSha = params["TradeSha"]
    if (!tradeInfo || !tradeSha) {
      return { valid: false, eventType: "", payload: null }
    }

    if (!verifyTradeSha(tradeInfo, tradeSha, config.hashKey, config.hashIv)) {
      return { valid: false, eventType: "", payload: params }
    }

    let decoded: {
      Status?: string
      Message?: string
      Result?: Record<string, unknown>
    }
    try {
      decoded = JSON.parse(
        decryptTradeInfo(tradeInfo, config.hashKey, config.hashIv),
      )
    } catch {
      // Signature was valid but ciphertext didn't decode to JSON — treat as invalid.
      return { valid: false, eventType: "", payload: params }
    }

    const result = (decoded.Result ?? {}) as Record<string, unknown>

    return {
      valid: true,
      eventType: "newebpay.mpg.notify",
      payload: {
        status: decoded.Status ?? "",
        message: decoded.Message ?? "",
        merchantOrderNo: String(result["MerchantOrderNo"] ?? ""),
        tradeNo: String(result["TradeNo"] ?? ""),
        amount: Number(result["Amt"] ?? 0),
        result,
      },
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton factory
// ---------------------------------------------------------------------------

let _instance: NewebPayProvider | undefined

export function getNewebPayProvider(): NewebPayProvider {
  if (!_instance) {
    _instance = new NewebPayProvider()
  }
  return _instance
}

/** Reset singleton — for testing only. */
export function _resetNewebPayProvider(): void {
  _instance = undefined
}
