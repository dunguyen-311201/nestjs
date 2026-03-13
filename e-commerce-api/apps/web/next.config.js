import path from 'path'
import { env as process_env } from 'process'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Monorepo root = e-commerce-api/
// turbopack.root and outputFileTracingRoot MUST be the same value
const MONOREPO_ROOT = path.join(__dirname, '../..')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  // Required so Turbopack can resolve next/package.json from monorepo node_modules
  turbopack: {
    root: MONOREPO_ROOT,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'loremflickr.com',
        pathname: '/**',
      },
    ],
  },
  // 'standalone' is for Docker/self-hosted builds only.
  // Vercel sets VERCEL=1 automatically — use their native output format instead.
  ...(process_env.VERCEL ? {} : { output: 'standalone' }),
}

export default nextConfig
