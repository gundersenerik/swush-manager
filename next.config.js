/** @type {import('next').NextConfig} */
const nextConfig = {
  // Limit request body size for API routes
  experimental: {
    serverActions: {
      bodySizeLimit: '1mb',
    },
  },
}

module.exports = nextConfig
