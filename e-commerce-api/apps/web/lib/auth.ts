import { auth } from '@clerk/nextjs/server'

import { config } from './config'

type GenerateTokenInput = {
  template?: string
  expiresInSeconds?: number
}

export const generateToken = async (customs?: GenerateTokenInput) => {
  const { getToken } = await auth()

  const token = await getToken({
    template: customs?.template || config.clerk.tokenTemplate,
    expiresInSeconds: customs?.expiresInSeconds || 60,
  })

  return token
}

// create authorization header
export const createAuthorizationHeader = async (input?: GenerateTokenInput) => {
  const token = await generateToken(input)

  return {
    Authorization: `Bearer ${token}`,
  }
}
