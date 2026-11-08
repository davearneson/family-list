import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server in .next/standalone, used by the Docker image (Vercel ignores this).
  output: "standalone",
  // The database client ships native code for local SQLite files; keep it out of the bundle.
  serverExternalPackages: ["@libsql/client", "libsql"],
  // libsql picks its native binary at runtime (e.g. @libsql/linux-x64-gnu), which the
  // standalone file tracer can't see, so include whichever one is installed.
  outputFileTracingIncludes: {
    "/*": ["./node_modules/@libsql/{darwin,linux,win32}-*/**/*"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
