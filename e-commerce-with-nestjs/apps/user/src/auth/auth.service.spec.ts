import { Test, type TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import type { User } from '../entities/user.entity';
import { UsersService } from '../users.service';
import { AuthService } from './auth.service';

jest.mock('bcrypt', () => ({
  hashSync: jest.fn().mockReturnValue('hashed-password'),
  compare: jest.fn(),
}));

import * as bcrypt from 'bcrypt';

const mockUser: User = {
  id: 'uuid-1',
  name: 'Alice',
  username: 'alice',
  email: 'alice@example.com',
  password: 'hashed-password',
  avatarUrl: null,
} as User;

const mockUsersService = {
  findByUsername: jest.fn(),
  create: jest.fn(),
};

const mockJwtService = {
  signAsync: jest.fn().mockResolvedValue('jwt-token'),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login()', () => {
    it('should return accessToken on valid credentials', async () => {
      mockUsersService.findByUsername.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login('alice', 'Test123!@#');

      expect(result.message).toBe('Login successful');
      expect(result.data).toHaveProperty('accessToken', 'jwt-token');
      expect(result.data).not.toHaveProperty('password');
    });

    it('should return error message when user not found', async () => {
      mockUsersService.findByUsername.mockResolvedValue(null);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.login('nobody', 'Test123!@#');

      expect(result.message).toBe('Invalid username or password');
      expect(result.data).toBeNull();
    });

    it('should return error message when password does not match', async () => {
      mockUsersService.findByUsername.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.login('alice', 'wrongPass');

      expect(result.message).toBe('Invalid username or password');
      expect(result.data).toBeNull();
    });
  });

  describe('signup()', () => {
    it('should hash password and call usersService.create', async () => {
      mockUsersService.create.mockResolvedValue(mockUser);

      const dto = {
        name: 'Alice',
        username: 'alice',
        password: 'Test123!@#',
        email: 'alice@example.com',
      };
      const result = await service.signup(dto);

      expect(bcrypt.hashSync).toHaveBeenCalledWith('Test123!@#', 10);
      expect(mockUsersService.create).toHaveBeenCalledWith(
        expect.objectContaining({ password: 'hashed-password' }),
      );
      expect(result).toEqual(mockUser);
    });
  });

  describe('hashPassword()', () => {
    it('should return a bcrypt hash', () => {
      const hash = service.hashPassword('Test123!@#');
      expect(bcrypt.hashSync).toHaveBeenCalledWith('Test123!@#', 10);
      expect(hash).toBe('hashed-password');
    });
  });

  describe('verifyPassword()', () => {
    it('should return true when user exists and password matches', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      const result = await service.verifyPassword(
        mockUser,
        'Test123!@#',
        'hashed-password',
      );
      expect(result).toBe(true);
    });

    it('should return false when user is null', async () => {
      const result = await service.verifyPassword(
        null,
        'Test123!@#',
        'hashed-password',
      );
      expect(result).toBe(false);
    });
  });
});
