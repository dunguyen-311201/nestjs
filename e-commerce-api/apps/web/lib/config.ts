const isServer = typeof window === 'undefined'

export const config = {
  api: {
    endpoint:
      (isServer
        ? process.env.API_URL || process.env.NEXT_PUBLIC_API_ENDPOINT
        : process.env.NEXT_PUBLIC_API_ENDPOINT) || '',
  },

  clerk: {
    tokenTemplate: process.env.NEXT_PUBLIC_CLERK_TOKEN_TEMPLATE || '',
  },

  stripe: {
    publicKey: process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY || '',
  },

  app: {
    baseUrl: process.env.NEXT_PUBLIC_BASE_URL || '',
  },

  isDevelopment: process.env.NODE_ENV === 'development',
} as const

// Validation check for debugging
if (isServer && !config.api.endpoint) {
  console.error('Missing API_URL or NEXT_PUBLIC_API_ENDPOINT')
}
