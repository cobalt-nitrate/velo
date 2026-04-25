/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // enables Docker multi-stage builds
  reactStrictMode: true,
  transpilePackages: ['@velo/agents', '@velo/core', '@velo/tools'],
  /**
   * next-auth → jose. Bundling jose into webpack vendor chunks can leave broken
   * references (missing ./vendor-chunks/jose@*.js) after interrupted dev builds or
   * with in-memory webpack cache. Load jose from node_modules instead.
   */
  experimental: {
    // Next 14 doesn't support `serverExternalPackages`; use this instead.
    // Keep these as true runtime deps to avoid bundling issues in server routes.
    serverComponentsExternalPackages: ['jose', 'playwright', 'playwright-core', 'chromium-bidi', 'electron'],
  },
  webpack: (config, { dev, isServer }) => {
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
    };

    // Route handlers in Next 14 can still try to bundle optional deps from large
    // server-side libraries (e.g. Playwright -> electron). Keep them external.
    if (isServer) {
      const externals = config.externals ?? [];
      config.externals = [
        ...externals,
        ({ request }, cb) => {
          if (
            request === 'playwright' ||
            request === 'playwright-core' ||
            request === 'chromium-bidi' ||
            request === 'electron'
          ) {
            return cb(null, `commonjs ${request}`);
          }
          return cb();
        },
      ];
    }

    // On nearly-full disks, webpack's default filesystem pack cache hits ENOSPC.
    // Memory cache avoids huge writes under packages/web/.next/cache/webpack.
    if (dev) {
      config.cache = { type: 'memory' };
    }
    return config;
  },
};

module.exports = nextConfig;
