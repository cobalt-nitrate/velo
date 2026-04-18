/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // enables Docker multi-stage builds
  reactStrictMode: true,
  transpilePackages: ['@velo/agents', '@velo/core', '@velo/tools'],
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
