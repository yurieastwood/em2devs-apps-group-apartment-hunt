import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bundle the curl-impersonate binary into every server route's trace.
  // Server actions live with their page route (e.g. /listings/new), not under
  // /api/**, so the matcher must be broad. The 4 MB binary only ships with
  // dynamic routes — static pages get nothing.
  outputFileTracingIncludes: {
    "/**": ["./bin/curl-impersonate"],
  },
};

export default nextConfig;
