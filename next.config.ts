import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Health information must never leak through the framework's telemetry or
  // through the `x-powered-by` header.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
          // This app has no third-party integrations; keep it that way.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
