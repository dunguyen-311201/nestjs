import { Test, type TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '@app/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

const mockUsersService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

const mockJwtAuthGuard = { canActivate: jest.fn().mockReturnValue(true) };

describe('UsersController', () => {
  let controller: UsersController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('findAll() should delegate to UsersService', async () => {
    mockUsersService.findAll.mockResolvedValue([]);
    const result = await controller.findAll();
    expect(mockUsersService.findAll).toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('findOne() should delegate to UsersService with id', async () => {
    const user = { id: '1', name: 'Alice', email: 'alice@example.com' };
    mockUsersService.findOne.mockResolvedValue(user);
    const result = await controller.findOne('1');
    expect(mockUsersService.findOne).toHaveBeenCalledWith('1');
    expect(result).toEqual(user);
  });
});
