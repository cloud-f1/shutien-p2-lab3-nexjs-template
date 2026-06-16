import type { NextConfig } from "next"
import { SECURITY_HEADERS } from "./lib/security-headers"

const nextConfig: NextConfig = {
  output: "standalone",

  /**
   * Apply HTTP security headers to every route.
   * The header list is defined in lib/security-headers.ts so it can be
   * imported, unit-tested, and customised independently of this config file.
   */
  async headers() {
    return [
      {
        // Apply to all routes.
        source: "/(.*)",
        headers: SECURITY_HEADERS,
      },
    ]
  },
}

export default nextConfig
