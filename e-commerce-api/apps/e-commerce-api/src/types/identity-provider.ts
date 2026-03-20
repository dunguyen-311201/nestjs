export interface IIdentityProvider {
  login(
    identifier: string,
    password: string,
  ): Promise<{ jwt: string; userId: string }>
}
