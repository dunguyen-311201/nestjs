import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { CreateUserDto } from '../dto/create-user.dto';
import type { User } from '../entities/user.entity';
import { UsersService } from '../users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login(
    username: string,
    password: string,
  ): Promise<{ message: string; data: Record<string, unknown> | null }> {
    try {
      const user = await this.usersService.findByUsername(username);
      if (await this.verifyPassword(user, password, user?.password ?? '')) {
        const safeUser = { ...user };
        delete safeUser['password'];
        const accessToken = await this.jwtService.signAsync({
          sub: user!.id,
          username: user!.username,
          role: user!.role,
        });
        return {
          message: 'Login successful',
          data: { ...safeUser, accessToken },
        };
      }
      return { message: 'Invalid username or password', data: null };
    } catch {
      return { message: 'Login failed', data: null };
    }
  }

  async signup(createUserDto: CreateUserDto): Promise<User> {
    const hashedPassword = this.hashPassword(createUserDto.password);
    return this.usersService.create({
      ...createUserDto,
      password: hashedPassword,
    });
  }

  hashPassword(password: string): string {
    return bcrypt.hashSync(password, 10);
  }

  async verifyPassword(
    user: User | null,
    password: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return user !== null && (await bcrypt.compare(password, hashedPassword));
  }
}
