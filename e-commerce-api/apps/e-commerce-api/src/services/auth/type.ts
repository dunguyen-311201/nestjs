import { User } from '#entities'

export interface IAuthService {
  register(body: User): Promise<User>
  login(
    identifier: string,
    password: string,
  ): Promise<{ user: User; jwt: string }>
}
