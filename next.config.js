/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow server-side only imports for Hedera SDK
  experimental: {
    serverComponentsExternalPackages: ["@hashgraph/sdk"],
  },
};

module.exports = nextConfig;
