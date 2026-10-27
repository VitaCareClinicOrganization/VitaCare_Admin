import type { NextConfig } from 'next'
import { API_BASE_PATH, MEDIA_PATHS, BACKEND_ORIGIN } from './src/lib/api-client'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: [
    '169.254.223.69',
    '192.168.1.37',
    'localhost',
    '127.0.0.1',
  ],
  async rewrites() {
    return [API_BASE_PATH, ...MEDIA_PATHS].map(path => ({
      source: `${path}/:path*`, destination: `${BACKEND_ORIGIN}${path}/:path*`,
    }))
  },
  async headers() {
    return [{ source: `${API_BASE_PATH}/:path*`, headers: [{ key: 'Cache-Control', value: 'no-store' }] }]
  },
}

export default nextConfig
