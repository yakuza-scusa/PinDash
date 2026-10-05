import type { NextConfig } from "next";

function configuredApiOrigin(): string {
  try {
    return new URL(
      process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1",
    ).origin;
  } catch {
    return "http://localhost:4000";
  }
}

const apiOrigin = configuredApiOrigin();
const developmentScriptPolicy =
  process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ["@pindash/contracts"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; img-src 'self' data: blob: ${apiOrigin}; connect-src 'self' ${apiOrigin}; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'${developmentScriptPolicy}; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`,
          },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
