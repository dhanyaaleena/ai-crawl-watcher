import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every dashboard view is per-user and reads the session cookie, so it renders
  // on request; Cache Components / partial prefetching would add nothing here.
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
