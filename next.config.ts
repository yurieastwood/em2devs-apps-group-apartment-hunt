import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bundle the curl-impersonate binary into every server route's trace.
  // Server actions live with their page route (e.g. /listings/new), not under
  // /api/**, so the matcher must be broad. The 4 MB binary only ships with
  // dynamic routes — static pages get nothing.
  outputFileTracingIncludes: {
    "/**": ["./bin/curl-impersonate"],
  },

  // Allow next/image (if we ever switch from <img> to <Image>) to load from
  // R2's public URL spaces.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.r2.dev" },
      { protocol: "https", hostname: "*.r2.cloudflarestorage.com" },
    ],
  },

  // Backstop the noindex/nofollow meta tag with a header so anything that
  // bypasses HTML parsing (e.g. fetch by URL, image crawlers) also sees it.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive, nosnippet, noimageindex",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
