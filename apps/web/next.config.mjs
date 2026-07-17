import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * Two build targets from one codebase:
 *  - STATIC_EXPORT=1 (GitHub Pages workflow): fully client-side demo —
 *    template stories, procedural art, localStorage. Free mirror.
 *  - default (Vercel + local dev): server mode with API routes — the
 *    /api/generate route runs the real AI pipeline for signed-in parents.
 */
const isStatic = process.env.STATIC_EXPORT === "1";

/** @type {import("next").NextConfig} */
const nextConfig = {
  ...(isStatic ? { output: "export" } : {}),
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? "",
  trailingSlash: true,
  images: { unoptimized: true },
  // Static export serves public/index.html (client language detection) at /;
  // server mode needs a real redirect for the root.
  ...(isStatic
    ? {}
    : {
        redirects: async () => [{ source: "/", destination: "/en", permanent: false }],
      }),
  // Workspace packages ship TS source (Node type-stripping style); teach
  // webpack to transpile them and resolve their .js/.ts specifiers.
  transpilePackages: ["@jmw/magic-fill", "@jmw/ai"],
  webpack: (config) => {
    config.resolve.extensionAlias = { ".js": [".ts", ".js"] };
    return config;
  },
};

export default withNextIntl(nextConfig);
