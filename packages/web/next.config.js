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
  serverExternalPackages: ['jose'],
  webpack: (config, { dev }) => {
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
    };
    // On nearly-full disks, webpack's default filesystem pack cache hits ENOSPC.
    // Memory cache avoids huge writes under packages/web/.next/cache/webpack.
    if (dev) {
      config.cache = { type: 'memory' };
    }
    return config;
  },
};

module.exports = nextConfig;
