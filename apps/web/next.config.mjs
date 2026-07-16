import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * Static export: the demo runs entirely client-side (template stories +
 * procedural line art + localStorage), so it deploys to GitHub Pages for
 * free. NEXT_PUBLIC_BASE_PATH is "/<repo>" on Pages, empty locally.
 * When the server-backed AI pipeline lands (Supabase, Inngest), this
 * switches back to a server target on Vercel.
 */
/** @type {import("next").NextConfig} */
const nextConfig = {
  output: "export",
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? "",
  trailingSlash: true,
  images: { unoptimized: true },
  // @jmw/magic-fill is TS source with .js specifiers (Node type-stripping
  // style); teach webpack to resolve them.
  transpilePackages: ["@jmw/magic-fill"],
  webpack: (config) => {
    config.resolve.extensionAlias = { ".js": [".ts", ".js"] };
    return config;
  },
};

export default withNextIntl(nextConfig);
