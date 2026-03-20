/**
 * Parameters for creating authentication tokens
 */
export type CreateSignInTokensParams = {
  userId: string
  expiresInSeconds: number
}

/**
 * Parameters for password verification
 */
export type VerifyPasswordParams = {
  userId: string
  password: string
}

/**
 * Parameters for user login
 * @property identifier - Email or username
 * @property password - User's password
 */
export type LoginParams = {
  identifier: string
  password: string
}
