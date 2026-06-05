import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

const mockUser: User = {
  id: '1',
  name: 'Alice',
  email: 'alice@example.com',
  avatarUrl: '',
};

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
    const dto = { name: 'Alice', email: 'alice@example.com' };
    const result = await service.create(dto);
    expect(mockRepository.create).toHaveBeenCalledWith(dto);
    expect(mockRepository.save).toHaveBeenCalledWith(mockUser);
    expect(result).toEqual(mockUser);
  });

  it('findAll() should return all users', async () => {
    const result = await service.findAll();
    expect(mockRepository.find).toHaveBeenCalled();
    expect(result).toEqual([mockUser]);
  });

  it('findOne() should return a user by id', async () => {
    const result = await service.findOne(1);
    expect(mockRepository.findOneBy).toHaveBeenCalledWith({ id: 1 });
    expect(result).toEqual(mockUser);
  });

  it('findOne() should throw NotFoundException when user is not found', async () => {
    mockRepository.findOneBy.mockResolvedValueOnce(null);
    await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
  });

  it('update() should merge the dto and save the user', async () => {
    const dto = { name: 'Bob' };
    const result = await service.update(1, dto);
    expect(mockRepository.findOneBy).toHaveBeenCalledWith({ id: 1 });
    expect(mockRepository.merge).toHaveBeenCalledWith(mockUser, dto);
    expect(mockRepository.save).toHaveBeenCalledWith(mockUser);
    expect(result).toEqual(mockUser);
  });

  it('remove() should delete and return the user', async () => {
    const result = await service.remove(1);
    expect(mockRepository.findOneBy).toHaveBeenCalledWith({ id: 1 });
    expect(mockRepository.remove).toHaveBeenCalledWith(mockUser);
    expect(result).toEqual(mockUser);
  });
});
