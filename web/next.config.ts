import type { NextConfig } from "next";

/** The NestJS API. The browser talks to it through /api on this origin, so there is no CORS hop. */
const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:3000";

const nextConfig: NextConfig = {
  turbopack: {
    // There is a lockfile here and one at the repo root, so say which one is the app
    // root rather than letting Next infer it.
    root: import.meta.dirname,

    // Tailwind v4 compiles through this Turbopack loader (set up by create-next-app).
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },

  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_ORIGIN}/:path*` }];
  },
};

export default nextConfig;
