import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError } from 'typeorm';
import { UserRole } from '@app/shared';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

const duplicateKeyError = new QueryFailedError(
  'INSERT INTO "user" VALUES (...)',
  [],
  Object.assign(
    new Error(
      'duplicate key value violates unique constraint "UQ_23c05c292c439d77b0de816b500"',
    ),
    { code: '23505' },
  ),
);

const mockUser = {
  id: '1',
  name: 'Alice',
  username: 'alice',
  email: 'alice@example.com',
} as User;

const owner = { sub: '1', username: 'alice', role: UserRole.USER };
const otherUser = { sub: '2', username: 'bob', role: UserRole.USER };
const admin = { sub: '99', username: 'root', role: UserRole.ADMIN };

const mockRepository = {
  create: jest.fn().mockReturnValue(mockUser),
  save: jest.fn().mockResolvedValue(mockUser),
  find: jest.fn().mockResolvedValue([mockUser]),
  findOneBy: jest.fn().mockResolvedValue(mockUser),
  merge: jest.fn().mockReturnValue(mockUser),
  remove: jest.fn().mockResolvedValue(mockUser),
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('create() should persist and return the new user', async () => {
    const dto = {
      name: 'Alice',
      username: 'alice',
      password: 'Test123!@#',
      email: 'alice@example.com',
    };
    const result = await service.create(dto);
    expect(mockRepository.create).toHaveBeenCalledWith(dto);
    expect(mockRepository.save).toHaveBeenCalledWith(mockUser);
    expect(result).toEqual(mockUser);
  });

  it('create() should throw ConflictException when username/email already exists', async () => {
    mockRepository.save.mockRejectedValueOnce(duplicateKeyError);
    const dto = {
      name: 'Alice',
      username: 'alice',
      password: 'Test123!@#',
      email: 'alice@example.com',
    };
    await expect(service.create(dto)).rejects.toThrow(ConflictException);
  });

  it('create() should rethrow errors that are not unique violations', async () => {
    const dbError = new Error('connection refused');
    mockRepository.save.mockRejectedValueOnce(dbError);
    const dto = {
      name: 'Alice',
      username: 'alice',
      password: 'Test123!@#',
      email: 'alice@example.com',
    };
    await expect(service.create(dto)).rejects.toThrow(dbError);
  });

  it('findAll() should return all users', async () => {
    const result = await service.findAll();
    expect(mockRepository.find).toHaveBeenCalled();
    expect(result).toEqual([mockUser]);
  });

  it('findOne() should return a user by id', async () => {
    const result = await service.findOne('1');
    expect(mockRepository.findOneBy).toHaveBeenCalledWith({ id: '1' });
    expect(result).toEqual(mockUser);
  });

  it('findOne() should throw NotFoundException when user is not found', async () => {
    mockRepository.findOneBy.mockResolvedValueOnce(null);
    await expect(service.findOne('999')).rejects.toThrow(NotFoundException);
  });

  it('update() should merge the dto and save the user when the requester is the owner', async () => {
    const dto = { name: 'Bob' };
    const result = await service.update('1', dto, owner);
    expect(mockRepository.findOneBy).toHaveBeenCalledWith({ id: '1' });
    expect(mockRepository.merge).toHaveBeenCalledWith(mockUser, dto);
    expect(mockRepository.save).toHaveBeenCalledWith(mockUser);
    expect(result).toEqual(mockUser);
  });

  it('update() should allow an admin to update another user', async () => {
    const dto = { name: 'Bob' };
    const result = await service.update('1', dto, admin);
    expect(result).toEqual(mockUser);
  });

  it('update() should throw ForbiddenException when requester is neither owner nor admin', async () => {
    await expect(
      service.update('1', { name: 'Bob' }, otherUser),
    ).rejects.toThrow(ForbiddenException);
  });

  it('update() should throw ConflictException when username/email already exists', async () => {
    mockRepository.save.mockRejectedValueOnce(duplicateKeyError);
    await expect(
      service.update('1', { email: 'taken@example.com' }, owner),
    ).rejects.toThrow(ConflictException);
  });

  it('remove() should delete and return the user when the requester is the owner', async () => {
    const result = await service.remove('1', owner);
    expect(mockRepository.findOneBy).toHaveBeenCalledWith({ id: '1' });
    expect(mockRepository.remove).toHaveBeenCalledWith(mockUser);
    expect(result).toEqual(mockUser);
  });

  it('remove() should allow an admin to delete another user', async () => {
    const result = await service.remove('1', admin);
    expect(result).toEqual(mockUser);
  });

  it('remove() should throw ForbiddenException when requester is neither owner nor admin', async () => {
    await expect(service.remove('1', otherUser)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('findByUsername() should return a user by username', async () => {
    const result = await service.findByUsername('alice');
    expect(mockRepository.findOneBy).toHaveBeenCalledWith({
      username: 'alice',
    });
    expect(result).toEqual(mockUser);
  });

  it('findByUsername() should return null when not found', async () => {
    mockRepository.findOneBy.mockResolvedValueOnce(null);
    const result = await service.findByUsername('unknown');
    expect(result).toBeNull();
  });
});
