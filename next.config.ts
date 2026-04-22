import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/**": ["./bin/curl-impersonate"],
  },
};

export default nextConfig;
